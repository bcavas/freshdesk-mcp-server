import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import type { Agent } from '../../client/types.js';

// --- Input Schemas ---

export const ListAgentsInputSchema = z.object({
    state: z
        .enum(['fulltime', 'occasional'])
        .optional()
        .describe('Agent type filter'),
    group_id: z.number().int().positive().optional().describe('Filter by group ID'),
    page: z.number().int().min(1).optional().default(1),
});

export const GetAgentInputSchema = z.object({
    agent_id: z.number().int().positive().describe('The Freshdesk agent ID'),
});

// --- Formatters ---

function formatAgentSummary(agent: Agent): string {
    return [
        `Agent #${agent.id}: ${agent.contact.name}`,
        `Email: ${agent.contact.email}`,
        `Type: ${agent.type} | Available: ${agent.available}`,
        agent.group_ids?.length ? `Groups: ${agent.group_ids.join(', ')}` : null,
    ]
        .filter(Boolean)
        .join('\n');
}

// --- Tool Definitions ---

export function registerAgentTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_agents',
            description:
                'List all Freshdesk agents. Optionally filter by type (fulltime/occasional) or group. Results are cached for 1 hour.',
            inputSchema: ListAgentsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListAgentsInputSchema>) => {
                logger.child({ tool: 'list_agents' }).info('Tool invoked');
                const result = await client.listAgents({
                    state: input.state,
                    group_id: input.group_id,
                    page: input.page,
                });
                const summary = `Found ${result.data.length} agents`;
                return {
                    content: [{ type: 'text', text: summary }],
                    structuredContent: { type: 'object', value: result },
                };
            },
        },
        {
            name: 'get_agent',
            description: 'Retrieve a single Freshdesk agent by ID with full profile details.',
            inputSchema: GetAgentInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof GetAgentInputSchema>) => {
                logger.child({ tool: 'get_agent', agentId: input.agent_id }).info('Tool invoked');
                const agent = await client.getAgent(input.agent_id);
                return {
                    content: [{ type: 'text', text: formatAgentSummary(agent) }],
                    structuredContent: { type: 'object', value: agent },
                };
            },
        },
    ];
}
