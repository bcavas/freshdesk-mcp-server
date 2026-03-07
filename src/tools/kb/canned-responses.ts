import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

// --- Input Schemas ---

export const ListCannedResponsesInputSchema = z.object({
    search_term: z
        .string()
        .optional()
        .describe('Client-side filter by title or content keywords'),
});

export const GetCannedResponseInputSchema = z.object({
    canned_response_id: z.number().int().positive().describe('The canned response ID'),
});

// --- Tool Definitions ---

export function registerCannedResponseTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_canned_responses',
            description:
                'List all Freshdesk canned responses. Optionally filter by search_term (client-side). Results are cached for 15 minutes.',
            inputSchema: ListCannedResponsesInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListCannedResponsesInputSchema>) => {
                logger.child({ tool: 'list_canned_responses' }).info('Tool invoked');
                let responses = await client.listCannedResponses();
                if (input.search_term) {
                    const term = input.search_term.toLowerCase();
                    responses = responses.filter(
                        (r) =>
                            r.title.toLowerCase().includes(term) ||
                            r.content.toLowerCase().includes(term),
                    );
                }
                const summary = responses.map((r) => `#${r.id}: ${r.title}`).join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${responses.length} canned responses:\n${summary}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: { responses, total: responses.length } },
                };
            },
        },
        {
            name: 'get_canned_response',
            description: 'Retrieve the full content of a specific canned response by ID.',
            inputSchema: GetCannedResponseInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof GetCannedResponseInputSchema>) => {
                logger
                    .child({ tool: 'get_canned_response', cannedResponseId: input.canned_response_id })
                    .info('Tool invoked');
                const response = await client.getCannedResponse(input.canned_response_id);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Canned Response #${response.id}: "${response.title}"\n\n${response.content}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: response },
                };
            },
        },
    ];
}
