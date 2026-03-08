import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { FreshdeskClient } from '../../../src/client/freshdesk-client.js';
import { RateLimiter } from '../../../src/middleware/rate-limiter.js';
import { RetryHandler } from '../../../src/middleware/retry.js';
import { Cache } from '../../../src/middleware/cache.js';
import { Redactor } from '../../../src/middleware/redactor.js';
import type { Config } from '../../../src/config.js';
import ticketFixtures from '../../fixtures/tickets.json' assert { type: 'json' };
import pino from 'pino';

const BASE_URL = 'https://testcompany.freshdesk.com/api/v2';
const testLogger = pino({ level: 'silent' });

const testConfig: Config = {
    freshdesk: {
        domain: 'testcompany',
        apiKey: 'test-api-key',
        baseUrl: BASE_URL,
    },
    server: { transport: 'streamable-http', port: 3000, host: '0.0.0.0' },
    toolsets: { enabled: ['core'] },
    rateLimit: { bufferPercent: 20 },
    logging: { level: 'silent' },
    security: { licenseKeyRequired: false, redactFields: ['phone', 'mobile', 'twitter_id'] },
};

function createClient() {
    return new FreshdeskClient(
        testConfig,
        new RateLimiter(20),
        new RetryHandler({ maxRetries: 0 }),
        new Cache(),
        new Redactor(['phone', 'mobile', 'twitter_id']),
        testLogger,
    );
}

describe('FreshdeskClient', () => {
    beforeEach(() => {
        nock.cleanAll();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('getTicket()', () => {
        it('returns a ticket on success', async () => {
            const ticket = ticketFixtures[0]!;
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/tickets/1')
                .reply(200, ticket, {
                    'x-ratelimit-total': '1000',
                    'x-ratelimit-remaining': '999',
                });

            const client = createClient();
            const result = await client.getTicket(1);
            expect(result.id).toBe(1);
            expect(result.subject).toBe('My printer is on fire');
        });

        it('redacts phone field from contact responses', async () => {
            const ticketWithRequester = {
                ...ticketFixtures[0]!,
                requester: {
                    id: 101,
                    name: 'Jane Smith',
                    email: 'jane@example.com',
                    phone: '+1-555-0100',
                    mobile: '+1-555-0101',
                    twitter_id: null,
                },
            };
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/tickets/1')
                .query({ include: 'requester' })
                .reply(200, ticketWithRequester);

            const client = createClient();
            const result = await client.getTicket(1, ['requester']);
            expect(result.requester?.phone).toBe('[REDACTED]');
            expect(result.requester?.mobile).toBe('[REDACTED]');
        });

        it('throws FreshdeskApiError on 404', async () => {
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/tickets/99999')
                .reply(404, { code: 'record_not_found', message: 'Record Not Found' });

            const client = createClient();
            await expect(client.getTicket(99999)).rejects.toMatchObject({
                statusCode: 404,
                errorCode: 'record_not_found',
            });
        });

        it('throws FreshdeskApiError on 401', async () => {
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/tickets/1')
                .reply(401, { code: 'invalid_credentials', message: 'You have to be logged in' });

            const client = createClient();
            await expect(client.getTicket(1)).rejects.toMatchObject({ statusCode: 401 });
        });

        it('uses cache on second identical request', async () => {
            const ticket = ticketFixtures[0]!;
            // Only intercept once — second call must hit cache
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/tickets/1')
                .once()
                .reply(200, ticket, {
                    'x-ratelimit-total': '1000',
                    'x-ratelimit-remaining': '999',
                });

            const client = createClient();
            const first = await client.getTicket(1);
            const second = await client.getTicket(1);
            expect(first.id).toBe(second.id);
            expect(nock.pendingMocks().length).toBe(0);
        });
    });

    describe('listTickets()', () => {
        it('returns paginated results', async () => {
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/tickets')
                .query(true)
                .reply(200, ticketFixtures);

            const client = createClient();
            const result = await client.listTickets({ page: 1, per_page: 30 });
            expect(result.data).toHaveLength(2);
            expect(result.page).toBe(1);
        });
    });

    describe('createTicket()', () => {
        it('creates a ticket successfully', async () => {
            const newTicket = ticketFixtures[0]!;
            nock('https://testcompany.freshdesk.com')
                .post('/api/v2/tickets')
                .reply(201, newTicket);

            const client = createClient();
            const result = await client.createTicket({
                subject: 'My printer is on fire',
                description: '<p>Help!</p>',
                email: 'jane@example.com',
                priority: 4,
                status: 2,
            });
            expect(result.id).toBe(1);
        });
    });

    describe('searchTickets()', () => {
        it('returns search results with total count', async () => {
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/search/tickets')
                .query(true)
                .reply(200, { results: ticketFixtures, total: 2 });

            const client = createClient();
            const result = await client.searchTickets('status:2', 1);
            expect(result.results).toHaveLength(2);
            expect(result.total).toBe(2);
        });
    });

    describe('rate limiter integration', () => {
        it('respects buffer threshold and does not throw when remaining is above buffer', async () => {
            const ticket = ticketFixtures[0]!;
            nock('https://testcompany.freshdesk.com')
                .get('/api/v2/tickets/1')
                .reply(200, ticket, {
                    'x-ratelimit-total': '100',
                    'x-ratelimit-remaining': '50', // Above 20% buffer (20)
                });

            const client = createClient();
            await expect(client.getTicket(1)).resolves.toBeDefined();
        });
    });
});
