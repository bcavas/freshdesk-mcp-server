import { describe, it, expect } from 'vitest';

describe('Bulk Ticket Tool Schemas', () => {
    describe('BulkUpdateTicketsInputSchema', () => {
        it('requires at least 1 ticket_id', async () => {
            const { BulkUpdateTicketsInputSchema } = await import(
                '../../../../src/tools/bulk/bulk-tickets.js'
            );
            expect(
                BulkUpdateTicketsInputSchema.safeParse({ ticket_ids: [], status: 4 }).success,
            ).toBe(false);
            expect(
                BulkUpdateTicketsInputSchema.safeParse({ ticket_ids: [1], status: 4 }).success,
            ).toBe(true);
        });

        it('caps at 25 ticket_ids', async () => {
            const { BulkUpdateTicketsInputSchema } = await import(
                '../../../../src/tools/bulk/bulk-tickets.js'
            );
            const tooMany = Array.from({ length: 26 }, (_, i) => i + 1);
            expect(
                BulkUpdateTicketsInputSchema.safeParse({ ticket_ids: tooMany, status: 4 }).success,
            ).toBe(false);

            const exactly25 = Array.from({ length: 25 }, (_, i) => i + 1);
            expect(
                BulkUpdateTicketsInputSchema.safeParse({
                    ticket_ids: exactly25,
                    status: 4,
                }).success,
            ).toBe(true);
        });

        it('requires at least one property beside ticket_ids', async () => {
            const { BulkUpdateTicketsInputSchema } = await import(
                '../../../../src/tools/bulk/bulk-tickets.js'
            );
            expect(
                BulkUpdateTicketsInputSchema.safeParse({ ticket_ids: [1, 2] }).success,
            ).toBe(false);
        });
    });

    describe('DeleteTicketInputSchema', () => {
        it('requires a positive integer ticket_id', async () => {
            const { DeleteTicketInputSchema } = await import(
                '../../../../src/tools/bulk/bulk-tickets.js'
            );
            expect(DeleteTicketInputSchema.safeParse({ ticket_id: 1 }).success).toBe(true);
            expect(DeleteTicketInputSchema.safeParse({ ticket_id: 0 }).success).toBe(false);
            expect(DeleteTicketInputSchema.safeParse({}).success).toBe(false);
        });
    });
});
