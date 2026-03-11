import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, Server } from 'node:http';

const TEST_API_KEY = 'test-secret-key-abc123';

/**
 * Builds a minimal HTTP server that replicates the auth gate from src/index.ts.
 * Used to verify the check in isolation without needing a full MCP stack.
 */
function buildAuthServer(apiKey: string | null): Server {
    return createHttpServer((req: IncomingMessage, res: ServerResponse) => {
        const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);

        if (reqUrl.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'healthy' }));
            return;
        }

        if (reqUrl.pathname === '/mcp') {
            if (apiKey) {
                const provided = req.headers['x-api-key'];
                if (!provided || provided !== apiKey) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid x-api-key header' }));
                    return;
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        res.writeHead(404);
        res.end();
    });
}

describe('MCP API Key Authentication — key configured', () => {
    let server: Server;
    let url: string;

    beforeAll(() => {
        server = buildAuthServer(TEST_API_KEY);
        server.listen(0);
        const address = server.address() as { port: number };
        url = `http://127.0.0.1:${address.port}`;
    });

    afterAll(() => {
        server.close();
    });

    it('/health is exempt — returns 200 without x-api-key', async () => {
        const res = await fetch(`${url}/health`);
        expect(res.status).toBe(200);
    });

    it('/mcp returns 401 when x-api-key header is absent', async () => {
        const res = await fetch(`${url}/mcp`, { method: 'POST' });
        expect(res.status).toBe(401);
        const body = await res.json() as { error: string };
        expect(body.error).toContain('Unauthorized');
    });

    it('/mcp returns 401 when x-api-key is wrong', async () => {
        const res = await fetch(`${url}/mcp`, {
            method: 'POST',
            headers: { 'x-api-key': 'wrong-key' },
        });
        expect(res.status).toBe(401);
    });

    it('/mcp returns 200 when correct x-api-key is provided', async () => {
        const res = await fetch(`${url}/mcp`, {
            method: 'POST',
            headers: { 'x-api-key': TEST_API_KEY },
        });
        expect(res.status).toBe(200);
    });
});

describe('MCP API Key Authentication — no key configured', () => {
    let server: Server;
    let url: string;

    beforeAll(() => {
        server = buildAuthServer(null);
        server.listen(0);
        const address = server.address() as { port: number };
        url = `http://127.0.0.1:${address.port}`;
    });

    afterAll(() => {
        server.close();
    });

    it('/mcp is accessible without x-api-key when MCP_API_KEY is not set', async () => {
        const res = await fetch(`${url}/mcp`, { method: 'POST' });
        expect(res.status).toBe(200);
    });
});
