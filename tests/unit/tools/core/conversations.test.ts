import { describe, it, expect } from 'vitest';

describe('Conversation Tool Schemas', () => {
    describe('ReplyToTicketInputSchema', () => {
        it('requires ticket_id and body', async () => {
            const { ReplyToTicketInputSchema } = await import(
                '../../../../src/tools/core/conversations.js'
            );
            expect(
                ReplyToTicketInputSchema.safeParse({ ticket_id: 1, body: '<p>Reply</p>' }).success,
            ).toBe(true);
            expect(ReplyToTicketInputSchema.safeParse({ ticket_id: 1 }).success).toBe(false);
            expect(ReplyToTicketInputSchema.safeParse({ body: '<p>Reply</p>' }).success).toBe(false);
        });

        it('validates cc_emails format', async () => {
            const { ReplyToTicketInputSchema } = await import(
                '../../../../src/tools/core/conversations.js'
            );
            const valid = ReplyToTicketInputSchema.safeParse({
                ticket_id: 1,
                body: '<p>Reply</p>',
                cc_emails: ['cc@example.com'],
            });
            expect(valid.success).toBe(true);

            const invalid = ReplyToTicketInputSchema.safeParse({
                ticket_id: 1,
                body: '<p>Reply</p>',
                cc_emails: ['not-an-email'],
            });
            expect(invalid.success).toBe(false);
        });
    });

    describe('AddNoteInputSchema', () => {
        it('defaults private to true', async () => {
            const { AddNoteInputSchema } = await import('../../../../src/tools/core/conversations.js');
            const result = AddNoteInputSchema.safeParse({ ticket_id: 1, body: '<p>Note</p>' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.private).toBe(true);
            }
        });
    });
});
