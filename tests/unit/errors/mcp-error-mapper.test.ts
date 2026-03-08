import { describe, it, expect } from 'vitest';
import { mapErrorToToolResult } from '../../../src/errors/mcp-error-mapper.js';
import { FreshdeskApiError } from '../../../src/errors/freshdesk-error.js';

describe('MCP Error Mapper', () => {
    it('maps Freshdesk Api Error to proper bounded layout', () => {
        const err = new FreshdeskApiError(404, 'record_not_found', 'Record Not Found');
        const res = mapErrorToToolResult(err, 'get_ticket');

        expect(res.isError).toBe(true);
        const content = res.content as Array<{ type: string, text: string }>;
        expect(content[0].type).toBe('text');
        expect(content[0].text).toContain('Freshdesk API Error (404)');
        expect(content[0].text).toContain('Record Not Found');
    });

    it('maps generic Error to standardized layout safely', () => {
        const err = new Error('Random catastrophic failure');
        const res = mapErrorToToolResult(err, 'create_ticket');

        expect(res.isError).toBe(true);
        const content = res.content as Array<{ type: string, text: string }>;
        expect(content[0].text).toContain('Unexpected error: Random catastrophic failure');
    });
});
