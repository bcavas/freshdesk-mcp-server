import type { FreshdeskClient } from '../client/freshdesk-client.js';
import type { Logger } from 'pino';
import type { ZodTypeAny } from 'zod';
import {
    registerTicketTools,
    registerContactTools,
    registerConversationTools,
    registerAgentTools,
} from './core/index.js';
import { registerKbTools } from './kb/index.js';
import { registerAnalyticsTools } from './analytics/index.js';
import { registerBulkTools } from './bulk/index.js';
import { registerAdminTools } from './admin/index.js';

export type ToolsetName = 'core' | 'kb' | 'analytics' | 'bulk' | 'admin';

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: ZodTypeAny;
    annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (input: any) => Promise<{
        content: { type: string; text: string }[];
        structuredContent?: unknown;
        isError?: boolean;
    }>;
}

type ToolFactory = (client: FreshdeskClient, logger: Logger) => ToolDefinition[];

const TOOLSET_FACTORIES: Record<ToolsetName, ToolFactory> = {
    core: (client, logger) =>
        [
            ...registerTicketTools(client, logger),
            ...registerContactTools(client, logger),
            ...registerConversationTools(client, logger),
            ...registerAgentTools(client, logger),
        ] as ToolDefinition[],
    kb: (client, logger) => registerKbTools(client, logger) as ToolDefinition[],
    analytics: (client, logger) => registerAnalyticsTools(client, logger) as ToolDefinition[],
    bulk: (client, logger) => registerBulkTools(client, logger) as ToolDefinition[],
    admin: (client, logger) => registerAdminTools(client, logger) as ToolDefinition[],
};

export function resolveTools(
    enabledToolsets: string[],
    client: FreshdeskClient,
    logger: Logger,
): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const name of enabledToolsets) {
        const factory = TOOLSET_FACTORIES[name as ToolsetName];
        if (factory) {
            tools.push(...factory(client, logger));
        } else {
            logger.warn({ toolset: name }, 'Unknown toolset name — skipping');
        }
    }
    return tools;
}
