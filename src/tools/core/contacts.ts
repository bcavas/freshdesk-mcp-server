import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import type { Contact } from '../../client/types.js';

// --- Input Schemas ---

export const GetContactInputSchema = z.object({
    contact_id: z.number().int().positive().describe('The Freshdesk contact ID'),
});

export const ListContactsInputSchema = z.object({
    email: z.string().email().optional().describe('Filter by email address'),
    phone: z.string().optional().describe('Filter by phone number'),
    company_id: z.number().int().positive().optional().describe('Filter by company ID'),
    page: z.number().int().min(1).optional().default(1),
    per_page: z.number().int().min(1).max(100).optional().default(30),
});

export const SearchContactsInputSchema = z.object({
    query: z
        .string()
        .min(1)
        .max(512)
        .describe('Search query for contacts. Searches name, email, phone, and company.'),
    page: z.number().int().min(1).optional().default(1),
});

export const CreateContactInputSchema = z.object({
    name: z.string().min(1).max(255).describe('Full name of the contact'),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company_id: z.number().int().positive().optional(),
    description: z.string().optional(),
    job_title: z.string().optional(),
    tags: z.array(z.string()).optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateContactInputSchema = z
    .object({
        contact_id: z.number().int().positive().describe('The Freshdesk contact ID'),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company_id: z.number().int().positive().optional(),
        description: z.string().optional(),
        job_title: z.string().optional(),
        tags: z.array(z.string()).optional(),
        custom_fields: z.record(z.string(), z.unknown()).optional(),
    })
    .refine((data) => {
        const { contact_id: _id, ...updates } = data;
        return Object.keys(updates).length > 0;
    }, 'At least one field to update must be provided besides contact_id');

// --- Formatters ---

function formatContactSummary(contact: Contact): string {
    return [
        `Contact #${contact.id}: ${contact.name}`,
        contact.email ? `Email: ${contact.email}` : null,
        contact.phone ? `Phone: ${contact.phone}` : null,
        contact.job_title ? `Title: ${contact.job_title}` : null,
        contact.tags?.length ? `Tags: ${contact.tags.join(', ')}` : null,
        `Created: ${contact.created_at}`,
    ]
        .filter(Boolean)
        .join('\n');
}

// --- Tool Definitions ---

export function registerContactTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'get_contact',
            description: 'Retrieve a single Freshdesk contact by ID.',
            inputSchema: GetContactInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof GetContactInputSchema>) => {
                logger.child({ tool: 'get_contact', contactId: input.contact_id }).info('Tool invoked');
                const contact = await client.getContact(input.contact_id);
                return {
                    content: [{ type: 'text', text: formatContactSummary(contact) }],
                    structuredContent: { type: 'object', value: contact },
                };
            },
        },
        {
            name: 'list_contacts',
            description:
                'List Freshdesk contacts with optional filtering by email, phone, or company.',
            inputSchema: ListContactsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListContactsInputSchema>) => {
                logger.child({ tool: 'list_contacts' }).info('Tool invoked');
                const result = await client.listContacts(input);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${result.data.length} contacts (page ${result.page}, has_more: ${result.has_more})`,
                        },
                    ],
                    structuredContent: { type: 'object', value: result },
                };
            },
        },
        {
            name: 'search_contacts',
            description: 'Search Freshdesk contacts by name, email, phone, or company.',
            inputSchema: SearchContactsInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof SearchContactsInputSchema>) => {
                logger.child({ tool: 'search_contacts' }).info({ query: input.query }, 'Tool invoked');
                const result = await client.searchContacts(input.query);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${result.total} contacts matching "${input.query}"`,
                        },
                    ],
                    structuredContent: { type: 'object', value: result },
                };
            },
        },
        {
            name: 'create_contact',
            description:
                'Create a new Freshdesk contact. At minimum, provide a name. Email is recommended for ticket routing.',
            inputSchema: CreateContactInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof CreateContactInputSchema>) => {
                logger.child({ tool: 'create_contact' }).info({ name: input.name }, 'Tool invoked');
                const contact = await client.createContact(input);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Contact created successfully!\n${formatContactSummary(contact)}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: contact },
                };
            },
        },
        {
            name: 'update_contact',
            description: 'Update a Freshdesk contact. Provide only the fields you want to change.',
            inputSchema: UpdateContactInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof UpdateContactInputSchema>) => {
                const { contact_id, ...updates } = input;
                logger.child({ tool: 'update_contact', contactId: contact_id }).info('Tool invoked');
                const contact = await client.updateContact(contact_id, updates);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Contact #${contact_id} updated successfully.\n${formatContactSummary(contact)}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: contact },
                };
            },
        },
    ];
}
