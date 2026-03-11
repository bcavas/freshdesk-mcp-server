# Contributing to Freshdesk MCP Server

Thank you for your interest in contributing. This is a solo-maintained project,
so please read these guidelines before opening a pull request.

## Before You Start

- Open an issue first for anything beyond a small bug fix. This avoids wasted
  effort if the change doesn't align with the project direction.
- All PRs must include unit tests for changed or added behaviour.
- All PRs must pass CI checks (lint, typecheck, tests, Docker smoke) before review.

## What to Contribute

**Welcome:**
- Bug fixes with reproduction steps in the issue
- New Freshdesk tool implementations (one tool per file in `src/tools/`)
- Improved error messages and `isError` handling
- Documentation improvements

**Not accepted:**
- Changes to auth handling or secret management without prior discussion
- Dependency upgrades without justification
- Changes to `infra/` or `.github/workflows/` without prior discussion

## Development Setup

```bash
git clone https://github.com/YOUR_GITHUB_ORG/freshdesk-mcp-server
cd freshdesk-mcp-server
npm install
cp .env.example .env
# Edit .env with your own Freshdesk API key for local testing
npm run dev
```

## Running Tests

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run test        # Unit tests
bash scripts/docker-smoke-test.sh  # Docker smoke test
```

## Code Style

- One tool per file in `src/tools/`
- All tool inputs validated with Zod schemas including `.describe()` on every field
- All tool errors returned as `{ isError: true, content: [{ type: "text", text: "..." }] }`
- No hardcoded credentials, URLs, or environment-specific values in source code

## Security

If you discover a security vulnerability, do **not** open a public issue.
Email the maintainer directly. See `SECURITY.md` if present.
