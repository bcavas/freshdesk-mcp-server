import { describe, it, expect } from 'vitest';
import { FreshdeskApiError } from '../../../src/errors/freshdesk-error.js';

describe('FreshdeskApiError', () => {
    it('creates error with all fields from response', () => {
        const error = FreshdeskApiError.fromResponse(
            429,
            { code: 'rate_limit', message: 'Too many requests' },
            { 'retry-after': '60' }
        );
        expect(error.statusCode).toBe(429);
        expect(error.errorCode).toBe('rate_limit');
        expect(error.message).toBe('Too many requests');
        expect(error.retryAfter).toBe(60);
    });

    it('falls back to description if message is missing', () => {
        const error = FreshdeskApiError.fromResponse(
            400,
            { description: 'Bad input' },
            {}
        );
        expect(error.message).toBe('Bad input');
        expect(error.errorCode).toBe('HTTP_400');
    });

    it('falls back to default message and empty body', () => {
        const error = FreshdeskApiError.fromResponse(500, null as unknown as Record<string, unknown>, {});
        expect(error.message).toBe('Freshdesk API error: HTTP 500');
        expect(error.errorCode).toBe('HTTP_500');
        expect(error.retryAfter).toBeUndefined();
    });
});
