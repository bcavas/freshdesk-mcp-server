import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

export const ListSolutionCategoriesInputSchema = z.object({});

export function registerCategoryTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_solution_folders',
            description:
                'List all solution folders within a knowledge base category.',
            inputSchema: z.object({
                category_id: z.number().int().positive().describe('The solution category ID'),
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: { category_id: number }) => {
                logger.child({ tool: 'list_solution_folders', categoryId: input.category_id }).info('Tool invoked');
                const folders = await client.listSolutionFolders(input.category_id);
                const summary = folders.map((f) => `#${f.id}: ${f.name}`).join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${folders.length} folders in category #${input.category_id}:\n${summary}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: { folders } },
                };
            },
        },
    ];
}
