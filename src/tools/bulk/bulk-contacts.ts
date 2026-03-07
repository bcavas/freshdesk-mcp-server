import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

// --- Input Schemas ---

export const MergeContactsInputSchema = z.object({
    primary_contact_id: z
        .number()
        .int()
        .positive()
        .describe('The primary contact ID (this one is kept)'),
    secondary_contact_ids: z
        .array(z.number().int().positive())
        .min(1)
        .max(10)
        .describe('Contact IDs to merge into the primary (these are deleted after merge)'),
});

// --- Tool Definitions ---

export function registerBulkContactTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'merge_contacts',
            description:
                'Merge duplicate contacts into a primary contact. The secondary contacts are deleted after the merge. This action cannot be undone.',
            inputSchema: MergeContactsInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof MergeContactsInputSchema>) => {
                logger
                    .child({ tool: 'merge_contacts', primaryId: input.primary_contact_id })
                    .warn({ secondaryIds: input.secondary_contact_ids }, 'Tool invoked — destructive action');

                // Use the contact merge endpoint
                await client.request('POST', `/contacts/${input.primary_contact_id}/merge`, {
                    body: { contact: { secondary_ids: input.secondary_contact_ids } },
                });

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Successfully merged contacts ${input.secondary_contact_ids.join(', ')} into contact #${input.primary_contact_id}.`,
                        },
                    ],
                    structuredContent: {
                        type: 'object',
                        value: {
                            merged: true,
                            primary_contact_id: input.primary_contact_id,
                            merged_contact_ids: input.secondary_contact_ids,
                        },
                    },
                };
            },
        },
    ];
}
