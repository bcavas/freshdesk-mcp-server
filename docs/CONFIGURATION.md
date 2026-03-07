# Configuration Reference

All environment variables supported by the Freshdesk MCP Server.

---

## Required Variables

| Variable | Description | Example |
|---|---|---|
| `FRESHDESK_DOMAIN` | Your Freshdesk subdomain (the part before `.freshdesk.com`) | `yourcompany` |
| `FRESHDESK_API_KEY` | Your Freshdesk API key (Profile Settings → Your API Key) | `abc123xyz...` |

---

## Server Configuration

| Variable | Default | Description |
|---|---|---|
| `MCP_TRANSPORT` | `streamable-http` | Transport mode: `streamable-http` or `stdio` |
| `PORT` | `3000` | HTTP port the server binds to. Cloud Run injects this automatically at runtime; do not set manually in production. Overrides `MCP_PORT` when present. |
| `MCP_PORT` | `3000` | HTTP server port (only used with `streamable-http`) |
| `MCP_HOST` | `0.0.0.0` | HTTP server bind address |

---

## Toolset Selection

| Variable | Default | Description |
|---|---|---|
| `MCP_ENABLED_TOOLSETS` | `core` | Comma-separated list of toolsets to enable. Options: `core`, `kb`, `analytics`, `bulk`, `admin` |

**Examples:**
```env
MCP_ENABLED_TOOLSETS=core          # Only core 15 tools
MCP_ENABLED_TOOLSETS=core,kb       # Core + knowledge base tools
MCP_ENABLED_TOOLSETS=core,kb,analytics,bulk,admin  # All 33+ tools
```

---

## Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_BUFFER_PERCENT` | `20` | Stop making requests when remaining quota drops below this % of total. Valid range: 0–50 |

---

## Logging

| Variable | Default | Options | Description |
|---|---|---|---|
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, `error`, `fatal` | Pino log level |

---

## Security

| Variable | Default | Description |
|---|---|---|
| `LICENSE_KEY_REQUIRED` | `false` | Set to `true` to require a license key (future monetization) |
| `PAYMCP_API_KEY` | _(empty)_ | PayMCP API key for credit-based gating |
| `REDACT_FIELDS` | `phone,mobile,twitter_id` | Comma-separated field names to redact from API responses |

---

## Example `.env` File

```env
# Required
FRESHDESK_DOMAIN=yourcompany
FRESHDESK_API_KEY=your_api_key_here

# Server
MCP_TRANSPORT=streamable-http
MCP_PORT=3000

# Tools
MCP_ENABLED_TOOLSETS=core,kb

# Logging
LOG_LEVEL=info

# Security
REDACT_FIELDS=phone,mobile,twitter_id
```
