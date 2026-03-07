import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import { TicketStatus, TicketPriority } from '../../client/types.js';
import type { Ticket } from '../../client/types.js';

// --- Input Schemas ---

export const GetTicketInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID'),
    include: z
        .array(z.enum(['conversations', 'requester', 'company', 'stats']))
        .optional()
        .describe('Related data to include. Each inclusion costs extra API credits.'),
});

export const ListTicketsInputSchema = z.object({
    filter: z
        .enum(['new_and_my_open', 'watching', 'spam', 'deleted', 'all_tickets'])
        .optional()
        .default('all_tickets')
        .describe('Predefined ticket filter'),
    page: z.number().int().min(1).optional().default(1),
    per_page: z.number().int().min(1).max(100).optional().default(30),
    order_by: z
        .enum(['created_at', 'due_by', 'updated_at', 'status'])
        .optional()
        .default('created_at'),
    order_type: z.enum(['asc', 'desc']).optional().default('desc'),
    updated_since: z
        .string()
        .datetime()
        .optional()
        .describe('ISO 8601 datetime — only return tickets updated after this time'),
});

export const SearchTicketsInputSchema = z.object({
    query: z
        .string()
        .min(1)
        .max(512)
        .describe(
            "Freshdesk search query. Examples: \"status:2 AND priority:3\", \"tag:'billing'\", \"requester_id:12345\". Supported fields: agent_id, group_id, priority, status, tag, type, due_by, fr_due_by, created_at, requester_id, company_id.",
        ),
    page: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(1)
        .describe('Page number (max 10 pages × 30 results = 300 total)'),
});

export const UpdateTicketInputSchema = z
    .object({
        ticket_id: z.number().int().positive(),
        status: z.nativeEnum(TicketStatus).optional(),
        priority: z.nativeEnum(TicketPriority).optional(),
        group_id: z.number().int().positive().optional(),
        responder_id: z.number().int().positive().optional(),
        type: z.string().optional(),
        tags: z.array(z.string()).optional(),
        custom_fields: z.record(z.string(), z.unknown()).optional(),
    })
    .refine(
        (data) => {
            const { ticket_id: _id, ...updates } = data;
            return Object.keys(updates).length > 0;
        },
        { message: 'At least one field to update must be provided besides ticket_id' },
    );

export const CreateTicketInputSchema = z
    .object({
        subject: z.string().min(1).max(255),
        description: z.string().min(1).describe('HTML content of the ticket'),
        email: z
            .string()
            .email()
            .optional()
            .describe('Requester email (creates contact if new)'),
        requester_id: z.number().int().positive().optional(),
        priority: z.nativeEnum(TicketPriority).optional().default(TicketPriority.Low),
        status: z.nativeEnum(TicketStatus).optional().default(TicketStatus.Open),
        type: z.string().optional(),
        group_id: z.number().int().positive().optional(),
        responder_id: z.number().int().positive().optional(),
        tags: z.array(z.string()).optional(),
        cc_emails: z.array(z.string().email()).optional(),
        custom_fields: z.record(z.string(), z.unknown()).optional(),
    })
    .refine((data) => data.email || data.requester_id, {
        message: 'Either email or requester_id is required',
    });

export const DeleteTicketInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID to delete'),
});

// --- Formatters ---

function formatTicketSummary(ticket: Ticket): string {
    const statusNames: Record<number, string> = {
        2: 'Open',
        3: 'Pending',
        4: 'Resolved',
        5: 'Closed',
    };
    const priorityNames: Record<number, string> = {
        1: 'Low',
        2: 'Medium',
        3: 'High',
        4: 'Urgent',
    };
    return [
        `Ticket #${ticket.id}: ${ticket.subject}`,
        `Status: ${statusNames[ticket.status] ?? ticket.status} | Priority: ${priorityNames[ticket.priority] ?? ticket.priority}`,
        `Created: ${ticket.created_at} | Updated: ${ticket.updated_at}`,
        ticket.tags?.length ? `Tags: ${ticket.tags.join(', ')}` : null,
        ticket.description_text
            ? `\nDescription: ${ticket.description_text.substring(0, 200)}${ticket.description_text.length > 200 ? '...' : ''}`
            : null,
    ]
        .filter(Boolean)
        .join('\n');
}

// --- Tool Definitions ---

export function registerTicketTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'get_ticket',
            description:
                'Retrieve a single Freshdesk ticket by ID with optional related data (conversations, requester, company, stats). Use include=["stats"] to get SLA timestamps. Use include=["conversations"] to get the full thread.',
            inputSchema: GetTicketInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof GetTicketInputSchema>) => {
                const reqLogger = logger.child({ tool: 'get_ticket', ticketId: input.ticket_id });
                reqLogger.info('Tool invoked');
                const ticket = await client.getTicket(input.ticket_id, input.include);
                return {
                    content: [{ type: 'text', text: formatTicketSummary(ticket) }],
                    structuredContent: { type: 'object', value: ticket },
                };
            },
        },
        {
            name: 'list_tickets',
            description:
                'List Freshdesk tickets with filtering, sorting, and pagination. Returns up to 100 tickets per page. Use updated_since to get recent changes only. Default sort: newest first.',
            inputSchema: ListTicketsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListTicketsInputSchema>) => {
                const reqLogger = logger.child({ tool: 'list_tickets' });
                reqLogger.info({ filter: input.filter, page: input.page }, 'Tool invoked');
                const result = await client.listTickets({
                    filter: input.filter,
                    page: input.page,
                    per_page: input.per_page,
                    order_by: input.order_by,
                    order_type: input.order_type,
                    updated_since: input.updated_since,
                });
                const summary = `Found ${result.data.length} tickets (page ${result.page}, has_more: ${result.has_more})`;
                return {
                    content: [{ type: 'text', text: summary }],
                    structuredContent: { type: 'object', value: result },
                };
            },
        },
        {
            name: 'search_tickets',
            description:
                "Search tickets using Freshdesk query language. Max 300 results total (30/page × 10 pages). Query syntax: \"status:2 AND priority:4\" for open+urgent. Searchable: agent_id, group_id, priority, status, tag, type, due_by, fr_due_by, created_at, updated_at, requester_id, company_id. Date format: 'YYYY-MM-DD'.",
            inputSchema: SearchTicketsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof SearchTicketsInputSchema>) => {
                const reqLogger = logger.child({ tool: 'search_tickets' });
                reqLogger.info({ query: input.query }, 'Tool invoked');
                const result = await client.searchTickets(input.query, input.page);
                const summary = `Found ${result.total} total tickets matching "${input.query}" (showing ${result.results.length} results)`;
                return {
                    content: [{ type: 'text', text: summary }],
                    structuredContent: { type: 'object', value: result },
                };
            },
        },
        {
            name: 'update_ticket',
            description:
                "Update a ticket's properties (status, priority, assignment, tags, custom fields). Cannot update subject or description of outbound tickets. Provide only the fields you want to change.",
            inputSchema: UpdateTicketInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof UpdateTicketInputSchema>) => {
                const { ticket_id, ...updates } = input;
                const reqLogger = logger.child({ tool: 'update_ticket', ticketId: ticket_id });
                reqLogger.info('Tool invoked');
                const ticket = await client.updateTicket(ticket_id, updates);
                return {
                    content: [{ type: 'text', text: `Ticket #${ticket_id} updated successfully.\n${formatTicketSummary(ticket)}` }],
                    structuredContent: { type: 'object', value: ticket },
                };
            },
        },
        {
            name: 'create_ticket',
            description:
                'Create a new support ticket. Requires either email (auto-creates contact) or requester_id. Returns the created ticket with its ID. Use for programmatic ticket creation, not customer replies.',
            inputSchema: CreateTicketInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof CreateTicketInputSchema>) => {
                const reqLogger = logger.child({ tool: 'create_ticket' });
                reqLogger.info({ subject: input.subject }, 'Tool invoked');
                const ticket = await client.createTicket(input);
                return {
                    content: [{ type: 'text', text: `Ticket created successfully!\n${formatTicketSummary(ticket)}` }],
                    structuredContent: { type: 'object', value: ticket },
                };
            },
        },
    ];
}
