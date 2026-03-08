import { describe, it, expect } from 'vitest';
import { mapErrorToToolResult } from '../../../src/errors/mcp-error-mapper.js';
import { FreshdeskApiError } from '../../../src/errors/freshdesk-error.js';

describe('MCP Error Mapper', () => {
    it('maps Freshdesk Api Error to proper bounded layout', () => {
        const err = new FreshdeskApiError(404, 'record_not_found', 'Record Not Found');
        const res = mapErrorToToolResult(err);

        expect(res.isError).toBe(true);
        const content = res.content as Array<{ type: string, text: string }>;
        expect(content[0].type).toBe('text');
        expect(content[0].text).toContain('Freshdesk API Error (404)');
        expect(content[0].text).toContain('Record Not Found');
    });

    it('maps generic Error to standardized layout safely', () => {
        const err = new Error('Random catastrophic failure');
        const res = mapErrorToToolResult(err);

        expect(res.isError).toBe(true);
        const content = res.content as Array<{ type: string, text: string }>;
        expect(content[0].text).toContain('Unexpected error: Random catastrophic failure');
    });

    it('maps non-Error objects to string output safely', () => {
        const err = { message: 'Some object' };
        const res = mapErrorToToolResult(err);

        expect(res.isError).toBe(true);
        expect((res.content[0] as any).text).toContain('Unexpected error: [object Object]');
    });

    it('returns specific suggestions for known HTTP status codes', () => {
        const scenarios = [
            { code: 401, text: 'Check your FRESHDESK_API_KEY' },
            { code: 403, text: 'Your API key lacks permission' },
            { code: 409, text: 'Conflict' },
            { code: 429, text: 'Rate limit exceeded' },
            { code: 502, text: 'unexpected Freshdesk API error' } // fallback test
        ];

        for (const s of scenarios) {
            const err = new FreshdeskApiError(s.code, 'err', 'msg');
            const res = mapErrorToToolResult(err);
            expect((res.content[0] as any).text).toContain(s.text);
        }
    });
});
