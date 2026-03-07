import pino from 'pino';
import { loadConfig } from './config.js';

const config = loadConfig();

export const logger = pino({
    level: config.logging.level,
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service: 'freshdesk-mcp-server' },
});
