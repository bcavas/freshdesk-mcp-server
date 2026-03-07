# freshdesk-mcp-server

[![npm version](https://img.shields.io/npm/v/freshdesk-mcp-server.svg)](https://www.npmjs.com/package/freshdesk-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-2025--11--25-purple)](https://modelcontextprotocol.io)

Enterprise-grade **MCP (Model Context Protocol) server** for [Freshdesk](https://freshdesk.com). Gives AI agents (Claude, GPT-4, Gemini, etc.) full agentic access to your Freshdesk helpdesk — read and write tickets, contacts, knowledge base articles, and more.

**33+ tools** across 5 configurable toolsets. Dual transport: **stdio** (local) and **Streamable HTTP** (remote/cloud). Production-ready with rate limiting, retry logic, caching, PII redaction, and prompt injection protection.

---

## Quick Start

### Claude Desktop (stdio)

Add to your `claude_desktop_config.json`:

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

### Remote / Cloud (Streamable HTTP)

```json
{
  "mcpServers": {
    "freshdesk": {
      "url": "https://your-deployment.azurewebsites.net/mcp"
    }
  }
}
```

---

## Getting Your API Key

1. Log in to Freshdesk
2. Click your avatar (top right) → **Profile Settings**
3. Scroll to **Your API Key** → Copy

---

## Tool Reference

All 33+ tools in 5 toolsets. Enable specific toolsets via `MCP_ENABLED_TOOLSETS`.

### CORE (always loaded — 15 tools)

| Tool | Description |
|------|-------------|
| `get_ticket` | Get a ticket with optional sideloads (conversations, requester, stats) |
| `list_tickets` | List tickets with filters and sorting |
| `search_tickets` | Search with Freshdesk query language (`status:2 AND priority:4`) |
| `create_ticket` | Create a new ticket |
| `update_ticket` | Update status, priority, assignment, tags |
| `reply_to_ticket` | Send customer-facing reply |
| `add_note` | Add private/public agent note |
| `list_conversations` | Get full ticket thread |
| `get_contact` | Get a contact by ID |
| `list_contacts` | List contacts with filtering |
| `search_contacts` | Search contacts |
| `create_contact` | Create a new contact |
| `update_contact` | Update contact details |
| `list_agents` | List agents by type and group |
| `get_agent` | Get agent profile |

### KB (opt-in — 9 tools)

Solution articles, folders, categories, and canned responses.

### Analytics (opt-in — 4 tools)

CSAT satisfaction ratings and time tracking entries.

### Bulk (opt-in — 3 tools)

Bulk update up to 25 tickets, delete tickets, merge contacts.

### Admin (opt-in — 4 tools)

Groups, ticket fields, SLA policies, and automation rules.

See [docs/TOOLS.md](docs/TOOLS.md) for the complete reference.

---

## Configuration

| Variable | Default | Required | Description |
|---|---|---|---|
| `FRESHDESK_DOMAIN` | — | ✅ | Your Freshdesk subdomain |
| `FRESHDESK_API_KEY` | — | ✅ | Your Freshdesk API key |
| `MCP_TRANSPORT` | `streamable-http` | | `streamable-http` or `stdio` |
| `MCP_PORT` | `3000` | | HTTP port (remote mode) |
| `MCP_ENABLED_TOOLSETS` | `core` | | Comma-separated: `core,kb,analytics,bulk,admin` |
| `RATE_LIMIT_BUFFER_PERCENT` | `20` | | Stop at this % of rate limit remaining |
| `LOG_LEVEL` | `info` | | `trace`/`debug`/`info`/`warn`/`error` |
| `REDACT_FIELDS` | `phone,mobile,twitter_id` | | PII fields to redact from responses |

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for full reference.

---

## Toolset Selection

```env
# Core only (recommended for most use cases)
MCP_ENABLED_TOOLSETS=core

# Add knowledge base tools
MCP_ENABLED_TOOLSETS=core,kb

# Everything
MCP_ENABLED_TOOLSETS=core,kb,analytics,bulk,admin
```

---

## Azure Deployment

One-command deploy to Azure Functions (Flex Consumption, ~$2–12/month):

```bash
azd up
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full guide.

---

## Security

- **PII Redaction**: `phone`, `mobile`, and `twitter_id` fields are redacted from all API responses before they reach the LLM. Configurable via `REDACT_FIELDS`.
- **Prompt Injection Detection**: All tool inputs are scanned for injection patterns (`<IMPORTANT>`, `ignore previous instructions`, zero-width spaces, etc.).
- **Authentication**: Uses Freshdesk API key via HTTP Basic Auth. Keep your API key in a secret manager (Key Vault on Azure, not in `env` in production).
- **Rate Limiting**: Proactive rate limit tracking using `X-RateLimit-Remaining` headers with a configurable buffer threshold.

---

## Development

```bash
git clone https://github.com/YOUR_USERNAME/freshdesk-mcp-server
cd freshdesk-mcp-server
npm install
cp .env.example .env  # Fill in FRESHDESK_DOMAIN and FRESHDESK_API_KEY

# Development (watch mode)
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build

# Inspect with MCP Inspector
npm run inspect
```

---

## Comparison

| Feature | This Server | effytech | Enreign |
|---|---|---|---|
| Tools | 33+ | ~10 | ~15 |
| Toolsets | 5 configurable | Fixed | Fixed |
| Streamable HTTP | ✅ | ❌ | ❌ |
| stdio | ✅ | ✅ | ✅ |
| PII Redaction | ✅ | ❌ | ❌ |
| Injection Protection | ✅ | ❌ | ❌ |
| Rate Limiting | ✅ | Partial | ❌ |
| Caching | ✅ | ❌ | ❌ |
| Azure Deployment | ✅ (IaC) | ❌ | ❌ |
| TypeScript | ✅ | ✅ | ❌ |
| Test Coverage | ✅ 80%+ | ❌ | ❌ |

---

## Contributing

1. Fork the repo and create a feature branch
2. Write tests for any new tools or behavior changes
3. Run `npm run typecheck && npm run lint && npm test` — all must pass
4. Submit a PR with a clear description of changes

---

## License

[MIT](LICENSE)
