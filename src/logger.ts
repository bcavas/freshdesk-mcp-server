import pino from 'pino';
import { loadConfig } from './config.js';
import { requestContext } from './context.js';

const config = loadConfig();

export const logger = pino({
    level: config.logging.level,
    formatters: {
        level: (label) => ({ level: label }),
    },
    mixin() {
        const ctx = requestContext.getStore();
        if (!ctx) return {};
        const mix: Record<string, string> = {};
        if (ctx.sessionId) {
            mix.sessionId = ctx.sessionId;
        }
        if (ctx.traceContext) {
            const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'local-dev';
            const traceId = ctx.traceContext.split('/')[0];
            if (traceId) {
                mix['logging.googleapis.com/trace'] = `projects/${projectId}/traces/${traceId}`;
            }
        }
        return mix;
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service: 'freshdesk-mcp-server' },
});

