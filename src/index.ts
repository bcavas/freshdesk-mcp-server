import { createServer } from './server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ErrorReporting } from '@google-cloud/error-reporting';
import { requestContext } from './context.js';

const errors = new ErrorReporting();

// Lazy-initialised after server is already listening — prevents startup crashes
// from killing the process before /health can respond.
let mcpServer: ReturnType<typeof createServer> | null = null;
let configError: string | null = null;

function getMcpServer() {
    if (configError) return null;
    try {
        const config = loadConfig();
        const sessionServer = createServer(config);
        return sessionServer;
    } catch (err: unknown) {
        configError = err instanceof Error ? err.message : String(err);
        logger.error({ err }, 'Failed to load config / create MCP server');
        return null;
    }
}

const port = parseInt(process.env.PORT ?? '8080', 10);
const host = process.env.MCP_HOST ?? '0.0.0.0';

const transports = new Map<string, StreamableHTTPServerTransport>();

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Health check endpoint — always responds, even if config failed
    if (url.pathname === '/health') {
        if (req.method !== 'GET') {
            res.writeHead(405, { Allow: 'GET', 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }
        if (configError) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    status: 'unhealthy',
                    error: configError,
                }),
            );
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                status: 'healthy',
                version: process.env.npm_package_version ?? 'unknown',
                mcp_endpoint: '/mcp',
            }),
        );
        return;
    }

    // MCP endpoint
    if (url.pathname === '/mcp') {
        const server = getMcpServer();
        if (!server) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server initialisation failed', detail: configError }));
            return;
        }

        // Origin validation (prevent DNS rebinding)
        const origin = req.headers.origin;
        if (origin && !['http://localhost', 'https://localhost'].some(o => origin.startsWith(o))) {
            res.writeHead(403);
            res.end('Invalid origin');
            return;
        }

        const traceContext = req.headers['x-cloud-trace-context'] as string | undefined;

        // Handle POST (tool calls, initialize)
        if (req.method === 'POST') {
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            let transport: StreamableHTTPServerTransport;

            if (sessionId && transports.has(sessionId)) {
                transport = transports.get(sessionId)!;
            } else if (!sessionId) {
                // New session — create transport and connect server
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (id) => {
                        transports.set(id, transport);
                        logger.info({ sessionId: id }, 'New MCP session initialized');
                    },
                });
                transport.onclose = () => {
                    const id = [...transports.entries()].find(([, t]) => t === transport)?.[0];
                    if (id) {
                        transports.delete(id);
                        logger.info({ sessionId: id }, 'MCP session closed');
                    }
                };
                const sessionServer = getMcpServer();
                if (!sessionServer) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Server initialization failed' }));
                    return;
                }
                await sessionServer.connect(transport);
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid or unknown session ID' }));
                return;
            }

            await requestContext.run({ sessionId: sessionId ?? '', traceContext }, async () => {
                try {
                    await transport.handleRequest(req, res);
                } catch (e: unknown) {
                    errors.report(e as Error);
                }
            });
            return;
        }

        // Handle GET (SSE stream for server-to-client notifications)
        if (req.method === 'GET') {
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            if (!sessionId || !transports.has(sessionId)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing or invalid session ID' }));
                return;
            }
            await requestContext.run({ sessionId, traceContext }, async () => {
                await transports.get(sessionId)!.handleRequest(req, res);
            });
            return;
        }

        // Handle DELETE (session termination)
        if (req.method === 'DELETE') {
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            if (sessionId && transports.has(sessionId)) {
                await transports.get(sessionId)!.close();
                transports.delete(sessionId);
                logger.info({ sessionId }, 'MCP session terminated via DELETE');
            }
            res.writeHead(200);
            res.end();
            return;
        }

        res.writeHead(405, { Allow: 'GET, POST, DELETE' });
        res.end('Method not allowed');
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

httpServer.listen(port, host, () => {
    logger.info(
        { port, host, transport: 'streamable-http' },
        'Freshdesk MCP server listening',
    );
    // Eagerly attempt config load so startup errors surface in logs immediately
    getMcpServer();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received — shutting down gracefully');
    httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received — shutting down');
    httpServer.close(() => process.exit(0));
});
