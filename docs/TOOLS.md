# Freshdesk MCP Server — Tool Reference

Complete reference for all 33 tools grouped by toolset.

---

## CORE Toolset (always loaded — 15 tools)

| # | Tool | Description | Read/Write |
|---|------|-------------|-----------|
| 1 | `get_ticket` | Retrieve a single ticket by ID with optional sideloads (conversations, requester, company, stats) | Read |
| 2 | `list_tickets` | List tickets with filtering, sorting, and pagination | Read |
| 3 | `search_tickets` | Full-text search using Freshdesk query language | Read |
| 4 | `create_ticket` | Create a new support ticket | Write |
| 5 | `update_ticket` | Update ticket status, priority, assignment, tags | Write |
| 6 | `reply_to_ticket` | Send a customer-facing reply to a ticket | Write |
| 7 | `add_note` | Add an internal agent note to a ticket | Write |
| 8 | `list_conversations` | List all conversations (replies + notes) for a ticket | Read |
| 9 | `get_contact` | Retrieve a single contact by ID | Read |
| 10 | `list_contacts` | List contacts with optional filters | Read |
| 11 | `search_contacts` | Search contacts by name, email, or phone | Read |
| 12 | `create_contact` | Create a new contact | Write |
| 13 | `update_contact` | Update contact details | Write |
| 14 | `list_agents` | List all agents, optionally filtered by type or group | Read |
| 15 | `get_agent` | Retrieve a single agent by ID | Read |

---

## KB Toolset (opt-in — 9 tools)

Enable with: `MCP_ENABLED_TOOLSETS=core,kb`

| # | Tool | Description | Read/Write |
|---|------|-------------|-----------|
| 16 | `list_solution_categories` | List all KB categories | Read |
| 17 | `list_solution_folders` | List folders within a KB category | Read |
| 18 | `list_solution_articles` | List articles within a folder | Read |
| 19 | `get_solution_article` | Retrieve full article content | Read |
| 20 | `create_solution_article` | Create a new KB article | Write |
| 21 | `update_solution_article` | Update an existing KB article | Write |
| 22 | `delete_solution_article` | Permanently delete a KB article | Write (Destructive) |
| 23 | `list_canned_responses` | List canned responses with optional search filter | Read |
| 24 | `get_canned_response` | Retrieve a specific canned response | Read |

---

## Analytics Toolset (opt-in — 4 tools)

Enable with: `MCP_ENABLED_TOOLSETS=core,analytics`

| # | Tool | Description | Read/Write |
|---|------|-------------|-----------|
| 25 | `list_satisfaction_ratings` | List CSAT survey ratings with date filtering | Read |
| 26 | `get_ticket_satisfaction` | Get CSAT rating for a specific ticket | Read |
| 27 | `list_time_entries` | List time tracking entries for a ticket | Read |
| 28 | `create_time_entry` | Log time worked on a ticket (HH:MM format) | Write |

---

## Bulk Toolset (opt-in — 3 tools)

Enable with: `MCP_ENABLED_TOOLSETS=core,bulk`

| # | Tool | Description | Read/Write |
|---|------|-------------|-----------|
| 29 | `bulk_update_tickets` | Update up to 25 tickets in one operation | Write |
| 30 | `delete_ticket` | Permanently delete a ticket | Write (Destructive) |
| 31 | `merge_contacts` | Merge duplicate contacts into one | Write (Destructive) |

---

## Admin Toolset (opt-in — 4 tools)

Enable with: `MCP_ENABLED_TOOLSETS=core,admin`

| # | Tool | Description | Read/Write |
|---|------|-------------|-----------|
| 32 | `list_groups` | List all agent groups | Read |
| 33 | `list_ticket_fields` | List all ticket field definitions (default + custom) | Read |
| 34 | `list_sla_policies` | List all SLA policies | Read |
| 35 | `list_automation_rules` | List automation rules by type | Read |

---

## Enabling All Toolsets

```env
MCP_ENABLED_TOOLSETS=core,kb,analytics,bulk,admin
```

For stdio with Claude Desktop:
```json
{
  "mcpServers": {
    "freshdesk": {
      "command": "npx",
      "args": ["freshdesk-mcp-server"],
      "env": {
        "FRESHDESK_DOMAIN": "yourcompany",
        "FRESHDESK_API_KEY": "your_api_key",
        "MCP_ENABLED_TOOLSETS": "core,kb,analytics,bulk,admin"
      }
    }
  }
}
```
