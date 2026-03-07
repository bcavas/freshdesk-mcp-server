import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

// --- Input Schemas ---

export const ListSatisfactionRatingsInputSchema = z.object({
    created_since: z
        .string()
        .datetime()
        .optional()
        .describe('ISO 8601 datetime — only return ratings created after this time'),
    created_until: z
        .string()
        .datetime()
        .optional()
        .describe('ISO 8601 datetime — only return ratings created before this time'),
    page: z.number().int().min(1).optional().default(1),
});

export const GetTicketSatisfactionInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID'),
});

// --- Tool Definitions ---

export function registerSatisfactionTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_satisfaction_ratings',
            description:
                'List CSAT (customer satisfaction) survey ratings. Optionally filter by date range.',
            inputSchema: ListSatisfactionRatingsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListSatisfactionRatingsInputSchema>) => {
                logger.child({ tool: 'list_satisfaction_ratings' }).info('Tool invoked');
                const result = await client.listSatisfactionRatings(input);
                const total = result.data.length;
                const avgRating =
                    total > 0
                        ? result.data.reduce((sum, r) => {
                            const vals = Object.values(r.ratings ?? {});
                            return sum + (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
                        }, 0) / total
                        : 0;
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${total} satisfaction ratings. Average rating: ${avgRating.toFixed(2)}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: result },
                };
            },
        },
        {
            name: 'get_ticket_satisfaction',
            description: 'Get the CSAT survey rating for a specific ticket.',
            inputSchema: GetTicketSatisfactionInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof GetTicketSatisfactionInputSchema>) => {
                logger
                    .child({ tool: 'get_ticket_satisfaction', ticketId: input.ticket_id })
                    .info('Tool invoked');
                // Use the general satisfaction ratings endpoint filtered by ticket
                const result = await client.listSatisfactionRatings({});
                const ticketRating = result.data.find((r) => r.ticket_id === input.ticket_id);
                if (!ticketRating) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `No satisfaction rating found for ticket #${input.ticket_id}.`,
                            },
                        ],
                        structuredContent: { type: 'object', value: { found: false } },
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Satisfaction rating for ticket #${input.ticket_id}:\nFeedback: ${ticketRating.feedback ?? 'None'}\nRatings: ${JSON.stringify(ticketRating.ratings)}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: ticketRating },
                };
            },
        },
    ];
}
