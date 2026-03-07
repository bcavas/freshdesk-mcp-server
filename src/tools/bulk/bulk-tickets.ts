import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import { TicketStatus, TicketPriority } from '../../client/types.js';

// --- Input Schemas ---

export const BulkUpdateTicketsInputSchema = z
    .object({
        ticket_ids: z
            .array(z.number().int().positive())
            .min(1)
            .max(25)
            .describe('Array of ticket IDs to update (max 25)'),
        status: z.nativeEnum(TicketStatus).optional(),
        priority: z.nativeEnum(TicketPriority).optional(),
        group_id: z.number().int().positive().optional(),
        responder_id: z.number().int().positive().optional(),
        type: z.string().optional(),
    })
    .refine((data) => {
        const { ticket_ids: _ids, ...updates } = data;
        return Object.keys(updates).length > 0;
    }, 'At least one property to update must be provided');

export const DeleteTicketInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID to delete'),
});

// --- Tool Definitions ---

export function registerBulkTicketTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'bulk_update_tickets',
            description:
                'Update multiple Freshdesk tickets in a single operation. Max 25 tickets per call. Returns a job ID for async tracking.',
            inputSchema: BulkUpdateTicketsInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof BulkUpdateTicketsInputSchema>) => {
                const { ticket_ids, ...properties } = input;
                logger
                    .child({ tool: 'bulk_update_tickets' })
                    .info({ count: ticket_ids.length }, 'Tool invoked');
                const jobStatus = await client.bulkUpdateTickets(
                    ticket_ids,
                    properties as Partial<import('../../client/types.js').Ticket>,
                );
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Bulk update started for ${ticket_ids.length} tickets. Job ID: ${jobStatus.job_id}. Status: ${jobStatus.status}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: jobStatus },
                };
            },
        },
        {
            name: 'delete_ticket',
            description:
                'Permanently delete a Freshdesk ticket. This action cannot be undone. Use with caution.',
            inputSchema: DeleteTicketInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof DeleteTicketInputSchema>) => {
                logger
                    .child({ tool: 'delete_ticket', ticketId: input.ticket_id })
                    .warn('Tool invoked — destructive action');
                await client.deleteTicket(input.ticket_id);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Ticket #${input.ticket_id} has been permanently deleted.`,
                        },
                    ],
                    structuredContent: { type: 'object', value: { deleted: true, ticket_id: input.ticket_id } },
                };
            },
        },
    ];
}
