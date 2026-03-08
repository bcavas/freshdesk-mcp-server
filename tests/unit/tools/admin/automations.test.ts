import { describe, it, expect } from 'vitest';

describe('Admin Automations Tool', () => {
    describe('list_automation_rules tool schema', () => {
        it('requires a valid type enum', async () => {
            const { ListAutomationRulesInputSchema } = await import('../../../../../src/tools/admin/automations.js');
            expect(ListAutomationRulesInputSchema.safeParse({ type: 'ticket_creation' }).success).toBe(true);
            expect(ListAutomationRulesInputSchema.safeParse({ type: 'not_valid' }).success).toBe(false);
        });
    });
});
