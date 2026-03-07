import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

// --- Input Schemas ---

export const ListConversationsInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID'),
    page: z.number().int().min(1).optional().default(1),
    per_page: z.number().int().min(1).max(100).optional().default(30),
});

export const ReplyToTicketInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID'),
    body: z.string().min(1).describe('HTML content of the reply'),
    cc_emails: z.array(z.string().email()).optional().describe('CC email addresses'),
    bcc_emails: z.array(z.string().email()).optional().describe('BCC email addresses'),
});

export const AddNoteInputSchema = z.object({
    ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID'),
    body: z.string().min(1).describe('HTML content of the note'),
    private: z.boolean().optional().default(true).describe('Whether the note is private (agents-only)'),
    notify_emails: z
        .array(z.string().email())
        .optional()
        .describe('Agent email addresses to notify'),
});

// --- Tool Definitions ---

export function registerConversationTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_conversations',
            description:
                'List all conversations (replies and notes) for a ticket. Returns the full email thread and any agent notes.',
            inputSchema: ListConversationsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListConversationsInputSchema>) => {
                logger
                    .child({ tool: 'list_conversations', ticketId: input.ticket_id })
                    .info('Tool invoked');
                const conversations = await client.listConversations(input.ticket_id);
                const summary = `Found ${conversations.length} conversations for ticket #${input.ticket_id}`;
                return {
                    content: [{ type: 'text', text: summary }],
                    structuredContent: { type: 'object', value: { conversations, total: conversations.length } },
                };
            },
        },
        {
            name: 'reply_to_ticket',
            description:
                'Send a reply to a Freshdesk ticket. The reply is sent to the requester and any CC/BCC addresses. Use HTML for formatting.',
            inputSchema: ReplyToTicketInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ReplyToTicketInputSchema>) => {
                logger
                    .child({ tool: 'reply_to_ticket', ticketId: input.ticket_id })
                    .info('Tool invoked');
                const conversation = await client.replyToTicket(input.ticket_id, {
                    body: input.body,
                    cc_emails: input.cc_emails,
                    bcc_emails: input.bcc_emails,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Reply sent successfully to ticket #${input.ticket_id}. Conversation ID: ${conversation.id}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: conversation },
                };
            },
        },
        {
            name: 'add_note',
            description:
                'Add an internal note to a Freshdesk ticket. By default, notes are private (visible only to agents). Set private=false for customer-visible notes.',
            inputSchema: AddNoteInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof AddNoteInputSchema>) => {
                logger.child({ tool: 'add_note', ticketId: input.ticket_id }).info('Tool invoked');
                const note = await client.addNote(input.ticket_id, {
                    body: input.body,
                    private: input.private,
                    notify_emails: input.notify_emails,
                });
                const visibility = input.private ? 'private' : 'public';
                return {
                    content: [
                        {
                            type: 'text',
                            text: `${visibility.charAt(0).toUpperCase() + visibility.slice(1)} note added to ticket #${input.ticket_id}. Note ID: ${note.id}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: note },
                };
            },
        },
    ];
}
