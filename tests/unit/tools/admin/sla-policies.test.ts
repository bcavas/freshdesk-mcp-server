import { describe, it, expect } from 'vitest';

describe('Admin SLA Policies Tool', () => {
    describe('list_sla_policies tool schema', () => {
        it('validates without inputs', async () => {
            const { ListSlaPoliciesInputSchema } = await import('../../../../src/tools/admin/sla-policies.js');
            expect(ListSlaPoliciesInputSchema.safeParse({}).success).toBe(true);
            expect(ListSlaPoliciesInputSchema.safeParse({ per_page: 200 }).success).toBe(true); // Zod will ignore extra by default so it's fine.
        });
    });
});
