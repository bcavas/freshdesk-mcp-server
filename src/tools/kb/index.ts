import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import type { Logger } from 'pino';
import { registerArticleTools } from './articles.js';
import { registerCannedResponseTools } from './canned-responses.js';
import { registerCategoryTools } from './categories.js';

export function registerKbTools(client: FreshdeskClient, logger: Logger) {
    return [
        ...registerArticleTools(client, logger),
        ...registerCannedResponseTools(client, logger),
        ...registerCategoryTools(client, logger),
    ];
}
