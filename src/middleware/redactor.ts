export class Redactor {
    private fieldsToRedact: Set<string>;

    constructor(fields: string[] = ['phone', 'mobile', 'twitter_id']) {
        this.fieldsToRedact = new Set(fields);
    }

    redact<T extends Record<string, unknown>>(obj: T): T {
        if (Array.isArray(obj)) {
            return obj.map((item) => this.redact(item)) as unknown as T;
        }
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        const redacted = { ...obj };
        for (const key of Object.keys(redacted)) {
            if (this.fieldsToRedact.has(key) && redacted[key] != null) {
                (redacted as Record<string, unknown>)[key] = '[REDACTED]';
            }
            if (typeof redacted[key] === 'object' && redacted[key] !== null) {
                (redacted as Record<string, unknown>)[key] = this.redact(
                    redacted[key] as Record<string, unknown>,
                );
            }
        }
        return redacted;
    }
}
