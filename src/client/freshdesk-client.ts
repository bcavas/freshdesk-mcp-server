import type { Logger } from 'pino';
import type { Config } from '../config.js';
import type { RateLimiter } from '../middleware/rate-limiter.js';
import type { RetryHandler } from '../middleware/retry.js';
import type { Cache } from '../middleware/cache.js';
import type { Redactor } from '../middleware/redactor.js';
import { FreshdeskApiError } from '../errors/freshdesk-error.js';
import { endpoints } from './endpoints.js';
import { Cache as CacheClass } from '../middleware/cache.js';
import type {
    // ... keep existing imports ...
    Ticket,
    Contact,
    Company,
    Agent,
    Group,
    Conversation,
    SolutionCategory,
    SolutionFolder,
    SolutionArticle,
    CannedResponse,
    SatisfactionRating,
    TimeEntry,
    SlaPolicy,
    TicketField,
    AutomationRule,
    PaginatedResult,
    SearchResult,
    JobStatus,
    CreateTicketInput,
    UpdateTicketInput,
    ReplyInput,
    NoteInput,
    CreateContactInput,
    UpdateContactInput,
    CreateArticleInput,
    UpdateArticleInput,
    CreateCannedResponseInput,
    CreateTimeEntryInput,
    TicketListParams,
    ContactListParams,
    AgentListParams,
    PaginationParams,
    SatisfactionParams,
} from './types.js';

export interface RequestOptions {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    cacheKey?: string;
    cacheTtl?: number;
}

export class FreshdeskClient {
    private authHeader: string;

    constructor(
        private config: Config,
        private rateLimiter: RateLimiter,
        private retrier: RetryHandler,
        private cache: Cache,
        private redactor: Redactor,
        private logger: Logger,
    ) {
        this.authHeader =
            'Basic ' + Buffer.from(`${this.config.freshdesk.apiKey}:X`).toString('base64');
    }

    // Generic request method — all other methods delegate here
    async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
        // Build URL with query params
        let url = `${this.config.freshdesk.baseUrl}${path}`;
        if (options.params) {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(options.params)) {
                if (value !== undefined) {
                    searchParams.append(key, String(value));
                }
            }
            const qs = searchParams.toString();
            if (qs) url += `?${qs}`;
        }

        // Check cache for GET requests
        if (method === 'GET' && options.cacheKey) {
            const cached = this.cache.get<T>(options.cacheKey);
            if (cached !== undefined) {
                this.logger.debug({ path, cacheKey: options.cacheKey }, 'Cache hit');
                return cached;
            }
        }

        // Pre-flight rate check
        const { allowed, delayMs } = this.rateLimiter.canProceed();
        if (delayMs > 0) {
            this.logger.warn({ delayMs }, 'Rate limit buffer reached — delaying request');
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        if (!allowed) {
            throw new FreshdeskApiError(429, 'RATE_LIMITED', 'Rate limit exhausted', delayMs / 1000);
        }

        return this.retrier.execute(async () => {
            this.logger.debug({ method, url }, 'Freshdesk API request');

            const reqOptions: RequestInit = {
                method: method,
                headers: {
                    Authorization: this.authHeader,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };

            if (options.body && (method === 'POST' || method === 'PUT')) {
                reqOptions.body = JSON.stringify(options.body);
            }

            const response = await fetch(url, reqOptions);
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            // Update rate limiter
            this.rateLimiter.updateFromHeaders(responseHeaders);

            const responseBody = await response.json().catch(() => null);

            if (!response.ok) {
                this.logger.warn(
                    { status: response.status, path },
                    'Freshdesk API error response',
                );
                throw FreshdeskApiError.fromResponse(
                    response.status,
                    (responseBody as Record<string, unknown>) ?? {},
                    responseHeaders,
                );
            }

            if (response.status === 204) {
                return undefined as T;
            }

            // Apply redaction and cache result
            const data = responseBody as T;
            const redacted =
                data && typeof data === 'object'
                    ? (this.redactor.redact(data as Record<string, unknown>) as T)
                    : data;

            if (method === 'GET' && options.cacheKey && options.cacheTtl !== 0) {
                this.cache.set(options.cacheKey, redacted, options.cacheTtl);
            }

            return redacted;
        });
    }

    // Ticket operations
    async getTicket(id: number, include?: string[]): Promise<Ticket> {
        const params: Record<string, string | undefined> = {};
        if (include?.length) params['include'] = include.join(',');
        return this.request<Ticket>('GET', endpoints.ticket(id), {
            params,
            cacheKey: `ticket:${id}:${include?.join(',') ?? ''}`,
            cacheTtl: CacheClass.TTL.TICKETS,
        });
    }

    async listTickets(params?: TicketListParams): Promise<PaginatedResult<Ticket>> {
        const queryParams: Record<string, string | number | undefined> = {};
        if (params?.filter) queryParams['filter'] = params.filter;
        if (params?.page) queryParams['page'] = params.page;
        if (params?.per_page) queryParams['per_page'] = params.per_page;
        if (params?.order_by) queryParams['order_by'] = params.order_by;
        if (params?.order_type) queryParams['order_type'] = params.order_type;
        if (params?.updated_since) queryParams['updated_since'] = params.updated_since;

        const page = params?.page ?? 1;
        const perPage = params?.per_page ?? 30;
        const data = await this.request<Ticket[]>('GET', endpoints.tickets(), {
            params: queryParams,
            cacheKey: `tickets:list:${JSON.stringify(queryParams)}`,
            cacheTtl: CacheClass.TTL.TICKET_LISTS,
        });

        return {
            data: data ?? [],
            page,
            per_page: perPage,
            has_more: (data?.length ?? 0) === perPage,
        };
    }

    async createTicket(data: CreateTicketInput): Promise<Ticket> {
        this.cache.invalidatePrefix('tickets:list:');
        return this.request<Ticket>('POST', endpoints.tickets(), { body: data });
    }

    async updateTicket(id: number, data: UpdateTicketInput): Promise<Ticket> {
        this.cache.invalidate(`ticket:${id}`);
        this.cache.invalidatePrefix(`ticket:${id}:`);
        this.cache.invalidatePrefix('tickets:list:');
        return this.request<Ticket>('PUT', endpoints.ticket(id), { body: data });
    }

    async deleteTicket(id: number): Promise<void> {
        this.cache.invalidate(`ticket:${id}`);
        this.cache.invalidatePrefix(`ticket:${id}:`);
        this.cache.invalidatePrefix('tickets:list:');
        await this.request<void>('DELETE', endpoints.ticket(id));
    }

    async searchTickets(query: string, page?: number): Promise<SearchResult<Ticket>> {
        return this.request<SearchResult<Ticket>>('GET', endpoints.ticketSearch(), {
            params: { query: `"${query}"`, page: page ?? 1 },
        });
    }

    async bulkUpdateTickets(
        ticketIds: number[],
        properties: Partial<Ticket>,
    ): Promise<JobStatus> {
        ticketIds.forEach((id) => {
            this.cache.invalidate(`ticket:${id}`);
            this.cache.invalidatePrefix(`ticket:${id}:`);
        });
        this.cache.invalidatePrefix('tickets:list:');
        return this.request<JobStatus>('POST', endpoints.ticketBulkUpdate(), {
            body: { bulk_action: { ids: ticketIds, properties } },
        });
    }

    // Conversation operations
    async listConversations(ticketId: number): Promise<Conversation[]> {
        return this.request<Conversation[]>('GET', endpoints.ticketConversations(ticketId), {
            cacheKey: `ticket:${ticketId}:conversations`,
            cacheTtl: CacheClass.TTL.CONVERSATIONS,
        });
    }

    async replyToTicket(ticketId: number, body: ReplyInput): Promise<Conversation> {
        this.cache.invalidate(`ticket:${ticketId}`);
        this.cache.invalidatePrefix(`ticket:${ticketId}:conversations`);
        return this.request<Conversation>('POST', endpoints.ticketReply(ticketId), {
            body,
        });
    }

    async addNote(ticketId: number, body: NoteInput): Promise<Conversation> {
        this.cache.invalidate(`ticket:${ticketId}`);
        this.cache.invalidatePrefix(`ticket:${ticketId}:conversations`);
        return this.request<Conversation>('POST', endpoints.ticketNote(ticketId), { body });
    }

    // Contact operations
    async getContact(id: number): Promise<Contact> {
        return this.request<Contact>('GET', endpoints.contact(id), {
            cacheKey: `contact:${id}`,
            cacheTtl: CacheClass.TTL.CONTACTS,
        });
    }

    async listContacts(params?: ContactListParams): Promise<PaginatedResult<Contact>> {
        const queryParams: Record<string, string | number | undefined> = {};
        if (params?.email) queryParams['email'] = params.email;
        if (params?.phone) queryParams['phone'] = params.phone;
        if (params?.company_id) queryParams['company_id'] = params.company_id;
        if (params?.page) queryParams['page'] = params.page;
        if (params?.per_page) queryParams['per_page'] = params.per_page;

        const page = params?.page ?? 1;
        const perPage = params?.per_page ?? 30;
        const data = await this.request<Contact[]>('GET', endpoints.contacts(), {
            params: queryParams,
        });

        return {
            data: data ?? [],
            page,
            per_page: perPage,
            has_more: (data?.length ?? 0) === perPage,
        };
    }

    async createContact(data: CreateContactInput): Promise<Contact> {
        return this.request<Contact>('POST', endpoints.contacts(), { body: data });
    }

    async updateContact(id: number, data: UpdateContactInput): Promise<Contact> {
        this.cache.invalidate(`contact:${id}`);
        return this.request<Contact>('PUT', endpoints.contact(id), { body: data });
    }

    async searchContacts(query: string): Promise<SearchResult<Contact>> {
        return this.request<SearchResult<Contact>>('GET', endpoints.contactSearch(), {
            params: { query: `"${query}"` },
        });
    }

    // Company operations
    async getCompany(id: number): Promise<Company> {
        return this.request<Company>('GET', endpoints.company(id));
    }

    async listCompanies(params?: PaginationParams): Promise<PaginatedResult<Company>> {
        const page = params?.page ?? 1;
        const perPage = params?.per_page ?? 30;
        const data = await this.request<Company[]>('GET', endpoints.companies(), {
            params: { page, per_page: perPage },
        });
        return {
            data: data ?? [],
            page,
            per_page: perPage,
            has_more: (data?.length ?? 0) === perPage,
        };
    }

    // Agent operations
    async getAgent(id: number): Promise<Agent> {
        return this.request<Agent>('GET', endpoints.agent(id), {
            cacheKey: `agent:${id}`,
            cacheTtl: CacheClass.TTL.AGENTS,
        });
    }

    async listAgents(params?: AgentListParams): Promise<PaginatedResult<Agent>> {
        const queryParams: Record<string, string | number | undefined> = {};
        if (params?.state) queryParams['state'] = params.state;
        if (params?.group_id) queryParams['group_id'] = params.group_id;
        if (params?.page) queryParams['page'] = params.page;

        const page = params?.page ?? 1;
        const data = await this.request<Agent[]>('GET', endpoints.agents(), {
            params: queryParams,
            cacheKey: `agents:${JSON.stringify(params ?? {})}`,
            cacheTtl: CacheClass.TTL.AGENTS,
        });
        return { data: data ?? [], page, per_page: 30, has_more: false };
    }

    async getCurrentAgent(): Promise<Agent> {
        return this.request<Agent>('GET', endpoints.agentMe(), {
            cacheKey: 'agent:me',
            cacheTtl: CacheClass.TTL.AGENTS,
        });
    }

    // Group operations
    async listGroups(): Promise<Group[]> {
        return this.request<Group[]>('GET', endpoints.groups(), {
            cacheKey: 'groups:all',
            cacheTtl: CacheClass.TTL.GROUPS,
        });
    }

    async getGroup(id: number): Promise<Group> {
        return this.request<Group>('GET', endpoints.group(id), {
            cacheKey: `group:${id}`,
            cacheTtl: CacheClass.TTL.GROUPS,
        });
    }

    // Solutions (Knowledge Base)
    async listSolutionCategories(): Promise<SolutionCategory[]> {
        return this.request<SolutionCategory[]>('GET', endpoints.solutionCategories(), {
            cacheKey: 'solution_categories:all',
            cacheTtl: CacheClass.TTL.SOLUTION_CATEGORIES,
        });
    }

    async listSolutionFolders(categoryId: number): Promise<SolutionFolder[]> {
        return this.request<SolutionFolder[]>('GET', endpoints.solutionFolders(categoryId), {
            cacheKey: `solution_category:${categoryId}:folders`,
            cacheTtl: CacheClass.TTL.SOLUTION_FOLDERS,
        });
    }

    async listSolutionArticles(folderId: number): Promise<SolutionArticle[]> {
        return this.request<SolutionArticle[]>('GET', endpoints.solutionArticles(folderId), {
            cacheKey: `solution_folder:${folderId}:articles`,
            cacheTtl: CacheClass.TTL.SOLUTION_ARTICLES,
        });
    }

    async getSolutionArticle(id: number): Promise<SolutionArticle> {
        return this.request<SolutionArticle>('GET', endpoints.solutionArticle(id));
    }

    async createSolutionArticle(
        folderId: number,
        data: CreateArticleInput,
    ): Promise<SolutionArticle> {
        this.cache.invalidate(`solution_folder:${folderId}:articles`);
        return this.request<SolutionArticle>('POST', endpoints.solutionArticles(folderId), {
            body: { solution_article: data },
        });
    }

    async updateSolutionArticle(
        id: number,
        data: UpdateArticleInput,
    ): Promise<SolutionArticle> {
        this.cache.invalidate(`solution_article:${id}`);
        // We cannot easily invalidate the list cache here without knowing the folder ID,
        // but since we don't cache individual articles locally yet, we assume the list cache
        // might be stale. For simplicity, we can invalidate all article lists:
        this.cache.invalidatePrefix('solution_folder:');
        return this.request<SolutionArticle>('PUT', endpoints.solutionArticle(id), {
            body: { solution_article: data },
        });
    }

    async deleteSolutionArticle(id: number): Promise<void> {
        this.cache.invalidate(`solution_article:${id}`);
        this.cache.invalidatePrefix('solution_folder:');
        await this.request<void>('DELETE', endpoints.solutionArticle(id));
    }

    // Canned Responses
    async listCannedResponses(): Promise<CannedResponse[]> {
        return this.request<CannedResponse[]>('GET', endpoints.cannedResponses(), {
            cacheKey: 'canned_responses:all',
            cacheTtl: CacheClass.TTL.CANNED_RESPONSES,
        });
    }

    async getCannedResponse(id: number): Promise<CannedResponse> {
        return this.request<CannedResponse>('GET', endpoints.cannedResponse(id));
    }

    async createCannedResponse(data: CreateCannedResponseInput): Promise<CannedResponse> {
        return this.request<CannedResponse>('POST', endpoints.cannedResponses(), {
            body: data,
        });
    }

    // Satisfaction Ratings
    async listSatisfactionRatings(
        params?: SatisfactionParams,
    ): Promise<PaginatedResult<SatisfactionRating>> {
        const queryParams: Record<string, string | number | undefined> = {};
        if (params?.created_since) queryParams['created_since'] = params.created_since;
        if (params?.created_until) queryParams['created_until'] = params.created_until;
        if (params?.page) queryParams['page'] = params.page;

        const page = params?.page ?? 1;
        const data = await this.request<SatisfactionRating[]>(
            'GET',
            endpoints.satisfactionRatings(),
            { params: queryParams },
        );
        return { data: data ?? [], page, per_page: 30, has_more: false };
    }

    // Time Entries
    async listTimeEntries(ticketId: number): Promise<TimeEntry[]> {
        return this.request<TimeEntry[]>('GET', endpoints.ticketTimeEntries(ticketId), {
            cacheKey: `ticket:${ticketId}:time_entries`,
            cacheTtl: CacheClass.TTL.TIME_ENTRIES,
        });
    }

    async createTimeEntry(ticketId: number, data: CreateTimeEntryInput): Promise<TimeEntry> {
        this.cache.invalidate(`ticket:${ticketId}:time_entries`);
        return this.request<TimeEntry>('POST', endpoints.ticketTimeEntries(ticketId), {
            body: data,
        });
    }

    // SLA Policies
    async listSlaPolicies(): Promise<SlaPolicy[]> {
        return this.request<SlaPolicy[]>('GET', endpoints.slaPolicies(), {
            cacheKey: 'sla_policies:all',
            cacheTtl: CacheClass.TTL.SLA_POLICIES,
        });
    }

    // Ticket Fields
    async listTicketFields(): Promise<TicketField[]> {
        return this.request<TicketField[]>('GET', endpoints.ticketFields(), {
            cacheKey: 'ticket_fields:all',
            cacheTtl: CacheClass.TTL.TICKET_FIELDS,
        });
    }

    // Automations
    async listAutomationRules(
        type: 'ticket_creation' | 'time_triggers' | 'ticket_update',
    ): Promise<AutomationRule[]> {
        return this.request<AutomationRule[]>('GET', endpoints.automationRules(type), {
            cacheKey: `automation_rules:${type}`,
            cacheTtl: CacheClass.TTL.AUTOMATION_RULES,
        });
    }
}
