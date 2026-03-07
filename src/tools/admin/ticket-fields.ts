import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

export const ListTicketFieldsInputSchema = z.object({});

export function registerTicketFieldTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_ticket_fields',
            description:
                'List all Freshdesk ticket fields (default + custom). Returns field names, types, and validation rules. Results cached for 30 minutes. Use field names when setting custom_fields on tickets.',
            inputSchema: ListTicketFieldsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (_input: z.infer<typeof ListTicketFieldsInputSchema>) => {
                logger.child({ tool: 'list_ticket_fields' }).info('Tool invoked');
                const fields = await client.listTicketFields();
                const customFields = fields.filter((f) => !f.default);
                const summary = fields
                    .map(
                        (f) =>
                            `${f.name} (${f.type})${f.default ? ' [default]' : ' [custom]'}${f.required_for_agents ? ' *required' : ''}`,
                    )
                    .join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${fields.length} ticket fields (${customFields.length} custom):\n${summary}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: { fields, total: fields.length, custom_count: customFields.length } },
                };
            },
        },
    ];
}
