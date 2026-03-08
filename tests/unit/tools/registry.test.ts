import { describe, it, expect, vi } from 'vitest';
import { resolveTools } from '../../../src/tools/registry.js';
import type { FreshdeskClient } from '../../../src/client/freshdesk-client.js';
import type { Logger } from 'pino';

describe('Tool Registry', () => {
    it('resolves valid toolsets', () => {
        const mockClient = {} as FreshdeskClient;
        const mockLogger = { warn: vi.fn(), info: vi.fn(), child: vi.fn() } as unknown as Logger;

        const tools = resolveTools(['core', 'kb', 'analytics', 'bulk', 'admin'], mockClient, mockLogger);
        expect(tools.length).toBeGreaterThan(10);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('logs warning for unknown toolsets and skips them', () => {
        const mockClient = {} as FreshdeskClient;
        const mockLogger = { warn: vi.fn(), info: vi.fn(), child: vi.fn() } as unknown as Logger;

        const tools = resolveTools(['core', 'invalid_toolset', 'unknown'], mockClient, mockLogger);
        expect(tools.length).toBeGreaterThan(0);
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith({ toolset: 'invalid_toolset' }, expect.any(String));
    });
});
