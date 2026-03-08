export interface RetryOptions {
    maxRetries?: number; // default: 3
    baseDelayMs?: number; // default: 1000
    maxDelayMs?: number; // default: 30000
}

export class RetryHandler {
    private opts: Required<RetryOptions>;

    constructor(options: RetryOptions = {}) {
        this.opts = {
            maxRetries: options.maxRetries ?? 3,
            baseDelayMs: options.baseDelayMs ?? 1000,
            maxDelayMs: options.maxDelayMs ?? 30000,
        };
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: Error | undefined;
        for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err: unknown) {
                lastError = err instanceof Error ? err : new Error(String(err));
                if (!this.isRetryable(err) || attempt === this.opts.maxRetries) throw err;
                const delay = this.calculateDelay(attempt, err);
                await this.sleep(delay);
            }
        }
        throw lastError ?? new Error('Max retries exceeded');
    }

    private isRetryable(err: unknown): boolean {
        if (typeof err === 'object' && err !== null) {
            const e = err as Record<string, unknown>;
            const status = (e['statusCode'] as number | undefined) ?? (e['status'] as number | undefined);
            return status === 429 || (typeof status === 'number' && status >= 500 && status < 600);
        }
        return false;
    }

    private calculateDelay(attempt: number, err: unknown): number {
        // Use Retry-After header if present (429 responses)
        if (typeof err === 'object' && err !== null) {
            const retryAfter = (err as Record<string, unknown>)['retryAfter'];
            if (typeof retryAfter === 'number') return retryAfter * 1000;
        }
        // Exponential backoff with full jitter
        const exponential = this.opts.baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * exponential;
        return Math.min(jitter, this.opts.maxDelayMs);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
