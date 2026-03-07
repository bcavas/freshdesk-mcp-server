// Core enums
export enum TicketStatus {
    Open = 2,
    Pending = 3,
    Resolved = 4,
    Closed = 5,
}

export enum TicketPriority {
    Low = 1,
    Medium = 2,
    High = 3,
    Urgent = 4,
}

export enum TicketSource {
    Email = 1,
    Portal = 2,
    Phone = 3,
    Chat = 7,
    Feedback = 9,
    OutboundEmail = 10,
}

// Primary types — define ALL fields returned by the API
export interface Ticket {
    id: number;
    subject: string;
    description: string;
    description_text: string;
    status: TicketStatus;
    priority: TicketPriority;
    source: TicketSource;
    type: string | null;
    requester_id: number;
    responder_id: number | null;
    group_id: number | null;
    company_id: number | null;
    product_id: number | null;
    email_config_id: number | null;
    tags: string[];
    cc_emails: string[];
    fwd_emails: string[];
    reply_cc_emails: string[];
    due_by: string;
    fr_due_by: string;
    is_escalated: boolean;
    spam: boolean;
    created_at: string;
    updated_at: string;
    custom_fields: Record<string, unknown>;
    // Included via ?include=stats
    stats?: TicketStats;
    // Included via ?include=requester
    requester?: Contact;
    // Included via ?include=conversations
    conversations?: Conversation[];
}

export interface TicketStats {
    agent_responded_at: string | null;
    requester_responded_at: string | null;
    first_responded_at: string | null;
    status_updated_at: string | null;
    reopened_at: string | null;
    resolved_at: string | null;
    closed_at: string | null;
    pending_since: string | null;
}

export interface Conversation {
    id: number;
    body: string;
    body_text: string;
    incoming: boolean;
    private: boolean;
    user_id: number;
    support_email: string | null;
    source: number;
    ticket_id: number;
    to_emails: string[];
    from_email: string | null;
    cc_emails: string[];
    bcc_emails: string[];
    attachments: ConversationAttachment[];
    created_at: string;
    updated_at: string;
}

export interface ConversationAttachment {
    id: number;
    content_type: string;
    size: number;
    name: string;
    attachment_url: string;
    created_at: string;
    updated_at: string;
}

export interface Contact {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    company_id: number | null;
    address: string | null;
    description: string | null;
    job_title: string | null;
    language: string | null;
    time_zone: string | null;
    tags: string[];
    twitter_id: string | null;
    custom_fields: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface Company {
    id: number;
    name: string;
    description: string | null;
    domains: string[];
    note: string | null;
    health_score: string | null;
    account_tier: string | null;
    renewal_date: string | null;
    industry: string | null;
    custom_fields: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface AgentContact {
    id: number;
    active: boolean;
    email: string;
    job_title: string | null;
    language: string;
    last_login_at: string | null;
    mobile: string | null;
    name: string;
    phone: string | null;
    time_zone: string;
    created_at: string;
    updated_at: string;
}

export interface Agent {
    id: number;
    contact: AgentContact;
    type: string;
    occasional: boolean;
    signature: string | null;
    ticket_scope: number;
    group_ids: number[];
    role_ids: number[];
    skill_ids: number[];
    available: boolean;
    available_since: string | null;
    created_at: string;
    updated_at: string;
}

export interface Group {
    id: number;
    name: string;
    description: string | null;
    escalate_to: number | null;
    unassigned_for: string | null;
    business_hour_id: number | null;
    group_type: string;
    agent_ids: number[];
    created_at: string;
    updated_at: string;
}

export interface SolutionCategory {
    id: number;
    name: string;
    description: string | null;
    visible_in_portals: number[];
    created_at: string;
    updated_at: string;
}

export interface SolutionFolder {
    id: number;
    name: string;
    description: string | null;
    visibility: number;
    category_id: number;
    created_at: string;
    updated_at: string;
}

export interface SolutionArticle {
    id: number;
    title: string;
    description: string;
    description_text: string;
    status: number;
    type: number;
    category_id: number;
    folder_id: number;
    agent_id: number;
    thumbs_up: number;
    thumbs_down: number;
    hits: number;
    tags: string[];
    seo_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface CannedResponseFolder {
    id: number;
    name: string;
    responses_count: number;
}

export interface CannedResponse {
    id: number;
    title: string;
    content: string;
    content_html: string;
    folder_id: number;
    created_at: string;
    updated_at: string;
}

export interface SatisfactionRating {
    id: number;
    survey_id: number;
    user_id: number;
    agent_id: number | null;
    feedback: string | null;
    ticket_id: number;
    group_id: number | null;
    ratings: Record<string, number>;
    created_at: string;
    updated_at: string;
}

export interface TimeEntry {
    id: number;
    billable: boolean;
    note: string | null;
    timer_running: boolean;
    agent_id: number;
    ticket_id: number;
    time_spent: string;
    start_time: string | null;
    executed_at: string;
    created_at: string;
    updated_at: string;
}

export interface SlaTarget {
    respond_within: number;
    resolve_within: number;
    business_hours: boolean;
    escalation_enabled: boolean;
}

export interface SlaPolicy {
    id: number;
    name: string;
    description: string | null;
    position: number;
    is_default: boolean;
    active: boolean;
    applicable_to: Record<string, unknown>;
    escalation: Record<string, unknown>;
    targets: Record<string, SlaTarget>;
    created_at: string;
    updated_at: string;
}

export interface TicketField {
    id: number;
    name: string;
    label: string;
    description: string | null;
    type: string;
    position: number;
    required_for_closure: boolean;
    required_for_agents: boolean;
    required_for_customers: boolean;
    choices: Array<Record<string, unknown>>;
    default: boolean;
    created_at: string;
    updated_at: string;
}

export interface AutomationRule {
    id: number;
    name: string;
    position: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

// Pagination wrapper
export interface PaginatedResult<T> {
    data: T[];
    page: number;
    per_page: number;
    has_more: boolean;
    total_count?: number;
}

// Search result (Freshdesk search API returns different shape)
export interface SearchResult<T> {
    results: T[];
    total: number;
}

// Bulk operation job status
export interface JobStatus {
    job_id: string;
    href: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
}

// Input types for creating/updating resources
export interface CreateTicketInput {
    subject: string;
    description: string;
    email?: string;
    requester_id?: number;
    priority?: TicketPriority;
    status?: TicketStatus;
    type?: string;
    group_id?: number;
    responder_id?: number;
    tags?: string[];
    cc_emails?: string[];
    custom_fields?: Record<string, unknown>;
}

export interface UpdateTicketInput {
    status?: TicketStatus;
    priority?: TicketPriority;
    group_id?: number;
    responder_id?: number;
    type?: string;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
}

export interface ReplyInput {
    body: string;
    cc_emails?: string[];
    bcc_emails?: string[];
}

export interface NoteInput {
    body: string;
    private?: boolean;
    notify_emails?: string[];
}

export interface CreateContactInput {
    name: string;
    email?: string;
    phone?: string;
    company_id?: number;
    description?: string;
    job_title?: string;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
}

export interface UpdateContactInput {
    name?: string;
    email?: string;
    phone?: string;
    company_id?: number;
    description?: string;
    job_title?: string;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
}

export interface CreateArticleInput {
    title: string;
    description: string;
    status?: number;
    tags?: string[];
    seo_data?: Record<string, unknown>;
}

export interface UpdateArticleInput {
    title?: string;
    description?: string;
    status?: number;
    tags?: string[];
}

export interface CreateCannedResponseInput {
    title: string;
    content: string;
    folder_id?: number;
}

export interface CreateTimeEntryInput {
    agent_id: number;
    billable?: boolean;
    time_spent: string;
    note?: string;
    executed_at?: string;
}

// List/filter params
export interface TicketListParams {
    filter?: string;
    page?: number;
    per_page?: number;
    order_by?: string;
    order_type?: string;
    updated_since?: string;
}

export interface ContactListParams {
    email?: string;
    phone?: string;
    company_id?: number;
    page?: number;
    per_page?: number;
}

export interface AgentListParams {
    state?: string;
    group_id?: number;
    page?: number;
}

export interface PaginationParams {
    page?: number;
    per_page?: number;
}

export interface SatisfactionParams {
    created_since?: string;
    created_until?: string;
    page?: number;
}
