import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import type { Logger } from 'pino';
import { registerGroupTools } from './groups.js';
import { registerTicketFieldTools } from './ticket-fields.js';
import { registerSlaPolicyTools } from './sla-policies.js';
import { registerAutomationTools } from './automations.js';

export function registerAdminTools(client: FreshdeskClient, logger: Logger) {
    return [
        ...registerGroupTools(client, logger),
        ...registerTicketFieldTools(client, logger),
        ...registerSlaPolicyTools(client, logger),
        ...registerAutomationTools(client, logger),
    ];
}
