import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

// --- Input Schemas ---

export const ListTimeEntriesInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID'),
});

export const CreateTimeEntryInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID'),
    agent_id: z.number().int().positive().describe('The agent ID logging the time'),
    billable: z.boolean().optional().default(true).describe('Whether this time entry is billable'),
    time_spent: z
        .string()
        .regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format')
        .describe('Time spent in HH:MM format (e.g., "01:30" for 1.5 hours)'),
    note: z.string().optional().describe('Note describing the work done'),
    executed_at: z
        .string()
        .datetime()
        .optional()
        .describe('ISO 8601 datetime when work was done (defaults to current time)'),
});

// --- Tool Definitions ---

export function registerTimeEntryTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_time_entries',
            description: 'List all time tracking entries for a specific ticket. Results are cached for 5 minutes.',
            inputSchema: ListTimeEntriesInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListTimeEntriesInputSchema>) => {
                logger.child({ tool: 'list_time_entries', ticketId: input.ticket_id }).info('Tool invoked');
                const entries = await client.listTimeEntries(input.ticket_id);
                const totalMinutes = entries.reduce((sum, e) => {
                    const [h, m] = e.time_spent.split(':').map(Number);
                    return sum + (h ?? 0) * 60 + (m ?? 0);
                }, 0);
                const summary = `Found ${entries.length} time entries for ticket #${input.ticket_id}. Total time: ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
                return {
                    content: [{ type: 'text', text: summary }],
                    structuredContent: { type: 'object', value: { entries, total_entries: entries.length } },
                };
            },
        },
        {
            name: 'create_time_entry',
            description:
                'Log time worked on a ticket. Time format must be HH:MM (e.g., "01:30" for 1.5 hours).',
            inputSchema: CreateTimeEntryInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof CreateTimeEntryInputSchema>) => {
                const { ticket_id, ...entryData } = input;
                logger
                    .child({ tool: 'create_time_entry', ticketId: ticket_id })
                    .info({ timeSpent: input.time_spent }, 'Tool invoked');
                const entry = await client.createTimeEntry(ticket_id, entryData);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Time entry created for ticket #${ticket_id}. ${input.time_spent} logged (${input.billable ? 'billable' : 'non-billable'}).`,
                        },
                    ],
                    structuredContent: { type: 'object', value: entry },
                };
            },
        },
    ];
}
