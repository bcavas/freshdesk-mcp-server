import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../../src/middleware/rate-limiter.js';

describe('RateLimiter', () => {
    describe('updateFromHeaders()', () => {
        it('parses rate limit headers correctly', () => {
            const limiter = new RateLimiter(20);
            limiter.updateFromHeaders({
                'x-ratelimit-total': '1000',
                'x-ratelimit-remaining': '750',
            });
            const status = limiter.getStatus();
            expect(status.total).toBe(1000);
            expect(status.remaining).toBe(750);
        });

        it('handles missing headers gracefully', () => {
            const limiter = new RateLimiter(20);
            expect(() => limiter.updateFromHeaders({})).not.toThrow();
            const status = limiter.getStatus();
            expect(status.total).toBe(Infinity);
            expect(status.remaining).toBe(Infinity);
        });
    });

    describe('canProceed()', () => {
        it('returns allowed=true when remaining exceeds buffer', () => {
            const limiter = new RateLimiter(20);
            limiter.updateFromHeaders({
                'x-ratelimit-total': '1000',
                'x-ratelimit-remaining': '500', // 500 > 200 buffer
            });
            const { allowed, delayMs } = limiter.canProceed();
            expect(allowed).toBe(true);
            expect(delayMs).toBe(0);
        });

        it('returns allowed=true with delay when remaining is below buffer', () => {
            const limiter = new RateLimiter(20);
            limiter.updateFromHeaders({
                'x-ratelimit-total': '1000',
                'x-ratelimit-remaining': '100', // 100 <= 200 buffer, but > 0
            });
            const { allowed, delayMs } = limiter.canProceed();
            expect(allowed).toBe(true);
            expect(delayMs).toBeGreaterThan(0);
        });

        it('returns allowed=false when remaining is 0', () => {
            const limiter = new RateLimiter(20);
            limiter.updateFromHeaders({
                'x-ratelimit-total': '1000',
                'x-ratelimit-remaining': '0',
            });
            const { allowed } = limiter.canProceed();
            expect(allowed).toBe(false);
        });

        it('allows all requests before first header update (Infinity remaining)', () => {
            const limiter = new RateLimiter(20);
            const { allowed, delayMs } = limiter.canProceed();
            expect(allowed).toBe(true);
            expect(delayMs).toBe(0);
        });
    });
});
