import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache } from '../../../src/middleware/cache.js';

describe('Cache', () => {
    let cache: Cache;

    beforeEach(() => {
        cache = new Cache(1000); // 1s default TTL for fast tests
    });

    describe('get() and set()', () => {
        it('returns stored value before expiry', () => {
            cache.set('key1', { name: 'test' }, 5000);
            const result = cache.get<{ name: string }>('key1');
            expect(result).toEqual({ name: 'test' });
        });

        it('returns undefined for missing key', () => {
            expect(cache.get('missing')).toBeUndefined();
        });

        it('returns undefined after TTL expiry', async () => {
            cache.set('expires', 'value', 50); // 50ms TTL
            await new Promise((r) => setTimeout(r, 100));
            expect(cache.get('expires')).toBeUndefined();
        });

        it('does not cache when TTL is 0', () => {
            cache.set('no-cache', 'value', 0);
            expect(cache.get('no-cache')).toBeUndefined();
        });
    });

    describe('invalidate()', () => {
        it('removes specific key', () => {
            cache.set('to-delete', 'value');
            cache.invalidate('to-delete');
            expect(cache.get('to-delete')).toBeUndefined();
        });
    });

    describe('invalidatePrefix()', () => {
        it('removes all keys with matching prefix', () => {
            cache.set('ticket:1:full', 'a');
            cache.set('ticket:1:basic', 'b');
            cache.set('ticket:2:full', 'c');
            cache.set('contact:1', 'd');

            cache.invalidatePrefix('ticket:1');

            expect(cache.get('ticket:1:full')).toBeUndefined();
            expect(cache.get('ticket:1:basic')).toBeUndefined();
            expect(cache.get('ticket:2:full')).toBe('c'); // Untouched
            expect(cache.get('contact:1')).toBe('d'); // Untouched
        });
    });

    describe('clear()', () => {
        it('removes all entries', () => {
            cache.set('a', 1);
            cache.set('b', 2);
            cache.clear();
            expect(cache.get('a')).toBeUndefined();
            expect(cache.get('b')).toBeUndefined();
        });
    });

    describe('TTL constants', () => {
        it('exports expected TTL values', () => {
            expect(Cache.TTL.AGENTS).toBe(60 * 60 * 1000);
            expect(Cache.TTL.TICKETS).toBe(2 * 60 * 1000);
            expect(Cache.TTL.SEARCH).toBe(0);
        });
    });
});
