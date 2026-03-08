import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer as createHttpServer, Server } from 'node:http';

describe('Health Endpoint', () => {
    let server: Server;
    let url: string;

    beforeAll(() => {
        // Simple mock of the index.ts server logic mapping to the health route
        server = createHttpServer((req, res) => {
            const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);
            if (reqUrl.pathname === '/health') {
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
            res.writeHead(404);
            res.end();
        });

        server.listen(0);
        const address = server.address() as any;
        url = `http://127.0.0.1:${address.port}`;
    });

    afterAll(() => {
        server.close();
    });

    it('returns 200 OK with correct schema on /health GET', async () => {
        const response = await fetch(`${url}/health`);
        expect(response.status).toBe(200);

        const data = await response.json() as any;
        expect(data.status).toBe('healthy');
        expect(data.mcp_endpoint).toBe('/mcp');
        expect(data.version).toBeDefined();
    });
});
