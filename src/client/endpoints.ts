export const endpoints = {
    // Tickets
    tickets: () => '/tickets',
    ticket: (id: number) => `/tickets/${id}`,
    ticketSearch: () => '/search/tickets',
    ticketBulkUpdate: () => '/tickets/bulk_update',

    // Conversations
    ticketConversations: (ticketId: number) => `/tickets/${ticketId}/conversations`,
    ticketReply: (ticketId: number) => `/tickets/${ticketId}/reply`,
    ticketNote: (ticketId: number) => `/tickets/${ticketId}/notes`,

    // Contacts
    contacts: () => '/contacts',
    contact: (id: number) => `/contacts/${id}`,
    contactSearch: () => '/search/contacts',
    contactMerge: (id: number) => `/contacts/${id}/merge`,

    // Companies
    companies: () => '/companies',
    company: (id: number) => `/companies/${id}`,

    // Agents
    agents: () => '/agents',
    agent: (id: number) => `/agents/${id}`,
    agentMe: () => '/agents/me',

    // Groups
    groups: () => '/groups',
    group: (id: number) => `/groups/${id}`,

    // Solutions (Knowledge Base)
    solutionCategories: () => '/solutions/categories',
    solutionCategory: (id: number) => `/solutions/categories/${id}`,
    solutionFolders: (categoryId: number) => `/solutions/categories/${categoryId}/folders`,
    solutionFolder: (id: number) => `/solutions/folders/${id}`,
    solutionArticles: (folderId: number) => `/solutions/folders/${folderId}/articles`,
    solutionArticle: (id: number) => `/solutions/articles/${id}`,

    // Canned Responses
    cannedResponses: () => '/canned_responses',
    cannedResponse: (id: number) => `/canned_responses/${id}`,
    cannedResponseFolders: () => '/canned_response_folders',

    // Satisfaction Ratings
    satisfactionRatings: () => '/surveys/satisfaction_ratings',
    ticketSatisfactionRatings: (ticketId: number) =>
        `/tickets/${ticketId}/satisfaction_ratings`,

    // Time Entries
    ticketTimeEntries: (ticketId: number) => `/tickets/${ticketId}/time_entries`,
    timeEntry: (id: number) => `/time_entries/${id}`,

    // SLA Policies
    slaPolicies: () => '/sla_policies',

    // Ticket Fields
    ticketFields: () => '/ticket_fields',
    ticketField: (id: number) => `/ticket_fields/${id}`,

    // Automations
    automationRules: (type: string) => `/automations/${type}`,
} as const;
