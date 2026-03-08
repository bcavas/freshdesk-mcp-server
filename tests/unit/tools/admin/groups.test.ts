import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

const mockLogger = pino({ level: 'silent' });

describe('Admin Groups Tool', () => {
    describe('list_groups tool schema', () => {
        it('validates without any input', async () => {
            const { ListGroupsInputSchema } = await import('../../../../../src/tools/admin/groups.js');
            expect(ListGroupsInputSchema.safeParse({}).success).toBe(true);
        });
    });

    describe('handler logic', () => {
        it('retrieves and formats groups properly', async () => {
            const mockClient = {
                listGroups: vi.fn().mockResolvedValue([
                    { id: 123, name: 'Support', agent_ids: [1, 2, 3] },
                    { id: 456, name: 'Billing' } // missing agent_ids
                ])
            } as any;

            const { registerGroupTools } = await import('../../../../../src/tools/admin/groups.js');
            const tools = registerGroupTools(mockClient, mockLogger);
            const listGroupsTool = tools.find(t => t.name === 'list_groups')!;

            const result = await listGroupsTool.handler({});

            expect(mockClient.listGroups).toHaveBeenCalled();
            expect(result.content[0].text).toContain('Found 2 groups');
            expect(result.content[0].text).toContain('#123: Support (3 agents)');
            expect(result.content[0].text).toContain('#456: Billing (0 agents)');

            const data = (result.structuredContent).value.groups;
            expect(data.length).toBe(2);
        });
    });
});
