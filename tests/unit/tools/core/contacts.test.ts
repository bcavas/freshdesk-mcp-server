import { describe, it, expect } from 'vitest';

describe('Contact Tool Schemas', () => {
    describe('GetContactInputSchema', () => {
        it('requires a positive integer contact_id', async () => {
            const { GetContactInputSchema } = await import('../../../../src/tools/core/contacts.js');
            expect(GetContactInputSchema.safeParse({ contact_id: 1 }).success).toBe(true);
            expect(GetContactInputSchema.safeParse({ contact_id: 0 }).success).toBe(false);
            expect(GetContactInputSchema.safeParse({ contact_id: -1 }).success).toBe(false);
            expect(GetContactInputSchema.safeParse({}).success).toBe(false);
        });
    });

    describe('CreateContactInputSchema', () => {
        it('requires name', async () => {
            const { CreateContactInputSchema } = await import('../../../../src/tools/core/contacts.js');
            expect(CreateContactInputSchema.safeParse({ name: 'Jane' }).success).toBe(true);
            expect(CreateContactInputSchema.safeParse({}).success).toBe(false);
            expect(CreateContactInputSchema.safeParse({ name: '' }).success).toBe(false);
        });

        it('validates email format if provided', async () => {
            const { CreateContactInputSchema } = await import('../../../../src/tools/core/contacts.js');
            const withValidEmail = CreateContactInputSchema.safeParse({
                name: 'Jane',
                email: 'jane@example.com',
            });
            expect(withValidEmail.success).toBe(true);

            const withBadEmail = CreateContactInputSchema.safeParse({
                name: 'Jane',
                email: 'not-an-email',
            });
            expect(withBadEmail.success).toBe(false);
        });
    });

    describe('UpdateContactInputSchema', () => {
        it('requires at least one field besides contact_id', async () => {
            const { UpdateContactInputSchema } = await import('../../../../src/tools/core/contacts.js');
            expect(UpdateContactInputSchema.safeParse({ contact_id: 1 }).success).toBe(false);
            expect(UpdateContactInputSchema.safeParse({ contact_id: 1, name: 'Bob' }).success).toBe(true);
        });
    });
});
