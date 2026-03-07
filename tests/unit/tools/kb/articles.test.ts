import { describe, it, expect } from 'vitest';

describe('Article Tool Schemas', () => {
    describe('CreateSolutionArticleInputSchema', () => {
        it('requires folder_id, title, and description', async () => {
            const { CreateSolutionArticleInputSchema } = await import(
                '../../../../src/tools/kb/articles.js'
            );
            const valid = CreateSolutionArticleInputSchema.safeParse({
                folder_id: 5,
                title: 'How to reset password',
                description: '<p>Steps to reset your password</p>',
            });
            expect(valid.success).toBe(true);

            const missing = CreateSolutionArticleInputSchema.safeParse({
                folder_id: 5,
                title: 'Title only',
            });
            expect(missing.success).toBe(false);
        });

        it('defaults status to 2 (published)', async () => {
            const { CreateSolutionArticleInputSchema } = await import(
                '../../../../src/tools/kb/articles.js'
            );
            const result = CreateSolutionArticleInputSchema.safeParse({
                folder_id: 5,
                title: 'Title',
                description: '<p>Content</p>',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe(2);
            }
        });
    });

    describe('DeleteSolutionArticleInputSchema', () => {
        it('requires article_id', async () => {
            const { DeleteSolutionArticleInputSchema } = await import(
                '../../../../src/tools/kb/articles.js'
            );
            expect(
                DeleteSolutionArticleInputSchema.safeParse({ article_id: 1001 }).success,
            ).toBe(true);
            expect(DeleteSolutionArticleInputSchema.safeParse({}).success).toBe(false);
        });
    });
});
