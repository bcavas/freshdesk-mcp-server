export class RateLimiter {
    private remaining: number = Infinity;
    private total: number = Infinity;
    private resetAt: number = 0;
    private bufferPercent: number;

    constructor(bufferPercent: number = 20) {
        this.bufferPercent = bufferPercent;
    }

    updateFromHeaders(headers: Record<string, string>): void {
        if (headers['x-ratelimit-total']) {
            this.total = parseInt(headers['x-ratelimit-total'], 10);
        }
        if (headers['x-ratelimit-remaining']) {
            this.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
        }
        // Freshdesk rate limits reset every 60 seconds
        this.resetAt = Date.now() + 60_000;
    }

    canProceed(): { allowed: boolean; delayMs: number } {
        const buffer = Math.ceil(this.total * (this.bufferPercent / 100));
        if (this.remaining > buffer) return { allowed: true, delayMs: 0 };
        if (this.remaining > 0) {
            const delayMs = Math.max(0, this.resetAt - Date.now());
            return { allowed: true, delayMs }; // Proceed after delay
        }
        return { allowed: false, delayMs: Math.max(0, this.resetAt - Date.now()) };
    }

    getStatus(): { remaining: number; total: number; resetAt: number } {
        return { remaining: this.remaining, total: this.total, resetAt: this.resetAt };
    }
}
