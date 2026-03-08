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
        describe('updateTicket()', () => {
            it('updates a ticket successfully', async () => {
                nock('https://testcompany.freshdesk.com')
                    .put('/api/v2/tickets/1')
                    .reply(200, { id: 1, status: 3 });

                const client = createClient();
                const result = await client.updateTicket(1, { status: 3 });
                expect(result.status).toBe(3);
            });
        });

        describe('deleteTicket()', () => {
            it('deletes a ticket successfully', async () => {
                nock('https://testcompany.freshdesk.com')
                    .delete('/api/v2/tickets/1')
                    .reply(204);

                const client = createClient();
                await expect(client.deleteTicket(1)).resolves.not.toThrow();
            });
        });

        describe('bulkUpdateTickets()', () => {
            it('bulk updates tickets successfully', async () => {
                nock('https://testcompany.freshdesk.com')
                    .post('/api/v2/tickets/bulk_update')
                    .reply(200, { job_id: '123' });

                const client = createClient();
                const result = await client.bulkUpdateTickets([1, 2], { status: 3 });
                expect(result).toHaveProperty('job_id', '123');
            });
        });

        describe('Conversations', () => {
            it('listConversations', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/tickets/1/conversations').reply(200, [{ id: 10 }]);
                const client = createClient();
                const res = await client.listConversations(1);
                expect(res).toHaveLength(1);
            });
            it('replyToTicket', async () => {
                nock('https://testcompany.freshdesk.com').post('/api/v2/tickets/1/reply').reply(200, { id: 10 });
                const client = createClient();
                const res = await client.replyToTicket(1, { body: 'test' });
                expect(res.id).toBe(10);
            });
            it('addNote', async () => {
                nock('https://testcompany.freshdesk.com').post('/api/v2/tickets/1/notes').reply(200, { id: 10 });
                const client = createClient();
                const res = await client.addNote(1, { body: 'test' });
                expect(res.id).toBe(10);
            });
        });

        describe('Contacts', () => {
            it('getContact', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/contacts/1').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.getContact(1);
                expect(res.id).toBe(1);
            });
            it('listContacts', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/contacts').query(true).reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listContacts({ page: 1, email: 'test@example.com' });
                expect(res.data).toHaveLength(1);
            });
            it('createContact', async () => {
                nock('https://testcompany.freshdesk.com').post('/api/v2/contacts').reply(201, { id: 1 });
                const client = createClient();
                const res = await client.createContact({ name: 'test' });
                expect(res.id).toBe(1);
            });
            it('updateContact', async () => {
                nock('https://testcompany.freshdesk.com').put('/api/v2/contacts/1').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.updateContact(1, { name: 'test' });
                expect(res.id).toBe(1);
            });
            it('searchContacts', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/search/contacts').query(true).reply(200, { results: [{ id: 1 }] });
                const client = createClient();
                const res = await client.searchContacts('test');
                expect(res.results).toHaveLength(1);
            });
        });

        describe('Companies', () => {
            it('getCompany', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/companies/1').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.getCompany(1);
                expect(res.id).toBe(1);
            });
            it('listCompanies', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/companies').query(true).reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listCompanies({ page: 1 });
                expect(res.data).toHaveLength(1);
            });
        });

        describe('Agents & Groups', () => {
            it('getAgent', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/agents/1').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.getAgent(1);
                expect(res.id).toBe(1);
            });
            it('listAgents', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/agents').query(true).reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listAgents({ state: 'fulltime' });
                expect(res.data).toHaveLength(1);
            });
            it('getCurrentAgent', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/agents/me').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.getCurrentAgent();
                expect(res.id).toBe(1);
            });
            it('getGroup', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/groups/1').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.getGroup(1);
                expect(res.id).toBe(1);
            });
            it('listGroups', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/groups').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listGroups();
                expect(res).toHaveLength(1);
            });
        });

        describe('Misc (Solutions, Canned Responses, Time Entries, SLA, etc)', () => {
            it('listSolutionCategories', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/solutions/categories').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listSolutionCategories();
                expect(res).toHaveLength(1);
            });
            it('listSolutionFolders', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/solutions/categories/1/folders').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listSolutionFolders(1);
                expect(res).toHaveLength(1);
            });
            it('listSolutionArticles', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/solutions/folders/1/articles').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listSolutionArticles(1);
                expect(res).toHaveLength(1);
            });
            it('getSolutionArticle', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/solutions/articles/1').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.getSolutionArticle(1);
                expect(res.id).toBe(1);
            });
            it('createSolutionArticle', async () => {
                nock('https://testcompany.freshdesk.com').post('/api/v2/solutions/folders/1/articles').reply(201, { id: 1 });
                const client = createClient();
                const res = await client.createSolutionArticle(1, { title: 'T', description: 'D', status: 1 });
                expect(res.id).toBe(1);
            });
            it('updateSolutionArticle', async () => {
                nock('https://testcompany.freshdesk.com').put('/api/v2/solutions/articles/1').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.updateSolutionArticle(1, { title: 'T2' });
                expect(res.id).toBe(1);
            });
            it('deleteSolutionArticle', async () => {
                nock('https://testcompany.freshdesk.com').delete('/api/v2/solutions/articles/1').reply(204);
                const client = createClient();
                await expect(client.deleteSolutionArticle(1)).resolves.not.toThrow();
            });
            it('listCannedResponses', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/canned_responses').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listCannedResponses();
                expect(res).toHaveLength(1);
            });
            it('getCannedResponse', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/canned_responses/1').reply(200, { id: 1 });
                const client = createClient();
                const res = await client.getCannedResponse(1);
                expect(res.id).toBe(1);
            });
            it('createCannedResponse', async () => {
                nock('https://testcompany.freshdesk.com').post('/api/v2/canned_responses').reply(201, { id: 1 });
                const client = createClient();
                const res = await client.createCannedResponse({ title: 'T', content: 'C' });
                expect(res.id).toBe(1);
            });
            it('listSatisfactionRatings', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/surveys/satisfaction_ratings').query(true).reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listSatisfactionRatings({ created_since: '2023-01-01T00:00:00Z' });
                expect(res.data).toHaveLength(1);
            });
            it('listTimeEntries', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/tickets/1/time_entries').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listTimeEntries(1);
                expect(res).toHaveLength(1);
            });
            it('createTimeEntry', async () => {
                nock('https://testcompany.freshdesk.com').post('/api/v2/tickets/1/time_entries').reply(201, { id: 1 });
                const client = createClient();
                const res = await client.createTimeEntry(1, { time_spent: '01:00', agent_id: 123 });
                expect(res.id).toBe(1);
            });
            it('listSlaPolicies', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/sla_policies').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listSlaPolicies();
                expect(res).toHaveLength(1);
            });
            it('listTicketFields', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/ticket_fields').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listTicketFields();
                expect(res).toHaveLength(1);
            });
            it('listAutomationRules', async () => {
                nock('https://testcompany.freshdesk.com').get('/api/v2/automations/ticket_creation').reply(200, [{ id: 1 }]);
                const client = createClient();
                const res = await client.listAutomationRules('ticket_creation');
                expect(res).toHaveLength(1);
            });
        });
    });
});
