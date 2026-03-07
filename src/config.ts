import { z } from 'zod';
import * as dotenv from 'dotenv';

export const ConfigSchema = z.object({
    freshdesk: z.object({
        domain: z.string().min(1, 'FRESHDESK_DOMAIN is required'),
        apiKey: z.string().min(1, 'FRESHDESK_API_KEY is required'),
        baseUrl: z.string().url(),
    }),
    server: z.object({
        transport: z.enum(['stdio', 'streamable-http']).default('streamable-http'),
        /** Default port for local development. At runtime on Cloud Run, process.env.PORT overrides this via src/index.ts. */
        port: z.number().int().min(1).max(65535).default(3000),
        host: z.string().default('0.0.0.0'),
    }),
    toolsets: z.object({
        enabled: z.array(z.enum(['core', 'kb', 'analytics', 'bulk', 'admin'])).default(['core']),
    }),
    rateLimit: z.object({
        bufferPercent: z.number().min(0).max(50).default(20),
    }),
    logging: z.object({
        level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
    }),
    security: z.object({
        licenseKeyRequired: z.boolean().default(false),
        redactFields: z.array(z.string()).default(['phone', 'mobile', 'twitter_id']),
    }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
    dotenv.config();
    const domain = process.env.FRESHDESK_DOMAIN ?? '';
    const raw = {
        freshdesk: {
            domain,
            apiKey: process.env.FRESHDESK_API_KEY ?? '',
            baseUrl: `https://${domain}.freshdesk.com/api/v2`,
        },
        server: {
            transport: process.env.MCP_TRANSPORT ?? 'streamable-http',
            port: parseInt(process.env.MCP_PORT ?? '3000', 10),
            host: process.env.MCP_HOST ?? '0.0.0.0',
        },
        toolsets: {
            enabled: (process.env.MCP_ENABLED_TOOLSETS ?? 'core').split(',').map((s) => s.trim()),
        },
        rateLimit: {
            bufferPercent: parseInt(process.env.RATE_LIMIT_BUFFER_PERCENT ?? '20', 10),
        },
        logging: {
            level: process.env.LOG_LEVEL ?? 'info',
        },
        security: {
            licenseKeyRequired: process.env.LICENSE_KEY_REQUIRED === 'true',
            redactFields: process.env.REDACT_FIELDS?.split(',').map((s) => s.trim()) ?? [
                'phone',
                'mobile',
                'twitter_id',
            ],
        },
    };
    return Object.freeze(ConfigSchema.parse(raw));
}
