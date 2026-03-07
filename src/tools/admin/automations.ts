import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

export const ListAutomationRulesInputSchema = z.object({
    type: z
        .enum(['ticket_creation', 'time_triggers', 'ticket_update'])
        .describe(
            'The type of automation rules to list: ticket_creation (on new ticket), time_triggers (time-based), or ticket_update (on ticket change)',
        ),
});

export function registerAutomationTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_automation_rules',
            description:
                'List Freshdesk automation rules by type. Types: ticket_creation (runs when ticket is created), time_triggers (runs on schedule), ticket_update (runs when ticket is updated).',
            inputSchema: ListAutomationRulesInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (input: z.infer<typeof ListAutomationRulesInputSchema>) => {
                logger.child({ tool: 'list_automation_rules', type: input.type }).info('Tool invoked');
                const rules = await client.listAutomationRules(input.type);
                const activeRules = rules.filter((r) => r.active);
                const summary = rules
                    .map((r) => `#${r.id} (pos ${r.position}): ${r.name}${r.active ? '' : ' [inactive]'}`)
                    .join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${rules.length} ${input.type} automation rules (${activeRules.length} active):\n${summary}`,
                        },
                    ],
                    structuredContent: {
                        type: 'object',
                        value: { rules, total: rules.length, active_count: activeRules.length },
                    },
                };
            },
        },
    ];
}
