import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

// --- Input Schemas ---

export const ListSolutionCategoriesInputSchema = z.object({}).describe('No input required');

export const ListSolutionArticlesInputSchema = z.object({
    folder_id: z.number().int().positive().describe('The solution folder ID'),
    page: z.number().int().min(1).optional().default(1),
});

export const GetSolutionArticleInputSchema = z.object({
    article_id: z.number().int().positive().describe('The solution article ID'),
});

export const CreateSolutionArticleInputSchema = z.object({
    folder_id: z.number().int().positive().describe('The folder ID to create the article in'),
    title: z.string().min(1).max(255).describe('Article title'),
    description: z.string().min(1).describe('HTML content of the article'),
    status: z
        .union([z.literal(1), z.literal(2)])
        .optional()
        .default(2)
        .describe('1 = draft, 2 = published'),
    tags: z.array(z.string()).optional(),
    seo_data: z
        .object({
            meta_title: z.string().optional(),
            meta_description: z.string().optional(),
            meta_keywords: z.array(z.string()).optional(),
        })
        .optional(),
});

export const UpdateSolutionArticleInputSchema = z
    .object({
        article_id: z.number().int().positive().describe('The solution article ID'),
        title: z.string().min(1).max(255).optional(),
        description: z.string().min(1).optional(),
        status: z.union([z.literal(1), z.literal(2)]).optional().describe('1 = draft, 2 = published'),
        tags: z.array(z.string()).optional(),
    })
    .refine((data) => {
        const { article_id: _id, ...updates } = data;
        return Object.keys(updates).length > 0;
    }, 'At least one field to update must be provided');

export const DeleteSolutionArticleInputSchema = z.object({
    article_id: z.number().int().positive().describe('The solution article ID to delete'),
});

// --- Tool Definitions ---

export function registerArticleTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_solution_categories',
            description:
                'List all solution categories in the Freshdesk knowledge base. Returns category IDs needed to list articles.',
            inputSchema: ListSolutionCategoriesInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (_input: z.infer<typeof ListSolutionCategoriesInputSchema>) => {
                logger.child({ tool: 'list_solution_categories' }).info('Tool invoked');
                const categories = await client.listSolutionCategories();
                const summary = categories
                    .map((c) => `Category #${c.id}: ${c.name}`)
                    .join('\n');
                return {
                    content: [
                        { type: 'text', text: `Found ${categories.length} solution categories:\n${summary}` },
                    ],
                    structuredContent: { type: 'object', value: { categories } },
                };
            },
        },
        {
            name: 'list_solution_articles',
            description:
                'List knowledge base articles in a specific folder. Use list_solution_categories first to find folder IDs.',
            inputSchema: ListSolutionArticlesInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListSolutionArticlesInputSchema>) => {
                logger.child({ tool: 'list_solution_articles', folderId: input.folder_id }).info('Tool invoked');
                const articles = await client.listSolutionArticles(input.folder_id);
                const summary = articles.map((a) => `Article #${a.id}: ${a.title}`).join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${articles.length} articles in folder #${input.folder_id}:\n${summary}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: { articles, total: articles.length } },
                };
            },
        },
        {
            name: 'get_solution_article',
            description: 'Retrieve the full content of a knowledge base article by ID.',
            inputSchema: GetSolutionArticleInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof GetSolutionArticleInputSchema>) => {
                logger.child({ tool: 'get_solution_article', articleId: input.article_id }).info('Tool invoked');
                const article = await client.getSolutionArticle(input.article_id);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Article #${article.id}: ${article.title}\nStatus: ${article.status === 2 ? 'Published' : 'Draft'}\nHits: ${article.hits} | 👍 ${article.thumbs_up} | 👎 ${article.thumbs_down}\n\n${article.description_text?.substring(0, 500) ?? ''}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: article },
                };
            },
        },
        {
            name: 'create_solution_article',
            description:
                'Create a new knowledge base article in a specific folder. Status 1 = draft, 2 = published.',
            inputSchema: CreateSolutionArticleInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof CreateSolutionArticleInputSchema>) => {
                logger.child({ tool: 'create_solution_article' }).info({ title: input.title }, 'Tool invoked');
                const { folder_id, ...articleData } = input;
                const article = await client.createSolutionArticle(folder_id, articleData);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Article created successfully! ID: ${article.id}, Title: "${article.title}"`,
                        },
                    ],
                    structuredContent: { type: 'object', value: article },
                };
            },
        },
        {
            name: 'update_solution_article',
            description:
                'Update an existing knowledge base article. Provide only the fields you want to change.',
            inputSchema: UpdateSolutionArticleInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof UpdateSolutionArticleInputSchema>) => {
                const { article_id, ...updates } = input;
                logger.child({ tool: 'update_solution_article', articleId: article_id }).info('Tool invoked');
                const article = await client.updateSolutionArticle(article_id, updates);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Article #${article_id} updated successfully. Title: "${article.title}"`,
                        },
                    ],
                    structuredContent: { type: 'object', value: article },
                };
            },
        },
        {
            name: 'delete_solution_article',
            description:
                'Permanently delete a knowledge base article. This action cannot be undone.',
            inputSchema: DeleteSolutionArticleInputSchema,
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof DeleteSolutionArticleInputSchema>) => {
                logger.child({ tool: 'delete_solution_article', articleId: input.article_id }).info('Tool invoked');
                await client.deleteSolutionArticle(input.article_id);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Article #${input.article_id} has been permanently deleted.`,
                        },
                    ],
                    structuredContent: { type: 'object', value: { deleted: true, article_id: input.article_id } },
                };
            },
        },
    ];
}
