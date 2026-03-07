import { z } from 'zod';
import type { Logger } from 'pino';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';

export const ListSlaPoliciesInputSchema = z.object({});

export function registerSlaPolicyTools(client: FreshdeskClient, logger: Logger) {
    return [
        {
            name: 'list_sla_policies',
            description:
                'List all Freshdesk SLA policies with escalation targets and business-hours settings. Results cached for 30 minutes.',
            inputSchema: ListSlaPoliciesInputSchema,
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
            handler: async (_input: z.infer<typeof ListSlaPoliciesInputSchema>) => {
                logger.child({ tool: 'list_sla_policies' }).info('Tool invoked');
                const policies = await client.listSlaPolicies();
                const summary = policies
                    .map(
                        (p) =>
                            `#${p.id}: ${p.name}${p.is_default ? ' [default]' : ''}${p.active ? '' : ' [inactive]'}`,
                    )
                    .join('\n');
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${policies.length} SLA policies:\n${summary}`,
                        },
                    ],
                    structuredContent: { type: 'object', value: { policies } },
                };
            },
        },
    ];
}
