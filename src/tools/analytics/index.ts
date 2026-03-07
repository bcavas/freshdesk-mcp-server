import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import type { Logger } from 'pino';
import { registerSatisfactionTools } from './satisfaction.js';
import { registerTimeEntryTools } from './time-entries.js';

export function registerAnalyticsTools(client: FreshdeskClient, logger: Logger) {
    return [
        ...registerSatisfactionTools(client, logger),
        ...registerTimeEntryTools(client, logger),
    ];
}
