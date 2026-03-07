import type { PaginatedResult } from './types.js';

export interface PaginationOptions {
    maxPages?: number; // Hard limit on pages (default: 10)
    perPage?: number; // Items per page (default: 30, max: 100)
    tokenBudget?: number; // Approximate token budget — stop when exceeded
}

export async function autoPaginate<T>(
    fetchPage: (page: number, perPage: number) => Promise<{ data: T[]; hasMore: boolean }>,
    options: PaginationOptions = {},
): Promise<PaginatedResult<T>> {
    const maxPages = options.maxPages ?? 10;
    const perPage = Math.min(options.perPage ?? 30, 100);
    const tokenBudget = options.tokenBudget ?? 50000;

    const allData: T[] = [];
    let currentPage = 1;
    let hasMore = true;
    let estimatedTokens = 0;

    while (hasMore && currentPage <= maxPages && estimatedTokens < tokenBudget) {
        const result = await fetchPage(currentPage, perPage);
        allData.push(...result.data);
        hasMore = result.hasMore;

        // Rough token estimate: 1 token ≈ 4 chars of JSON
        estimatedTokens += JSON.stringify(result.data).length / 4;
        currentPage++;
    }

    return {
        data: allData,
        page: currentPage - 1,
        per_page: perPage,
        has_more: hasMore,
        total_count: allData.length,
    };
}
