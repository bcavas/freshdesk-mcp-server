import { createServer } from './server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const config = loadConfig();
const mcpServer = createServer(config);

const transports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Health check endpoint
    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                status: 'ok',
                version: process.env.npm_package_version ?? 'unknown',
                transport: 'streamable-http',
            }),
        );
        return;
    }

    // MCP endpoint
    if (url.pathname === '/mcp') {
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
                await mcpServer.connect(transport);
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid or unknown session ID' }));
                return;
            }

            await transport.handleRequest(req, res);
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
            await transports.get(sessionId)!.handleRequest(req, res);
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

const port = parseInt(process.env.PORT ?? String(config.server.port), 10);
httpServer.listen(port, config.server.host, () => {
    logger.info(
        { port, host: config.server.host, transport: 'streamable-http' },
        'Freshdesk MCP server listening',
    );
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
