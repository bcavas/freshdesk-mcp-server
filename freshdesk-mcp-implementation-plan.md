# Freshdesk MCP Server — Implementation Plan for Code Generation Agent

## Preamble: What This Document Is

This document is a **step-by-step implementation plan** for building an enterprise-grade MCP (Model Context Protocol) server for Freshdesk. It is written to be consumed by a **code generation agent** (e.g., Claude Code, Cursor Agent, Aider). Every instruction is concrete, deterministic, and ordered. Ambiguity has been eliminated wherever possible. Where design decisions remain open, the preferred option is stated explicitly.

**Do not deviate from the architecture, file structure, naming conventions, or dependency versions specified here unless a blocking incompatibility is discovered at build time.** If a deviation is required, document the reason and the alternative chosen before proceeding.

---

## Section 1: Project Identity and Repository Setup

### 1.1 Repository Metadata

| Field | Value |
|---|---|
| **Package name** | `@freshdesk-mcp/server` |
| **npm publish name** | `freshdesk-mcp-server` |
| **GitHub repo name** | `freshdesk-mcp-server` |
| **License** | MIT |
| **Node.js minimum** | 20.x LTS |
| **TypeScript version** | 5.5+ |
| **MCP SDK version** | `@modelcontextprotocol/sdk` ^1.27.0 |
| **Spec compliance** | MCP protocol version `2025-11-25` |

### 1.2 Initialize Repository

Execute the following commands to scaffold the project:

```bash
mkdir freshdesk-mcp-server && cd freshdesk-mcp-server
git init
npm init -y
```

Update `package.json` with:

```json
{
  "name": "freshdesk-mcp-server",
  "version": "0.1.0",
  "description": "Enterprise-grade MCP server for Freshdesk — agentic process automation for customer support",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "freshdesk-mcp": "dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "start:stdio": "node dist/cli.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/ --ext .ts",
    "lint:fix": "eslint src/ --ext .ts --fix",
    "format": "prettier --write 'src/**/*.ts'",
    "typecheck": "tsc --noEmit",
    "inspect": "npx @modelcontextprotocol/inspector dist/index.js",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "mcp",
    "freshdesk",
    "model-context-protocol",
    "ai-agent",
    "customer-support",
    "helpdesk",
    "agentic-automation"
  ],
  "engines": {
    "node": ">=20.0.0"
  },
  "files": [
    "dist/",
    "README.md",
    "LICENSE",
    "server.json"
  ]
}
```

### 1.3 Install Dependencies

**Runtime dependencies:**

```bash
npm install @modelcontextprotocol/sdk zod pino undici dotenv
```

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | Official MCP TypeScript SDK — server, transports, types |
| `zod` | Runtime + compile-time input validation for tool schemas |
| `pino` | Structured JSON logging |
| `undici` | HTTP client for Freshdesk API calls (Node.js native) |
| `dotenv` | Environment variable loading for local development |

**Development dependencies:**

```bash
npm install -D typescript tsup tsx vitest @vitest/coverage-v8 \
  eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  prettier nock @types/node
```

| Package | Purpose |
|---------|---------|
| `tsup` | Zero-config TypeScript bundler (ESM + CJS output) |
| `tsx` | TypeScript execution for development (watch mode) |
| `vitest` | Test runner with native TypeScript and ESM support |
| `@vitest/coverage-v8` | Code coverage via V8 |
| `nock` | HTTP request interception for mocking Freshdesk API |
| `eslint` + plugins | Linting |
| `prettier` | Code formatting |

### 1.4 Configuration Files

**`tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**`tsup.config.ts`:**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  shims: true,
});
```

**`vitest.config.ts`:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    testTimeout: 10000,
  },
});
```

**`.env.example`:**

```env
# Required
FRESHDESK_DOMAIN=yourcompany
FRESHDESK_API_KEY=your_api_key_here

# Optional — Server Configuration
MCP_TRANSPORT=streamable-http
MCP_PORT=3000
MCP_HOST=0.0.0.0

# Optional — Toolsets (comma-separated: core,kb,analytics,bulk,admin)
MCP_ENABLED_TOOLSETS=core

# Optional — Rate Limiting
RATE_LIMIT_BUFFER_PERCENT=20

# Optional — Logging
LOG_LEVEL=info

# Optional — Monetization (PayMCP / license key)
LICENSE_KEY_REQUIRED=false
PAYMCP_API_KEY=
```

**`.gitignore`:**

```
node_modules/
dist/
.env
*.log
coverage/
.turbo/
```

**`server.json`** (MCP Registry manifest):

```json
{
  "name": "freshdesk-mcp-server",
  "version": "0.1.0",
  "description": "Enterprise-grade MCP server for Freshdesk — agentic customer support automation",
  "homepage": "https://github.com/YOUR_USERNAME/freshdesk-mcp-server",
  "transport": {
    "streamableHttp": {
      "url": "https://your-deployment-url.azurewebsites.net/mcp"
    },
    "stdio": {
      "command": "npx",
      "args": ["freshdesk-mcp-server"]
    }
  },
  "auth": {
    "type": "api_key",
    "description": "Freshdesk API key (found in Profile Settings > Your API Key)"
  },
  "tools": 33,
  "categories": ["customer-support", "helpdesk", "ticketing"]
}
```

---

## Section 2: Directory Structure

Create the following directory tree. **Every file listed here must be created.** Files are described in detail in subsequent sections.

```
freshdesk-mcp-server/
├── src/
│   ├── index.ts                       # Remote server entry (Streamable HTTP)
│   ├── cli.ts                         # Local server entry (stdio)
│   ├── server.ts                      # MCP server factory — registers all tools
│   ├── config.ts                      # Configuration loading and validation
│   ├── logger.ts                      # Pino logger setup
│   │
│   ├── client/                        # Freshdesk API client layer
│   │   ├── freshdesk-client.ts        # Core HTTP client with auth, rate limiting, retries
│   │   ├── types.ts                   # Freshdesk API response types (TypeScript interfaces)
│   │   ├── endpoints.ts               # URL builder for all Freshdesk API routes
│   │   └── pagination.ts              # Auto-pagination helper with token-budget support
│   │
│   ├── tools/                         # MCP tool definitions (one file per toolset)
│   │   ├── registry.ts                # Tool registry — maps toolset names to tool arrays
│   │   ├── core/                      # Core toolset (always loaded)
│   │   │   ├── index.ts               # Exports all core tools
│   │   │   ├── tickets.ts             # Ticket CRUD + search tools
│   │   │   ├── contacts.ts            # Contact CRUD + search tools
│   │   │   ├── conversations.ts       # Reply, note, list conversations
│   │   │   └── agents.ts              # List agents, get agent
│   │   ├── kb/                        # Knowledge Base toolset
│   │   │   ├── index.ts
│   │   │   ├── articles.ts            # Solution article CRUD
│   │   │   ├── categories.ts          # Solution category/folder CRUD
│   │   │   └── canned-responses.ts    # Canned response CRUD + search
│   │   ├── analytics/                 # Analytics toolset
│   │   │   ├── index.ts
│   │   │   ├── satisfaction.ts        # CSAT ratings tools
│   │   │   └── time-entries.ts        # Time tracking tools
│   │   ├── bulk/                      # Bulk Operations toolset
│   │   │   ├── index.ts
│   │   │   ├── bulk-tickets.ts        # Bulk update, bulk delete, merge
│   │   │   └── bulk-contacts.ts       # Contact import/export
│   │   └── admin/                     # Admin toolset
│   │       ├── index.ts
│   │       ├── groups.ts              # Group CRUD
│   │       ├── ticket-fields.ts       # Custom field management
│   │       ├── sla-policies.ts        # SLA policy CRUD
│   │       └── automations.ts         # Automation rules listing
│   │
│   ├── middleware/                     # Cross-cutting concerns
│   │   ├── rate-limiter.ts            # Proactive rate limit tracking using response headers
│   │   ├── retry.ts                   # Exponential backoff with jitter for 429/5xx
│   │   ├── cache.ts                   # In-memory TTL cache (Map-based)
│   │   ├── redactor.ts               # PII field redaction
│   │   ├── input-guard.ts             # Prompt injection detection on tool inputs
│   │   └── license.ts                 # License key / credit validation (optional)
│   │
│   ├── errors/                        # Error handling
│   │   ├── freshdesk-error.ts         # Typed error classes for Freshdesk API errors
│   │   └── mcp-error-mapper.ts        # Maps Freshdesk errors to MCP tool errors
│   │
│   └── types/                         # Shared TypeScript types
│       ├── config.ts                  # Config schema (Zod)
│       ├── freshdesk.ts               # Freshdesk domain types (Ticket, Contact, etc.)
│       └── tools.ts                   # Tool input/output schema types
│
├── tests/
│   ├── unit/
│   │   ├── client/
│   │   │   ├── freshdesk-client.test.ts
│   │   │   └── pagination.test.ts
│   │   ├── tools/
│   │   │   ├── core/
│   │   │   │   ├── tickets.test.ts
│   │   │   │   ├── contacts.test.ts
│   │   │   │   └── conversations.test.ts
│   │   │   ├── kb/
│   │   │   │   └── articles.test.ts
│   │   │   └── bulk/
│   │   │       └── bulk-tickets.test.ts
│   │   └── middleware/
│   │       ├── rate-limiter.test.ts
│   │       ├── cache.test.ts
│   │       ├── redactor.test.ts
│   │       └── input-guard.test.ts
│   ├── integration/
│   │   ├── server-lifecycle.test.ts    # Server init/shutdown, capability negotiation
│   │   └── tool-execution.test.ts      # End-to-end tool calls via InMemoryTransport
│   └── fixtures/
│       ├── tickets.json                # Sample Freshdesk API responses
│       ├── contacts.json
│       ├── articles.json
│       └── errors.json                 # Sample error responses (401, 403, 404, 429)
│
├── infra/                              # Azure deployment (IaC)
│   ├── main.bicep                      # Azure Functions + supporting resources
│   ├── function-app/
│   │   ├── host.json
│   │   ├── local.settings.json
│   │   └── src/
│   │       └── functions/
│   │           └── mcp.ts              # Azure Function HTTP trigger wrapping the MCP server
│   └── .github/
│       └── workflows/
│           ├── ci.yml                  # Lint + typecheck + test + build on PR
│           └── deploy.yml              # Build + deploy to Azure on push to main
│
├── docs/
│   ├── TOOLS.md                        # Auto-generated tool reference
│   ├── CONFIGURATION.md                # All env vars and config options
│   └── DEPLOYMENT.md                   # Azure deployment guide
│
├── .env.example
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── server.json
├── LICENSE
├── README.md
└── package.json
```

---

## Section 3: Core Modules — Detailed Implementation Specifications

### 3.1 `src/config.ts` — Configuration Loading

This module loads, validates, and exports a typed configuration object. It is imported by every other module that needs configuration.

**Behavior:**
1. Read environment variables (with `dotenv` for local dev).
2. Validate against a Zod schema.
3. Export a frozen, typed `Config` object.
4. Throw a descriptive error at startup if required variables are missing.

**Zod schema definition:**

```typescript
import { z } from 'zod';

export const ConfigSchema = z.object({
  freshdesk: z.object({
    domain: z.string().min(1, 'FRESHDESK_DOMAIN is required'),
    apiKey: z.string().min(1, 'FRESHDESK_API_KEY is required'),
    baseUrl: z.string().url(), // computed: `https://${domain}.freshdesk.com/api/v2`
  }),
  server: z.object({
    transport: z.enum(['stdio', 'streamable-http']).default('streamable-http'),
    port: z.number().int().min(1).max(65535).default(3000),
    host: z.string().default('0.0.0.0'),
  }),
  toolsets: z.object({
    enabled: z.array(z.enum(['core', 'kb', 'analytics', 'bulk', 'admin'])).default(['core']),
  }),
  rateLimit: z.object({
    bufferPercent: z.number().min(0).max(50).default(20),
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  }),
  security: z.object({
    licenseKeyRequired: z.boolean().default(false),
    redactFields: z.array(z.string()).default(['phone', 'mobile', 'twitter_id']),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
```

**Loading function:**

```typescript
export function loadConfig(): Config {
  dotenv.config();
  const domain = process.env.FRESHDESK_DOMAIN ?? '';
  const raw = {
    freshdesk: {
      domain,
      apiKey: process.env.FRESHDESK_API_KEY ?? '',
      baseUrl: `https://${domain}.freshdesk.com/api/v2`,
    },
    server: {
      transport: process.env.MCP_TRANSPORT ?? 'streamable-http',
      port: parseInt(process.env.MCP_PORT ?? '3000', 10),
      host: process.env.MCP_HOST ?? '0.0.0.0',
    },
    toolsets: {
      enabled: (process.env.MCP_ENABLED_TOOLSETS ?? 'core').split(',').map(s => s.trim()),
    },
    rateLimit: {
      bufferPercent: parseInt(process.env.RATE_LIMIT_BUFFER_PERCENT ?? '20', 10),
    },
    logging: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    security: {
      licenseKeyRequired: process.env.LICENSE_KEY_REQUIRED === 'true',
      redactFields: process.env.REDACT_FIELDS?.split(',').map(s => s.trim()) ?? ['phone', 'mobile', 'twitter_id'],
    },
  };
  return Object.freeze(ConfigSchema.parse(raw));
}
```

### 3.2 `src/logger.ts` — Structured Logging

```typescript
import pino from 'pino';
import { loadConfig } from './config.js';

const config = loadConfig();

export const logger = pino({
  level: config.logging.level,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: 'freshdesk-mcp-server' },
});
```

Every Freshdesk API call, every tool invocation, and every error must be logged with structured context. Use child loggers for request-scoped context:

```typescript
const reqLogger = logger.child({ tool: 'get_ticket', ticketId: 42 });
reqLogger.info('Tool invoked');
```

### 3.3 `src/client/freshdesk-client.ts` — Freshdesk API Client

This is the **single module** that makes HTTP calls to the Freshdesk API. No other module should call the Freshdesk API directly. It wraps `undici` and integrates rate limiting, retry, caching, and redaction.

**Class signature:**

```typescript
export class FreshdeskClient {
  constructor(
    private config: Config,
    private rateLimiter: RateLimiter,
    private retrier: RetryHandler,
    private cache: Cache,
    private redactor: Redactor,
    private logger: pino.Logger,
  ) {}

  // Generic request method — all other methods delegate here
  async request<T>(method: string, path: string, options?: RequestOptions): Promise<T>;

  // Ticket operations
  async getTicket(id: number, include?: string[]): Promise<Ticket>;
  async listTickets(params?: TicketListParams): Promise<PaginatedResult<Ticket>>;
  async createTicket(data: CreateTicketInput): Promise<Ticket>;
  async updateTicket(id: number, data: UpdateTicketInput): Promise<Ticket>;
  async deleteTicket(id: number): Promise<void>;
  async searchTickets(query: string, page?: number): Promise<SearchResult<Ticket>>;
  async bulkUpdateTickets(ticketIds: number[], properties: Partial<Ticket>): Promise<JobStatus>;

  // Conversation operations
  async listConversations(ticketId: number): Promise<Conversation[]>;
  async replyToTicket(ticketId: number, body: ReplyInput): Promise<Conversation>;
  async addNote(ticketId: number, body: NoteInput): Promise<Conversation>;

  // Contact operations
  async getContact(id: number): Promise<Contact>;
  async listContacts(params?: ContactListParams): Promise<PaginatedResult<Contact>>;
  async createContact(data: CreateContactInput): Promise<Contact>;
  async updateContact(id: number, data: UpdateContactInput): Promise<Contact>;
  async searchContacts(query: string): Promise<SearchResult<Contact>>;

  // Company operations
  async getCompany(id: number): Promise<Company>;
  async listCompanies(params?: PaginationParams): Promise<PaginatedResult<Company>>;

  // Agent operations
  async getAgent(id: number): Promise<Agent>;
  async listAgents(params?: AgentListParams): Promise<PaginatedResult<Agent>>;
  async getCurrentAgent(): Promise<Agent>;

  // Group operations
  async listGroups(): Promise<Group[]>;
  async getGroup(id: number): Promise<Group>;

  // Solutions (Knowledge Base)
  async listSolutionCategories(): Promise<SolutionCategory[]>;
  async listSolutionFolders(categoryId: number): Promise<SolutionFolder[]>;
  async listSolutionArticles(folderId: number): Promise<SolutionArticle[]>;
  async getSolutionArticle(id: number): Promise<SolutionArticle>;
  async createSolutionArticle(folderId: number, data: CreateArticleInput): Promise<SolutionArticle>;
  async updateSolutionArticle(id: number, data: UpdateArticleInput): Promise<SolutionArticle>;
  async deleteSolutionArticle(id: number): Promise<void>;

  // Canned Responses
  async listCannedResponses(): Promise<CannedResponse[]>;
  async getCannedResponse(id: number): Promise<CannedResponse>;
  async createCannedResponse(data: CreateCannedResponseInput): Promise<CannedResponse>;

  // Satisfaction Ratings
  async listSatisfactionRatings(params?: SatisfactionParams): Promise<PaginatedResult<SatisfactionRating>>;

  // Time Entries
  async listTimeEntries(ticketId: number): Promise<TimeEntry[]>;
  async createTimeEntry(ticketId: number, data: CreateTimeEntryInput): Promise<TimeEntry>;

  // SLA Policies
  async listSlaPolicies(): Promise<SlaPolicy[]>;

  // Ticket Fields
  async listTicketFields(): Promise<TicketField[]>;

  // Automations
  async listAutomationRules(type: 'ticket_creation' | 'time_triggers' | 'ticket_update'): Promise<AutomationRule[]>;
}
```

**Critical implementation details for `request<T>()`:**

1. **Auth**: Encode API key as Base64 (`Buffer.from(apiKey + ':X').toString('base64')`), set `Authorization: Basic {encoded}`.
2. **Pre-flight rate check**: Before every request, call `rateLimiter.canProceed()`. If remaining calls are below the buffer threshold, delay the request using the `Retry-After` value or a computed backoff.
3. **Execute request**: Use `undici.request()` with the configured base URL.
4. **Post-flight rate update**: Parse `X-Ratelimit-Remaining` and `X-Ratelimit-Used-CurrentRequest` from response headers. Update `rateLimiter` state.
5. **Handle errors**: On HTTP 429, delegate to `retrier.handleRateLimit()`. On 4xx/5xx, throw a typed `FreshdeskApiError`.
6. **Cache check**: For GET requests, check cache before making the request. On cache hit, return cached value. On cache miss, make the request and cache the result with appropriate TTL.
7. **Redaction**: Before returning data, pass through `redactor.redact()` to strip configured PII fields.

### 3.4 `src/client/types.ts` — Freshdesk Domain Types

Define TypeScript interfaces for every Freshdesk API resource. These are **not Zod schemas** — they type the API responses after JSON parsing. Zod schemas are only for MCP tool inputs.

```typescript
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

export interface Conversation { /* id, body, body_text, incoming, private, user_id, support_email, source, ticket_id, to_emails, from_email, cc_emails, bcc_emails, attachments, created_at, updated_at */ }
export interface Contact { /* id, name, email, phone, mobile, company_id, address, description, job_title, language, time_zone, tags, custom_fields, created_at, updated_at */ }
export interface Company { /* id, name, description, domains, note, health_score, account_tier, renewal_date, industry, custom_fields, created_at, updated_at */ }
export interface Agent { /* id, contact (nested Contact), type, occasional, signature, ticket_scope, group_ids, role_ids, skill_ids, available, available_since, created_at, updated_at */ }
export interface Group { /* id, name, description, escalate_to, unassigned_for, business_hour_id, group_type, agent_ids, created_at, updated_at */ }
export interface SolutionCategory { /* id, name, description, visible_in_portals, created_at, updated_at */ }
export interface SolutionFolder { /* id, name, description, visibility, category_id, created_at, updated_at */ }
export interface SolutionArticle { /* id, title, description, description_text, status, type, category_id, folder_id, agent_id, thumbs_up, thumbs_down, hits, tags, seo_data, created_at, updated_at */ }
export interface CannedResponse { /* id, title, content, content_html, folder_id, created_at, updated_at */ }
export interface SatisfactionRating { /* id, survey_id, user_id, agent_id, feedback, ticket_id, group_id, ratings (object), created_at, updated_at */ }
export interface TimeEntry { /* id, billable, note, timer_running, agent_id, ticket_id, time_spent, start_time, executed_at, created_at, updated_at */ }
export interface SlaPolicy { /* id, name, description, position, is_default, active, applicable_to, escalation, targets, created_at, updated_at */ }
export interface TicketField { /* id, name, label, description, type, position, required_for_closure, required_for_agents, required_for_customers, choices, default, created_at, updated_at */ }
export interface AutomationRule { /* id, name, position, active, created_at, updated_at */ }

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
```

Fill in all fields for every interface. Use the Freshdesk API documentation at `https://developers.freshdesk.com/api/` as the canonical reference.

### 3.5 `src/client/endpoints.ts` — URL Builder

A pure-function module that constructs Freshdesk API paths. No HTTP logic.

```typescript
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
  ticketSatisfactionRatings: (ticketId: number) => `/tickets/${ticketId}/satisfaction_ratings`,

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
```

### 3.6 `src/client/pagination.ts` — Auto-Pagination

```typescript
export interface PaginationOptions {
  maxPages?: number;          // Hard limit on pages (default: 10)
  perPage?: number;           // Items per page (default: 30, max: 100)
  tokenBudget?: number;       // Approximate token budget — stop when exceeded
}

export async function autoPaginate<T>(
  fetchPage: (page: number, perPage: number) => Promise<{ data: T[]; hasMore: boolean }>,
  options: PaginationOptions = {},
): Promise<PaginatedResult<T>> {
  const maxPages = options.maxPages ?? 10;
  const perPage = Math.min(options.perPage ?? 30, 100);
  const tokenBudget = options.tokenBudget ?? 50000;

  const allData: T[] = [];
  let currentPage = 1;
  let hasMore = true;
  let estimatedTokens = 0;

  while (hasMore && currentPage <= maxPages && estimatedTokens < tokenBudget) {
    const result = await fetchPage(currentPage, perPage);
    allData.push(...result.data);
    hasMore = result.hasMore;

    // Rough token estimate: 1 token ≈ 4 chars of JSON
    estimatedTokens += JSON.stringify(result.data).length / 4;
    currentPage++;
  }

  return {
    data: allData,
    page: currentPage - 1,
    per_page: perPage,
    has_more: hasMore,
    total_count: allData.length,
  };
}
```

---

## Section 4: Middleware Modules

### 4.1 `src/middleware/rate-limiter.ts`

Tracks Freshdesk rate limit state from response headers. Does **not** use a token bucket — instead, mirrors the server's actual state.

```typescript
export class RateLimiter {
  private remaining: number = Infinity;
  private total: number = Infinity;
  private resetAt: number = 0;
  private bufferPercent: number;

  constructor(bufferPercent: number = 20) {
    this.bufferPercent = bufferPercent;
  }

  updateFromHeaders(headers: Record<string, string>): void {
    if (headers['x-ratelimit-total']) this.total = parseInt(headers['x-ratelimit-total'], 10);
    if (headers['x-ratelimit-remaining']) this.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    // Freshdesk rate limits reset every 60 seconds
    this.resetAt = Date.now() + 60_000;
  }

  canProceed(): { allowed: boolean; delayMs: number } {
    const buffer = Math.ceil(this.total * (this.bufferPercent / 100));
    if (this.remaining > buffer) return { allowed: true, delayMs: 0 };
    if (this.remaining > 0) {
      const delayMs = Math.max(0, this.resetAt - Date.now());
      return { allowed: true, delayMs }; // Proceed after delay
    }
    return { allowed: false, delayMs: Math.max(0, this.resetAt - Date.now()) };
  }

  getStatus(): { remaining: number; total: number; resetAt: number } {
    return { remaining: this.remaining, total: this.total, resetAt: this.resetAt };
  }
}
```

### 4.2 `src/middleware/retry.ts`

Exponential backoff with jitter. Handles HTTP 429 (rate limit) and 5xx (server errors).

```typescript
export interface RetryOptions {
  maxRetries?: number;   // default: 3
  baseDelayMs?: number;  // default: 1000
  maxDelayMs?: number;   // default: 30000
}

export class RetryHandler {
  private opts: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.opts = {
      maxRetries: options.maxRetries ?? 3,
      baseDelayMs: options.baseDelayMs ?? 1000,
      maxDelayMs: options.maxDelayMs ?? 30000,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        if (!this.isRetryable(err) || attempt === this.opts.maxRetries) throw err;
        const delay = this.calculateDelay(attempt, err);
        await this.sleep(delay);
      }
    }
    throw lastError;
  }

  private isRetryable(err: any): boolean {
    const status = err.statusCode ?? err.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  private calculateDelay(attempt: number, err: any): number {
    // Use Retry-After header if present (429 responses)
    const retryAfter = err.retryAfter;
    if (retryAfter) return retryAfter * 1000;
    // Exponential backoff with full jitter
    const exponential = this.opts.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * exponential;
    return Math.min(jitter, this.opts.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4.3 `src/middleware/cache.ts`

Simple in-memory TTL cache. No external dependencies.

```typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class Cache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;

  // TTL presets by data type
  static readonly TTL = {
    AGENTS: 60 * 60 * 1000,       // 1 hour — rarely changes
    GROUPS: 60 * 60 * 1000,       // 1 hour
    TICKET_FIELDS: 30 * 60 * 1000, // 30 min
    SLA_POLICIES: 30 * 60 * 1000,  // 30 min
    CANNED_RESPONSES: 15 * 60 * 1000, // 15 min
    TICKETS: 2 * 60 * 1000,        // 2 min — changes frequently
    CONTACTS: 5 * 60 * 1000,       // 5 min
    SEARCH: 0,                     // Never cache search results
  };

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  get<T>(key: string): T | undefined { /* check expiry, return or delete */ }
  set<T>(key: string, value: T, ttlMs?: number): void { /* store with expiry */ }
  invalidate(key: string): void { /* delete single key */ }
  invalidatePrefix(prefix: string): void { /* delete all keys starting with prefix */ }
  clear(): void { /* clear all */ }
  private cleanup(): void { /* remove expired entries */ }
}
```

### 4.4 `src/middleware/redactor.ts`

Strips PII fields from Freshdesk API responses before they reach the LLM.

```typescript
export class Redactor {
  private fieldsToRedact: Set<string>;

  constructor(fields: string[] = ['phone', 'mobile', 'twitter_id']) {
    this.fieldsToRedact = new Set(fields);
  }

  redact<T extends Record<string, unknown>>(obj: T): T {
    const redacted = { ...obj };
    for (const key of Object.keys(redacted)) {
      if (this.fieldsToRedact.has(key) && redacted[key] != null) {
        (redacted as any)[key] = '[REDACTED]';
      }
      // Recurse into nested objects (e.g., custom_fields, requester)
      if (typeof redacted[key] === 'object' && redacted[key] !== null && !Array.isArray(redacted[key])) {
        (redacted as any)[key] = this.redact(redacted[key] as Record<string, unknown>);
      }
    }
    return redacted;
  }
}
```

### 4.5 `src/middleware/input-guard.ts`

Detects prompt injection patterns in tool inputs.

```typescript
const INJECTION_PATTERNS = [
  /<IMPORTANT>/i,
  /ignore\s+(previous|all|above)\s+instructions/i,
  /you\s+are\s+now/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /\u200b/,    // zero-width space
  /\u200e/,    // left-to-right mark
  /\ufeff/,    // BOM
];

export class InputGuard {
  validate(input: Record<string, unknown>): { safe: boolean; reason?: string } {
    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== 'string') continue;
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(value)) {
          return { safe: false, reason: `Suspicious pattern detected in field '${key}'` };
        }
      }
    }
    return { safe: true };
  }
}
```

---

## Section 5: MCP Tool Definitions

### 5.1 Tool Design Principles (Apply to ALL tools)

1. **Every tool function receives the FreshdeskClient instance and logger as parameters.** Tools do not construct their own clients.
2. **Every tool input is validated with a Zod schema.** The schema is exported alongside the tool for use in tests and documentation generation.
3. **Every tool returns both `content` (human-readable text for the LLM) and `structuredContent` (typed JSON for agentic workflows).**
4. **Every tool has tool annotations** declaring `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`.
5. **Errors are returned as tool results with `isError: true`**, not as protocol errors. Error messages must be actionable (suggest corrections).
6. **Input guard validation runs before every tool execution.**

### 5.2 Tool Registration Pattern

Each toolset module exports a function that returns an array of tool definitions:

```typescript
// src/tools/core/tickets.ts
import { z } from 'zod';
import type { FreshdeskClient } from '../../client/freshdesk-client.js';
import type { Logger } from 'pino';

// --- Input Schemas ---

export const GetTicketInputSchema = z.object({
  ticket_id: z.number().int().positive().describe('The Freshdesk ticket ID'),
  include: z.array(z.enum(['conversations', 'requester', 'company', 'stats']))
    .optional()
    .describe('Related data to include. Each inclusion costs extra API credits.'),
});

export const ListTicketsInputSchema = z.object({
  filter: z.enum(['new_and_my_open', 'watching', 'spam', 'deleted', 'all_tickets'])
    .optional()
    .default('all_tickets')
    .describe('Predefined ticket filter'),
  page: z.number().int().min(1).optional().default(1),
  per_page: z.number().int().min(1).max(100).optional().default(30),
  order_by: z.enum(['created_at', 'due_by', 'updated_at', 'status'])
    .optional()
    .default('created_at'),
  order_type: z.enum(['asc', 'desc']).optional().default('desc'),
  updated_since: z.string().datetime().optional().describe('ISO 8601 datetime — only return tickets updated after this time'),
});

export const SearchTicketsInputSchema = z.object({
  query: z.string().min(1).max(512).describe(
    'Freshdesk search query. Examples: "status:2 AND priority:3", "tag:\'billing\'", "requester_id:12345". Supported fields: agent_id, group_id, priority, status, tag, type, due_by, fr_due_by, created_at, requester_id, company_id.'
  ),
  page: z.number().int().min(1).max(10).optional().default(1)
    .describe('Page number (max 10 pages × 30 results = 300 total)'),
});

export const UpdateTicketInputSchema = z.object({
  ticket_id: z.number().int().positive(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  group_id: z.number().int().positive().optional(),
  responder_id: z.number().int().positive().optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.unknown()).optional(),
}).refine(data => {
  const { ticket_id, ...updates } = data;
  return Object.keys(updates).length > 0;
}, 'At least one field to update must be provided besides ticket_id');

export const CreateTicketInputSchema = z.object({
  subject: z.string().min(1).max(255),
  description: z.string().min(1).describe('HTML content of the ticket'),
  email: z.string().email().optional().describe('Requester email (creates contact if new)'),
  requester_id: z.number().int().positive().optional(),
  priority: z.nativeEnum(TicketPriority).optional().default(TicketPriority.Low),
  status: z.nativeEnum(TicketStatus).optional().default(TicketStatus.Open),
  type: z.string().optional(),
  group_id: z.number().int().positive().optional(),
  responder_id: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  cc_emails: z.array(z.string().email()).optional(),
  custom_fields: z.record(z.unknown()).optional(),
}).refine(data => data.email || data.requester_id, 'Either email or requester_id is required');

// --- Tool Definitions ---

export function registerTicketTools(client: FreshdeskClient, logger: Logger) {
  return [
    {
      name: 'get_ticket',
      description: 'Retrieve a single Freshdesk ticket by ID with optional related data (conversations, requester, company, stats). Use include=["stats"] to get SLA timestamps. Use include=["conversations"] to get the full thread.',
      inputSchema: GetTicketInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      handler: async (input: z.infer<typeof GetTicketInputSchema>) => {
        const ticket = await client.getTicket(input.ticket_id, input.include);
        return {
          content: [{ type: 'text', text: formatTicketSummary(ticket) }],
          structuredContent: { type: 'object', value: ticket },
        };
      },
    },
    {
      name: 'list_tickets',
      description: 'List Freshdesk tickets with filtering, sorting, and pagination. Returns up to 100 tickets per page. Use updated_since to get recent changes only. Default sort: newest first.',
      inputSchema: ListTicketsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      handler: async (input: z.infer<typeof ListTicketsInputSchema>) => { /* ... */ },
    },
    {
      name: 'search_tickets',
      description: 'Search tickets using Freshdesk query language. Max 300 results total (30/page × 10 pages). Query syntax: "status:2 AND priority:4" for open+urgent. Searchable: agent_id, group_id, priority, status, tag, type, due_by, fr_due_by, created_at, updated_at, requester_id, company_id. Date format: \'YYYY-MM-DD\'.',
      inputSchema: SearchTicketsInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      handler: async (input: z.infer<typeof SearchTicketsInputSchema>) => { /* ... */ },
    },
    {
      name: 'update_ticket',
      description: 'Update a ticket\'s properties (status, priority, assignment, tags, custom fields). Cannot update subject or description of outbound tickets. Provide only the fields you want to change.',
      inputSchema: UpdateTicketInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      handler: async (input: z.infer<typeof UpdateTicketInputSchema>) => { /* ... */ },
    },
    {
      name: 'create_ticket',
      description: 'Create a new support ticket. Requires either email (auto-creates contact) or requester_id. Returns the created ticket with its ID. Use for programmatic ticket creation, not customer replies.',
      inputSchema: CreateTicketInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      handler: async (input: z.infer<typeof CreateTicketInputSchema>) => { /* ... */ },
    },
  ];
}
```

### 5.3 Complete Tool Inventory Per Toolset

#### CORE Toolset (always loaded — 15 tools)

| # | Tool Name | Freshdesk Endpoint(s) | R/W | Input Fields |
|---|-----------|----------------------|-----|-------------|
| 1 | `get_ticket` | `GET /tickets/{id}` | R | `ticket_id`, `include?[]` |
| 2 | `list_tickets` | `GET /tickets` | R | `filter?`, `page?`, `per_page?`, `order_by?`, `order_type?`, `updated_since?` |
| 3 | `search_tickets` | `GET /search/tickets` | R | `query`, `page?` |
| 4 | `create_ticket` | `POST /tickets` | W | `subject`, `description`, `email?`, `requester_id?`, `priority?`, `status?`, `type?`, `group_id?`, `responder_id?`, `tags?[]`, `cc_emails?[]`, `custom_fields?{}` |
| 5 | `update_ticket` | `PUT /tickets/{id}` | W | `ticket_id`, `status?`, `priority?`, `group_id?`, `responder_id?`, `type?`, `tags?[]`, `custom_fields?{}` |
| 6 | `reply_to_ticket` | `POST /tickets/{id}/reply` | W | `ticket_id`, `body` (HTML), `cc_emails?[]`, `bcc_emails?[]` |
| 7 | `add_note` | `POST /tickets/{id}/notes` | W | `ticket_id`, `body` (HTML), `private?` (default: true), `notify_emails?[]` |
| 8 | `list_conversations` | `GET /tickets/{id}/conversations` | R | `ticket_id`, `page?`, `per_page?` |
| 9 | `get_contact` | `GET /contacts/{id}` | R | `contact_id` |
| 10 | `list_contacts` | `GET /contacts` | R | `email?`, `phone?`, `company_id?`, `page?`, `per_page?` |
| 11 | `search_contacts` | `GET /search/contacts` | R | `query`, `page?` |
| 12 | `create_contact` | `POST /contacts` | W | `name`, `email?`, `phone?`, `company_id?`, `description?`, `job_title?`, `tags?[]`, `custom_fields?{}` |
| 13 | `update_contact` | `PUT /contacts/{id}` | W | `contact_id`, plus any mutable field |
| 14 | `list_agents` | `GET /agents` | R | `state?` (fulltime/occasional/all), `group_id?`, `page?` |
| 15 | `get_agent` | `GET /agents/{id}` | R | `agent_id` |

#### KB Toolset (opt-in — 8 tools)

| # | Tool Name | Freshdesk Endpoint(s) | R/W | Input Fields |
|---|-----------|----------------------|-----|-------------|
| 16 | `list_solution_categories` | `GET /solutions/categories` | R | none |
| 17 | `list_solution_articles` | `GET /solutions/folders/{id}/articles` | R | `folder_id`, `page?` |
| 18 | `get_solution_article` | `GET /solutions/articles/{id}` | R | `article_id` |
| 19 | `create_solution_article` | `POST /solutions/folders/{id}/articles` | W | `folder_id`, `title`, `description` (HTML body), `status?` (draft/published), `tags?[]`, `seo_data?{}` |
| 20 | `update_solution_article` | `PUT /solutions/articles/{id}` | W | `article_id`, `title?`, `description?`, `status?`, `tags?[]` |
| 21 | `delete_solution_article` | `DELETE /solutions/articles/{id}` | W | `article_id` |
| 22 | `list_canned_responses` | `GET /canned_responses` | R | `search_term?` (client-side filter) |
| 23 | `get_canned_response` | `GET /canned_responses/{id}` | R | `canned_response_id` |

#### Analytics Toolset (opt-in — 4 tools)

| # | Tool Name | Freshdesk Endpoint(s) | R/W | Input Fields |
|---|-----------|----------------------|-----|-------------|
| 24 | `list_satisfaction_ratings` | `GET /surveys/satisfaction_ratings` | R | `created_since?`, `created_until?`, `page?` |
| 25 | `get_ticket_satisfaction` | `GET /tickets/{id}/satisfaction_ratings` | R | `ticket_id` |
| 26 | `list_time_entries` | `GET /tickets/{id}/time_entries` | R | `ticket_id` |
| 27 | `create_time_entry` | `POST /tickets/{id}/time_entries` | W | `ticket_id`, `agent_id`, `billable?`, `time_spent` (HH:MM format), `note?`, `executed_at?` |

#### Bulk Toolset (opt-in — 3 tools)

| # | Tool Name | Freshdesk Endpoint(s) | R/W | Input Fields |
|---|-----------|----------------------|-----|-------------|
| 28 | `bulk_update_tickets` | `POST /tickets/bulk_update` | W | `ticket_ids[]` (max 25), `properties{}` (status, priority, group_id, responder_id, type) |
| 29 | `delete_ticket` | `DELETE /tickets/{id}` | W | `ticket_id` |
| 30 | `merge_contacts` | `POST /contacts/{id}/merge` | W | `primary_contact_id`, `secondary_contact_ids[]` |

#### Admin Toolset (opt-in — 3 tools)

| # | Tool Name | Freshdesk Endpoint(s) | R/W | Input Fields |
|---|-----------|----------------------|-----|-------------|
| 31 | `list_groups` | `GET /groups` | R | none |
| 32 | `list_ticket_fields` | `GET /ticket_fields` | R | none |
| 33 | `list_sla_policies` | `GET /sla_policies` | R | none |

### 5.4 `src/tools/registry.ts` — Toolset Registry

```typescript
import type { FreshdeskClient } from '../client/freshdesk-client.js';
import type { Logger } from 'pino';
import { registerTicketTools } from './core/tickets.js';
import { registerContactTools } from './core/contacts.js';
import { registerConversationTools } from './core/conversations.js';
import { registerAgentTools } from './core/agents.js';
import { registerKbTools } from './kb/index.js';
import { registerAnalyticsTools } from './analytics/index.js';
import { registerBulkTools } from './bulk/index.js';
import { registerAdminTools } from './admin/index.js';

type ToolsetName = 'core' | 'kb' | 'analytics' | 'bulk' | 'admin';

const TOOLSET_FACTORIES: Record<ToolsetName, (client: FreshdeskClient, logger: Logger) => ToolDefinition[]> = {
  core: (client, logger) => [
    ...registerTicketTools(client, logger),
    ...registerContactTools(client, logger),
    ...registerConversationTools(client, logger),
    ...registerAgentTools(client, logger),
  ],
  kb: registerKbTools,
  analytics: registerAnalyticsTools,
  bulk: registerBulkTools,
  admin: registerAdminTools,
};

export function resolveTools(
  enabledToolsets: ToolsetName[],
  client: FreshdeskClient,
  logger: Logger,
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  for (const name of enabledToolsets) {
    const factory = TOOLSET_FACTORIES[name];
    if (factory) tools.push(...factory(client, logger));
  }
  return tools;
}
```

---

## Section 6: Server Assembly and Entry Points

### 6.1 `src/server.ts` — Server Factory

This is the central assembly module. It wires together config, client, middleware, and tools.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig, type Config } from './config.js';
import { logger } from './logger.js';
import { FreshdeskClient } from './client/freshdesk-client.js';
import { RateLimiter } from './middleware/rate-limiter.js';
import { RetryHandler } from './middleware/retry.js';
import { Cache } from './middleware/cache.js';
import { Redactor } from './middleware/redactor.js';
import { InputGuard } from './middleware/input-guard.js';
import { resolveTools } from './tools/registry.js';

export function createServer(config?: Config): McpServer {
  const cfg = config ?? loadConfig();

  // Initialize middleware
  const rateLimiter = new RateLimiter(cfg.rateLimit.bufferPercent);
  const retrier = new RetryHandler();
  const cache = new Cache();
  const redactor = new Redactor(cfg.security.redactFields);
  const inputGuard = new InputGuard();

  // Initialize Freshdesk client
  const client = new FreshdeskClient(cfg, rateLimiter, retrier, cache, redactor, logger);

  // Initialize MCP server
  const server = new McpServer({
    name: 'freshdesk-mcp-server',
    version: '0.1.0',
  }, {
    capabilities: {
      tools: { listChanged: true },
      logging: {},
    },
  });

  // Register tools
  const tools = resolveTools(cfg.toolsets.enabled, client, logger);

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.shape,        // Zod shape for MCP SDK
      tool.annotations,
      async (input: unknown) => {
        // Validate input
        const parsed = tool.inputSchema.safeParse(input);
        if (!parsed.success) {
          return {
            content: [{ type: 'text', text: `Invalid input: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}` }],
            isError: true,
          };
        }

        // Input guard check
        const guardResult = inputGuard.validate(parsed.data);
        if (!guardResult.safe) {
          logger.warn({ tool: tool.name, reason: guardResult.reason }, 'Input guard rejected');
          return {
            content: [{ type: 'text', text: `Request rejected: ${guardResult.reason}` }],
            isError: true,
          };
        }

        // Execute tool
        try {
          return await tool.handler(parsed.data);
        } catch (err: any) {
          logger.error({ tool: tool.name, err }, 'Tool execution failed');
          return mapErrorToToolResult(err);
        }
      },
    );
  }

  return server;
}
```

### 6.2 `src/index.ts` — Remote Server Entry Point (Streamable HTTP)

```typescript
import { createServer } from './server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const config = loadConfig();
const mcpServer = createServer(config);

const transports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }));
    return;
  }

  // MCP endpoint
  if (url.pathname === '/mcp') {
    // Handle POST (tool calls, initialize)
    if (req.method === 'POST') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else if (!sessionId) {
        // New session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => { transports.set(id, transport); },
        });
        transport.onclose = () => {
          const id = [...transports.entries()].find(([_, t]) => t === transport)?.[0];
          if (id) transports.delete(id);
        };
        await mcpServer.connect(transport);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid session ID' }));
        return;
      }

      await transport.handleRequest(req, res);
      return;
    }

    // Handle GET (SSE stream for server-to-client notifications)
    if (req.method === 'GET') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports.has(sessionId)) {
        res.writeHead(400);
        res.end('Missing or invalid session ID');
        return;
      }
      await transports.get(sessionId)!.handleRequest(req, res);
      return;
    }

    // Handle DELETE (session termination)
    if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        await transports.get(sessionId)!.close();
        transports.delete(sessionId);
      }
      res.writeHead(200);
      res.end();
      return;
    }

    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(config.server.port, config.server.host, () => {
  logger.info({ port: config.server.port, host: config.server.host }, 'Freshdesk MCP server listening (Streamable HTTP)');
});
```

### 6.3 `src/cli.ts` — Local Server Entry Point (stdio)

```typescript
#!/usr/bin/env node
import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';

const config = loadConfig();
config.server.transport = 'stdio'; // Override for CLI

const server = createServer(config);
const transport = new StdioServerTransport();

await server.connect(transport);
```

---

## Section 7: Error Handling

### 7.1 `src/errors/freshdesk-error.ts`

```typescript
export class FreshdeskApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly retryAfter?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'FreshdeskApiError';
  }

  static fromResponse(status: number, body: any, headers: Record<string, string>): FreshdeskApiError {
    const retryAfter = headers['retry-after'] ? parseInt(headers['retry-after'], 10) : undefined;
    const errorCode = body?.code ?? `HTTP_${status}`;
    const message = body?.message ?? body?.description ?? `Freshdesk API error: HTTP ${status}`;
    return new FreshdeskApiError(status, errorCode, message, retryAfter, body?.errors);
  }
}
```

### 7.2 `src/errors/mcp-error-mapper.ts`

Maps Freshdesk errors to actionable MCP tool error responses:

```typescript
export function mapErrorToToolResult(err: unknown) {
  if (err instanceof FreshdeskApiError) {
    const suggestions: Record<number, string> = {
      401: 'Check your FRESHDESK_API_KEY — it may be invalid or expired. Find it in Freshdesk > Profile Settings > Your API Key.',
      403: 'Your API key lacks permission for this operation. Check the agent role in Freshdesk admin.',
      404: 'The requested resource was not found. Verify the ID is correct.',
      409: 'Conflict — this resource may have been modified concurrently. Retry with fresh data.',
      429: 'Rate limit exceeded. The server will automatically retry. If persistent, reduce request frequency.',
    };
    const suggestion = suggestions[err.statusCode] ?? 'An unexpected Freshdesk API error occurred.';
    return {
      content: [{ type: 'text', text: `Freshdesk API Error (${err.statusCode}): ${err.message}. ${suggestion}` }],
      isError: true,
    };
  }
  return {
    content: [{ type: 'text', text: `Unexpected error: ${err instanceof Error ? err.message : String(err)}` }],
    isError: true,
  };
}
```

---

## Section 8: Testing Requirements

### 8.1 Unit Test Requirements

**For every tool handler**, write tests covering:
1. **Happy path**: Valid input returns expected output with correct `content` and `structuredContent`.
2. **Validation rejection**: Invalid input (wrong types, missing required fields) returns `isError: true` with a descriptive message.
3. **Freshdesk error mapping**: Simulate 401, 403, 404, 429, 500 responses and verify actionable error messages.
4. **Input guard rejection**: Pass injection patterns and verify rejection.
5. **Pagination**: Verify multi-page results are correctly assembled.

**For middleware modules**, write tests covering:
1. **RateLimiter**: Header parsing, buffer threshold behavior, delay calculation.
2. **RetryHandler**: Exponential backoff timing, max retry respect, non-retryable error passthrough.
3. **Cache**: TTL expiry, prefix invalidation, concurrent access.
4. **Redactor**: Nested object redaction, array handling, selective field targeting.
5. **InputGuard**: Each injection pattern triggers rejection; clean inputs pass.

Use `nock` to mock all Freshdesk HTTP calls in unit tests. Place mock response fixtures in `tests/fixtures/`.

### 8.2 Integration Test Requirements

Use `InMemoryTransport` from the MCP SDK to test the full server lifecycle:

```typescript
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

test('server lifecycle: initialize, list tools, call tool, shutdown', async () => {
  const server = createServer(testConfig);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });

  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  const { tools } = await client.listTools();
  expect(tools.length).toBeGreaterThanOrEqual(15); // Core toolset

  const result = await client.callTool({ name: 'get_ticket', arguments: { ticket_id: 1 } });
  expect(result.isError).toBeFalsy();

  await client.close();
});
```

### 8.3 Coverage Targets

| Metric | Minimum | Target |
|--------|---------|--------|
| Line coverage | 80% | 90% |
| Branch coverage | 80% | 85% |
| Function coverage | 80% | 90% |
| Statement coverage | 80% | 90% |

---

## Section 9: Azure Deployment

### 9.1 Azure Functions Approach

Create `infra/function-app/src/functions/mcp.ts`:

```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createServer } from '../../../../src/server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const mcpServer = createServer();
// Session management per Azure Functions documentation for MCP

app.http('mcp', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous', // Auth handled at MCP/OAuth layer
  route: 'mcp',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // Delegate to StreamableHTTPServerTransport
    // Follow the pattern from: https://learn.microsoft.com/en-us/azure/azure-functions/scenario-custom-remote-mcp-server
  },
});
```

### 9.2 `infra/main.bicep` — Azure Resources

The Bicep template must provision:
1. **Azure Functions App** (Flex Consumption plan, Node.js 20 runtime)
2. **Storage Account** (required by Functions)
3. **Application Insights** (telemetry)
4. **Key Vault** (store `FRESHDESK_API_KEY` as a secret, reference via app settings)
5. **Managed Identity** (system-assigned, granted Key Vault secret read access)

### 9.3 GitHub Actions CI/CD

**`.github/workflows/ci.yml`** — runs on every PR:
```yaml
name: CI
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
```

**`.github/workflows/deploy.yml`** — runs on push to `main`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build
      - uses: azure/login@v2
        with: { creds: '${{ secrets.AZURE_CREDENTIALS }}' }
      - uses: azure/functions-action@v1
        with:
          app-name: freshdesk-mcp-server
          package: .
```

---

## Section 10: Implementation Phases and Task Sequencing

### Phase 1: Foundation (Days 1–5)

Execute in this exact order:

| Day | Task | Deliverable | Verification |
|-----|------|-------------|-------------|
| 1 | [DONE] Repository setup, all config files from Section 1 | Compiling, linting TypeScript project | `npm run build` succeeds with zero errors |
| 1 | [DONE] Implement `config.ts`, `logger.ts` | Validated config loading | Unit test: missing env vars throw descriptive error |
| 2 | [DONE] Implement `FreshdeskClient.request()` with auth | Authenticated API calls | Manual test: `GET /agents/me` returns current agent |
| 2 | [DONE] Implement `RateLimiter`, `RetryHandler` | Rate-aware, retry-capable client | Unit tests: header parsing, backoff timing |
| 3 | [DONE] Implement `Cache`, `Redactor`, `InputGuard` | All middleware operational | Unit tests per Section 8.1 |
| 3 | [DONE] Implement `endpoints.ts`, `pagination.ts` | URL builder and auto-paginator | Unit tests: URL construction, multi-page assembly |
| 4 | [DONE] Implement `FreshdeskClient` — all ticket methods | Complete ticket API coverage | Unit tests with nock mocks |
| 4 | [DONE] Implement `FreshdeskClient` — contact, agent methods | Complete contact/agent coverage | Unit tests with nock mocks |
| 5 | [DONE] Implement `freshdesk-error.ts`, `mcp-error-mapper.ts` | Typed error handling | Unit tests: each HTTP status maps to actionable message |
| 5 | [DONE] Integration test: full client against Freshdesk sandbox | Verified API compatibility | Manual + automated: CRUD cycle on sandbox |

### Phase 2: Core Toolset (Days 6–10)

| Day | Task | Deliverable | Verification |
|-----|------|-------------|-------------|
| 6 | [DONE] Implement `server.ts` (server factory) | MCP server with tool registration | Integration test: `listTools()` returns tools |
| 6 | [DONE] Implement `cli.ts` and `index.ts` entry points | Dual-transport server | `npm run start:stdio` and `npm run start` both work |
| 7 | [DONE] Implement ticket tools (5 tools) | `get_ticket`, `list_tickets`, `search_tickets`, `update_ticket`, `create_ticket` | Unit tests + MCP Inspector validation |
| 8 | [DONE] Implement conversation tools (3 tools) | `reply_to_ticket`, `add_note`, `list_conversations` | Unit tests + MCP Inspector validation |
| 8 | [DONE] Implement contact tools (5 tools) | `get_contact`, `list_contacts`, `search_contacts`, `create_contact`, `update_contact` | Unit tests + MCP Inspector validation |
| 9 | [DONE] Implement agent tools (2 tools) | `list_agents`, `get_agent` | Unit tests + MCP Inspector |
| 9 | [DONE] Tool registry, toolset resolution | Configurable toolset loading | Integration test: enabling/disabling toolsets changes tool count |
| 10 | [DONE] Full integration test suite | Server lifecycle tests passing | `npm run test` — all green, coverage ≥ 80% |
| 10 | [DONE] MCP Inspector end-to-end validation | Every core tool callable via Inspector | Manual: run Inspector, invoke each tool |

### Phase 3: Extended Toolsets (Days 11–16)

| Day | Task | Deliverable | Verification |
|-----|------|-------------|-------------|
| 11 | [DONE] KB toolset — article tools (6 tools) | Solution CRUD + canned responses | Unit tests + Inspector |
| 12 | [DONE] Analytics toolset (4 tools) | CSAT ratings + time entries | Unit tests + Inspector |
| 13 | [DONE] Bulk toolset (3 tools) | Bulk update, delete, merge | Unit tests (mock async job responses) |
| 14 | [DONE] Admin toolset (3 tools) | Groups, fields, SLA policies | Unit tests + Inspector |
| 15 | [DONE] Cross-toolset integration tests | All 33 tools operational | Full test suite passing |
| 16 | [DONE] Performance optimization: cache tuning, response sizing | Sub-200ms median tool latency (cached) | k6 load test: 50 concurrent clients |

### Phase 4: Deployment and Distribution (Days 17–22)

| Day | Task | Deliverable | Verification |
|-----|------|-------------|-------------|
| 17 | [DONE] Azure Functions setup: Bicep template, deploy first version | Live `/mcp` endpoint on Azure | `curl https://your-app.azurewebsites.net/health` returns 200 |
| 18 | [DONE] Azure Key Vault integration, managed identity | Secrets not in env vars | App settings reference Key Vault, API calls succeed |
| 18 | [DONE] GitHub Actions CI/CD | Automated test + deploy pipeline | Push to main triggers deploy, PR triggers CI |
| 19 | [DONE] npm publish preparation: README, TOOLS.md, CONFIGURATION.md | Publish-ready package | `npm pack` produces clean tarball |
| 19 | Publish to npm registry | `freshdesk-mcp-server` on npm | `npx freshdesk-mcp-server` runs successfully |
| 20 | Register on Official MCP Registry, Smithery, PulseMCP, mcp.so | Listed on 4+ registries | Searchable on each platform |
| 21 | MCPize integration (if monetizing) | Credit-based gating operational | Free tier: 100 calls; Pro tier: unlimited |
| 22 | End-to-end validation with Claude Desktop | Full workflow test | Invoke 5+ tools in a real conversation |

---

## Section 11: README.md Template

The README is critical for adoption. It must include:

1. **One-line description** and badge row (npm version, license, CI status, MCP Registry)
2. **Quick Start** with both stdio and remote configs:
   ```json
   {
     "mcpServers": {
       "freshdesk": {
         "command": "npx",
         "args": ["freshdesk-mcp-server"],
         "env": {
           "FRESHDESK_DOMAIN": "yourcompany",
           "FRESHDESK_API_KEY": "your_api_key"
         }
       }
     }
   }
   ```
3. **Tool Reference** — table of all 33 tools grouped by toolset
4. **Configuration** — all env vars with defaults
5. **Toolset Selection** — how to enable/disable toolsets
6. **Azure Deployment** — one-click `azd up` instructions
7. **Security** — what's redacted, how auth works, input validation
8. **Contributing** — development setup, test commands, PR expectations
9. **Comparison** — brief table showing coverage vs. effytech and Enreign servers

---

## Section 12: Key Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Better OAuth/auth support in SDK, Zod compile-time safety, Azure template availability |
| MCP SDK | `@modelcontextprotocol/sdk` ^1.27 | Official SDK, Streamable HTTP transport, tool annotations, structured outputs |
| Transport (remote) | Streamable HTTP | Current spec recommendation, serverless-compatible, session support |
| Transport (local) | stdio | Standard for local MCP servers, supported by all clients |
| Hosting | Azure Functions Flex Consumption | ~$1–8/month, scale-to-zero, official MCP template, Key Vault integration |
| HTTP client | undici | Node.js native, fastest, minimal dependencies |
| Validation | Zod | Runtime + compile-time safety, auto-generates JSON Schema for MCP |
| Logging | Pino | Fastest structured JSON logger for Node.js |
| Testing | Vitest + nock | Native ESM/TypeScript support, fast execution, HTTP mocking |
| Bundling | tsup | Zero-config, ESM output, declaration files |
| Auth (Freshdesk) | API key via Basic Auth | Only method available for direct API access |
| Auth (MCP clients) | OAuth 2.1 with PKCE (future) | Spec-required for multi-tenant remote servers |
| Caching | In-memory Map with TTL | No external dependencies, sufficient for single-instance |
| Rate limiting | Header-tracking (not token-bucket) | Mirrors Freshdesk's actual rate limit state |
| Monetization | MCPize + direct license keys | 85% revenue share, minimal integration effort |
| Tool count management | Toolset architecture | Core (15) + opt-in specialized sets, stays within LLM token budget |
