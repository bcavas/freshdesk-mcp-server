import { describe, it, expect } from 'vitest';
import { autoPaginate } from '../../../src/client/pagination.js';

describe('autoPaginate()', () => {
    it('collects all pages until hasMore is false', async () => {
        const pages = [
            { data: [1, 2, 3], hasMore: true },
            { data: [4, 5, 6], hasMore: true },
            { data: [7], hasMore: false },
        ];
        const result = await autoPaginate(async (page, _perPage) => {
            return pages[page - 1] ?? { data: [], hasMore: false };
            callCount++;
        });
        expect(result.data).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(result.has_more).toBe(false);
        expect(result.total_count).toBe(7);
    });

    it('stops at maxPages limit even if hasMore is true', async () => {
        const result = await autoPaginate(
            async (_page, perPage) => ({
                data: Array.from({ length: perPage }, (_, i) => i),
                hasMore: true,
            }),
            { maxPages: 3, perPage: 5 },
        );
        expect(result.data).toHaveLength(15); // 3 pages × 5 items
        expect(result.has_more).toBe(true);
        expect(result.page).toBe(3);
    });

    it('stops when token budget is exceeded', async () => {
        const largeItem = { content: 'x'.repeat(1000) }; // ~250 tokens each
        let pagesRequested = 0;
        const result = await autoPaginate(
            async () => {
                pagesRequested++;
                return { data: Array.from({ length: 10 }, () => largeItem), hasMore: true };
            },
            { tokenBudget: 3000, perPage: 10 },
        );
        // Should stop well before maxPages=10
        expect(pagesRequested).toBeLessThan(10);
        expect(result.has_more).toBe(true);
    });

    it('caps perPage at 100', async () => {
        const calls: number[] = [];
        await autoPaginate(
            async (_page, perPage) => {
                calls.push(perPage);
                return { data: [], hasMore: false };
            },
            { perPage: 999 },
        );
        expect(calls[0]).toBe(100);
    });
});
