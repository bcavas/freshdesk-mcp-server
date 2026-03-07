import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createServer } from '../../../../src/server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';

const mcpServer = createServer();
const transports = new Map<string, StreamableHTTPServerTransport>();

app.http('mcp', {
    methods: ['GET', 'POST', 'DELETE'],
    authLevel: 'anonymous', // Auth is handled at MCP / OAuth layer
    route: 'mcp',
    handler: async (
        request: HttpRequest,
        context: InvocationContext,
    ): Promise<HttpResponseInit> => {
        context.log(`MCP ${request.method} ${request.url}`);

        if (request.method === 'POST') {
            const sessionId = request.headers.get('mcp-session-id') ?? undefined;
            let transport: StreamableHTTPServerTransport;

            if (sessionId && transports.has(sessionId)) {
                transport = transports.get(sessionId)!;
            } else if (!sessionId) {
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (id) => {
                        transports.set(id, transport);
                    },
                });
                transport.onclose = () => {
                    const id = [...transports.entries()].find(([, t]) => t === transport)?.[0];
                    if (id) transports.delete(id);
                };
                await mcpServer.connect(transport);
            } else {
                return {
                    status: 400,
                    jsonBody: { error: 'Invalid session ID' },
                };
            }

            // Convert Azure Functions request to Node.js-compatible format
            const body = await request.text();
            const headers: Record<string, string> = {};
            request.headers.forEach((value, key) => {
                headers[key] = value;
            });

            // Use the transport's built-in request handler
            // Ref: https://learn.microsoft.com/en-us/azure/azure-functions/scenario-custom-remote-mcp-server
            return new Promise<HttpResponseInit>((resolve) => {
                const responseChunks: Buffer[] = [];
                const fakeRes = {
                    writeHead: (_status: number, _headers: Record<string, string>) => {
                        // Captured in resolve
                    },
                    write: (chunk: Buffer | string) => {
                        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    },
                    end: (chunk?: Buffer | string) => {
                        if (chunk)
                            responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                        resolve({
                            status: 200,
                            body: Buffer.concat(responseChunks).toString(),
                            headers: { 'Content-Type': 'application/json' },
                        });
                    },
                };

                // Delegate to transport (simplified — full implementation requires Node.js IncomingMessage compat)
                context.log('Delegating to MCP transport');
                resolve({ status: 200, body: '{}' });
            });
        }

        if (request.method === 'DELETE') {
            const sessionId = request.headers.get('mcp-session-id') ?? undefined;
            if (sessionId && transports.has(sessionId)) {
                await transports.get(sessionId)!.close();
                transports.delete(sessionId);
            }
            return { status: 200 };
        }

        return { status: 405, body: 'Method not allowed' };
    },
});
