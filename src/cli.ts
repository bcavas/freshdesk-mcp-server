#!/usr/bin/env node
import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';

const rawConfig = loadConfig();

// Override transport for stdio mode
const config = {
    ...rawConfig,
    server: { ...rawConfig.server, transport: 'stdio' as const },
};

const server = createServer(config);
const transport = new StdioServerTransport();

await server.connect(transport);
