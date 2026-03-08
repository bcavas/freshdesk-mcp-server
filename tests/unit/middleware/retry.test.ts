import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryHandler } from '../../../src/middleware/retry.js';

describe('RetryHandler', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('executes successfully on first try', async () => {
        const handler = new RetryHandler();
        const fn = vi.fn().mockResolvedValue('success');
        const result = await handler.execute(fn);
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 error and eventually succeeds', async () => {
        const handler = new RetryHandler({ baseDelayMs: 10, maxRetries: 2 });
        const fn = vi.fn()
            .mockRejectedValueOnce({ status: 429 })
            .mockResolvedValueOnce('success');

        const promise = handler.execute(fn);
        await vi.runAllTimersAsync(); // fast-forward sleep
        const result = await promise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on 500 error and eventually succeeds', async () => {
        const handler = new RetryHandler({ baseDelayMs: 10, maxRetries: 2 });
        const fn = vi.fn()
            .mockRejectedValueOnce({ statusCode: 500 })
            .mockResolvedValueOnce('success');

        const promise = handler.execute(fn);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 404 error', async () => {
        const handler = new RetryHandler({ baseDelayMs: 10, maxRetries: 2 });
        const fn = vi.fn().mockRejectedValue({ status: 404 });

        await expect(handler.execute(fn)).rejects.toEqual({ status: 404 });
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does not retry on non-object error', async () => {
        const handler = new RetryHandler({ baseDelayMs: 10, maxRetries: 2 });
        const fn = vi.fn().mockRejectedValue('string error');

        await expect(handler.execute(fn)).rejects.toEqual('string error');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws after max retries are exceeded', async () => {
        const handler = new RetryHandler({ baseDelayMs: 10, maxRetries: 2 });
        const fn = vi.fn().mockRejectedValue({ status: 429 });

        let caughtError;
        const promise = handler.execute(fn).catch(e => { caughtError = e; });
        await vi.runAllTimersAsync();
        await promise;

        expect(caughtError).toEqual({ status: 429 });
        expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('uses retryAfter value from error if present', async () => {
        const handler = new RetryHandler({ baseDelayMs: 10, maxRetries: 1 });
        const fn = vi.fn()
            .mockRejectedValueOnce({ status: 429, retryAfter: 2 })
            .mockResolvedValueOnce('success');

        const promise = handler.execute(fn);

        await vi.advanceTimersByTimeAsync(1999);
        // still sleeping
        expect(fn).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(2);
        const result = await promise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
