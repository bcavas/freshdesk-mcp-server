import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

export const ListGroupsInputSchema = z.object({});

export function registerGroupTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_groups',
            description:
                'List all Freshdesk agent groups. Results are cached for 1 hour. Use group IDs from here to assign tickets or filter agents.',
            inputSchema: ListGroupsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (_input: z.infer<typeof ListGroupsInputSchema>) => {
                logger.child({ tool: 'list_groups' }).info('Tool invoked');
                const groups = await client.listGroups();
                const summary = groups.map((g) => `#${g.id}: ${g.name} (${g.agent_ids?.length ?? 0} agents)`).join('\n');
                return {
                    content: [
                        { type: 'text', text: `Found ${groups.length} groups:\n${summary}` },
                    ],
                    structuredContent: { type: 'object', value: { groups } },
                };
            },
        },
    ];
}
