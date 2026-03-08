import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import nock from 'nock';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../src/server.js';
import type { Config } from '../../src/config.js';

const testConfig: Config = {
    freshdesk: {
        domain: 'testcompany',
        apiKey: 'test-api-key',
        baseUrl: 'https://testcompany.freshdesk.com/api/v2',
    },
    server: { transport: 'streamable-http', port: 3000, host: '0.0.0.0' },
    toolsets: { enabled: ['core', 'kb', 'analytics', 'bulk', 'admin'] },
    rateLimit: { bufferPercent: 20 },
    logging: { level: 'silent' },
    security: { licenseKeyRequired: false, redactFields: ['phone', 'mobile', 'twitter_id'] },
};

describe('Server Lifecycle', () => {
    let client: Client;

    beforeAll(async () => {
        nock.cleanAll();
        const server = createServer(testConfig);
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        client = new Client({ name: 'test-client', version: '1.0.0' });
        await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    });

    afterAll(async () => {
        await client.close();
        nock.cleanAll();
    });

    it('connects successfully and lists tools', async () => {
        const { tools } = await client.listTools();
        expect(tools.length).toBeGreaterThanOrEqual(15); // Core toolset minimum
    });

    it('lists all 33+ tools with all toolsets enabled', async () => {
        const { tools } = await client.listTools();
        expect(tools.length).toBeGreaterThanOrEqual(33);
    });

    it('every tool has a name, description, and inputSchema', async () => {
        const { tools } = await client.listTools();
        for (const tool of tools) {
            expect(tool.name).toBeTruthy();
            expect(tool.description).toBeTruthy();
            expect(tool.inputSchema).toBeDefined();
        }
    });

    it('core tools are present by name', async () => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name);
        expect(names).toContain('get_ticket');
        expect(names).toContain('list_tickets');
        expect(names).toContain('search_tickets');
        expect(names).toContain('create_ticket');
        expect(names).toContain('update_ticket');
        expect(names).toContain('reply_to_ticket');
        expect(names).toContain('add_note');
        expect(names).toContain('list_conversations');
        expect(names).toContain('get_contact');
        expect(names).toContain('list_contacts');
        expect(names).toContain('search_contacts');
        expect(names).toContain('create_contact');
        expect(names).toContain('update_contact');
        expect(names).toContain('list_agents');
        expect(names).toContain('get_agent');
    });

    it('kb tools are present', async () => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name);
        expect(names).toContain('list_solution_categories');
        expect(names).toContain('list_solution_articles');
        expect(names).toContain('get_solution_article');
        expect(names).toContain('create_solution_article');
        expect(names).toContain('update_solution_article');
        expect(names).toContain('delete_solution_article');
        expect(names).toContain('list_canned_responses');
        expect(names).toContain('get_canned_response');
    });

    it('analytics tools are present', async () => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name);
        expect(names).toContain('list_satisfaction_ratings');
        expect(names).toContain('list_time_entries');
        expect(names).toContain('create_time_entry');
    });

    it('bulk tools are present', async () => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name);
        expect(names).toContain('bulk_update_tickets');
        expect(names).toContain('delete_ticket');
        expect(names).toContain('merge_contacts');
    });

    it('admin tools are present', async () => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name);
        expect(names).toContain('list_groups');
        expect(names).toContain('list_ticket_fields');
        expect(names).toContain('list_sla_policies');
        expect(names).toContain('list_automation_rules');
    });
});
