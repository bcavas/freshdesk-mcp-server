export class FreshdeskApiError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly errorCode: string,
        message: string,
        public readonly retryAfter?: number,
        public readonly details?: unknown,
    ) {
        super(message);
        this.name = 'FreshdeskApiError';
    }

    static fromResponse(
        status: number,
        body: Record<string, unknown>,
        headers: Record<string, string>,
    ): FreshdeskApiError {
        const retryAfter = headers['retry-after']
            ? parseInt(headers['retry-after'], 10)
            : undefined;
        const errorCode = (body?.code as string | undefined) ?? `HTTP_${status}`;
        const message =
            (body?.message as string | undefined) ??
            (body?.description as string | undefined) ??
            `Freshdesk API error: HTTP ${status}`;
        return new FreshdeskApiError(
            status,
            errorCode,
            message,
            retryAfter,
            body?.errors,
        );
    }
}
