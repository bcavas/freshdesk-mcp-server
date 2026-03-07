import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig, type Config } from './config.js';
import { logger } from './logger.js';
import { FreshdeskClient } from './client/freshdesk-client.js';
import { RateLimiter } from './middleware/rate-limiter.js';
import { RetryHandler } from './middleware/retry.js';
import { Cache } from './middleware/cache.js';
import { Redactor } from './middleware/redactor.js';
import { InputGuard } from './middleware/input-guard.js';
import { resolveTools } from './tools/registry.js';
import { mapErrorToToolResult } from './errors/mcp-error-mapper.js';

export function createServer(config?: Config): McpServer {
    const cfg = config ?? loadConfig();

    // Initialize middleware
    const rateLimiter = new RateLimiter(cfg.rateLimit.bufferPercent);
    const retrier = new RetryHandler();
    const cache = new Cache();
    const redactor = new Redactor(cfg.security.redactFields);
    const inputGuard = new InputGuard();

    // Initialize Freshdesk client
    const client = new FreshdeskClient(cfg, rateLimiter, retrier, cache, redactor, logger);

    // Initialize MCP server
    const server = new McpServer(
        {
            name: 'freshdesk-mcp-server',
            version: '0.1.0',
        },
        {
            capabilities: {
                tools: { listChanged: true },
                logging: {},
            },
        },
    );

    // Register tools
    const tools = resolveTools(cfg.toolsets.enabled, client, logger);
    logger.info({ toolCount: tools.length, toolsets: cfg.toolsets.enabled }, 'Registering MCP tools');

    for (const tool of tools) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inputSchema = (tool.inputSchema as any).shape ?? {};

        server.registerTool(
            tool.name,
            {
                description: tool.description,
                inputSchema,
                annotations: tool.annotations,
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async (input: any) => {
                // Validate input with Zod
                const parsed = tool.inputSchema.safeParse(input);
                if (!parsed.success) {
                    const errorMessages = parsed.error.issues
                        .map((i: { path: unknown[]; message: string }) => {
                            const pathStr = i.path
                                .filter((p) => typeof p === 'string' || typeof p === 'number')
                                .join('.');
                            return `${pathStr}: ${i.message}`;
                        })
                        .join('; ');
                    return {
                        content: [{ type: 'text' as const, text: `Invalid input: ${errorMessages}` }],
                        isError: true,
                    };
                }

                // Input guard check — detect prompt injection
                const guardResult = inputGuard.validate(parsed.data as Record<string, unknown>);
                if (!guardResult.safe) {
                    logger.warn({ tool: tool.name, reason: guardResult.reason }, 'Input guard rejected');
                    return {
                        content: [
                            { type: 'text' as const, text: `Request rejected: ${guardResult.reason}` },
                        ],
                        isError: true,
                    };
                }

                // Execute tool handler
                try {
                    const result = await tool.handler(parsed.data);
                    return {
                        ...result,
                        content: result.content.map((c) => ({ ...c, type: 'text' as const })),
                        structuredContent: result.structuredContent as
                            | Record<string, unknown>
                            | undefined,
                    };
                } catch (err: unknown) {
                    logger.error({ tool: tool.name, err }, 'Tool execution failed');
                    const mapped = mapErrorToToolResult(err);
                    return {
                        ...mapped,
                        content: mapped.content.map((c) => ({ ...c, type: 'text' as const })),
                    };
                }
            },
        );
    }

    return server;
}
