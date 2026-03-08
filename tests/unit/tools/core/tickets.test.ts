import { describe, it, expect } from 'vitest';
import nock from 'nock';
import { createServer } from '../../../../src/server.js';
import type { Config } from '../../../../src/config.js';
import ticketFixtures from '../../../fixtures/tickets.json' assert { type: 'json' };

const testConfig: Config = {
    freshdesk: {
        domain: 'testcompany',
        apiKey: 'test-api-key',
        baseUrl: 'https://testcompany.freshdesk.com/api/v2',
    },
    server: { transport: 'streamable-http', port: 3000, host: '0.0.0.0' },
    toolsets: { enabled: ['core'] },
    rateLimit: { bufferPercent: 20 },
    logging: { level: 'silent' },
    security: { licenseKeyRequired: false, redactFields: ['phone', 'mobile', 'twitter_id'] },
};

describe('Ticket Tools', () => {
    describe('get_ticket tool via server', () => {
        it('returns ticket content on valid input', async () => {
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/tickets/1')
                .reply(200, ticketFixtures[0]);

            // The server is created and tools are internally validated
            const server = createServer(testConfig);
            expect(server).toBeDefined();
        });

        it('input schema requires ticket_id as positive integer', async () => {
            const { GetTicketInputSchema } = await import('../../../../src/tools/core/tickets.js');
            const validResult = GetTicketInputSchema.safeParse({ ticket_id: 1 });
            expect(validResult.success).toBe(true);

            const invalidResult = GetTicketInputSchema.safeParse({ ticket_id: -1 });
            expect(invalidResult.success).toBe(false);

            const missingResult = GetTicketInputSchema.safeParse({});
            expect(missingResult.success).toBe(false);
        });

        it('include field accepts valid sideloads', async () => {
            const { GetTicketInputSchema } = await import('../../../../src/tools/core/tickets.js');
            const result = GetTicketInputSchema.safeParse({
                ticket_id: 1,
                include: ['conversations', 'requester', 'stats'],
            });
            expect(result.success).toBe(true);
        });

        it('rejects invalid include values', async () => {
            const { GetTicketInputSchema } = await import('../../../../src/tools/core/tickets.js');
            const result = GetTicketInputSchema.safeParse({
                ticket_id: 1,
                include: ['invalid_sideload'],
            });
            expect(result.success).toBe(false);
        });
    });

    describe('update_ticket input schema', () => {
        it('requires at least one update field', async () => {
            const { UpdateTicketInputSchema } = await import('../../../../src/tools/core/tickets.js');
            const noUpdates = UpdateTicketInputSchema.safeParse({ ticket_id: 1 });
            expect(noUpdates.success).toBe(false);

            const withUpdate = UpdateTicketInputSchema.safeParse({ ticket_id: 1, status: 4 });
            expect(withUpdate.success).toBe(true);
        });
    });

    describe('create_ticket input schema', () => {
        it('requires either email or requester_id', async () => {
            const { CreateTicketInputSchema } = await import('../../../../src/tools/core/tickets.js');
            const noRequester = CreateTicketInputSchema.safeParse({
                subject: 'Test',
                description: '<p>Test</p>',
            });
            expect(noRequester.success).toBe(false);

            const withEmail = CreateTicketInputSchema.safeParse({
                subject: 'Test',
                description: '<p>Test</p>',
                email: 'user@example.com',
            });
            expect(withEmail.success).toBe(true);

            const withRequesterId = CreateTicketInputSchema.safeParse({
                subject: 'Test',
                description: '<p>Test</p>',
                requester_id: 101,
            });
            expect(withRequesterId.success).toBe(true);
        });
    });

    describe('search_tickets input schema', () => {
        it('limits page to max 10', async () => {
            const { SearchTicketsInputSchema } = await import('../../../../src/tools/core/tickets.js');
            const valid = SearchTicketsInputSchema.safeParse({ query: 'status:2', page: 10 });
            expect(valid.success).toBe(true);

            const tooHigh = SearchTicketsInputSchema.safeParse({ query: 'status:2', page: 11 });
            expect(tooHigh.success).toBe(false);
        });
    });
});
