import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import type { Logger } from 'pino';
import { registerBulkTicketTools } from './bulk-tickets.js';
import { registerBulkContactTools } from './bulk-contacts.js';

export function registerBulkTools(client: FreshdeskClient, logger: Logger) {
    return [
        ...registerBulkTicketTools(client, logger),
        ...registerBulkContactTools(client, logger),
    ];
}
