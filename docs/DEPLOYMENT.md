# Deployment Guide — Google Cloud Run

`freshdesk-mcp-server` runs on Google Cloud Run as a containerized Node.js 20 service. This guide covers initial setup, CI/CD configuration, and post-deployment management.

## Prerequisites

| Requirement | Version / Notes |
|---|---|
| Docker | 24+ (for local testing) |
| Google Cloud SDK | Latest — install at https://cloud.google.com/sdk/docs/install |
| Node.js | 20.x LTS |
| GitHub repository | With Actions enabled |

## Architecture

```
GitHub push to main
  → GitHub Actions (build + test + docker push)
  → Artifact Registry (container image storage)
  → Cloud Run (serverless container execution)
  → Secret Manager (FRESHDESK_DOMAIN + FRESHDESK_API_KEY)
```

The service scales to zero when idle (no traffic = $0 compute cost) and scales up automatically on incoming MCP requests. Requests from the same MCP client are routed to the same instance via session affinity, preserving any in-memory MCP session state.

## Initial Setup (One Time)

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Run the setup script — provisions all required cloud resources
GITHUB_REPO="YOUR_ORG/freshdesk-mcp-server" bash infra/cloud-run/setup.sh
```

The setup script creates:
- Artifact Registry repository for Docker images
- Two Secret Manager secrets (`freshdesk-domain`, `freshdesk-api-key`)
- A dedicated service account with least-privilege access
- Workload Identity Federation pool for keyless GitHub Actions authentication

After running, copy the four output values into GitHub Actions secrets (Settings → Secrets and variables → Actions):
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

## Updating Secrets

To rotate the Freshdesk API key:

```bash
echo -n "NEW_API_KEY" | gcloud secrets versions add freshdesk-api-key \
  --data-file=- \
  --project=YOUR_PROJECT_ID
```

Cloud Run automatically resolves to the `latest` version on the next container start. To force an immediate rotation, redeploy:

```bash
gcloud run services update freshdesk-mcp-server \
  --region=YOUR_REGION \
  --project=YOUR_PROJECT_ID \
  --no-traffic  # updates config without shifting traffic
gcloud run services update-traffic freshdesk-mcp-server \
  --to-latest \
  --region=YOUR_REGION \
  --project=YOUR_PROJECT_ID
```

## CI/CD Pipeline

Every push to `main` triggers `.github/workflows/deploy.yml`:

1. Full CI checks (lint, typecheck, test coverage, build)
2. Docker image built and pushed to Artifact Registry with SHA tag + `latest`
3. `infra/cloud-run/service.yaml` patched with the SHA-tagged image URL
4. `gcloud run services replace` deploys the new revision
5. Health endpoint polled until HTTP 200 or timeout (60s)

Every pull request triggers `.github/workflows/ci.yml`:
- Lint, typecheck, test coverage, build
- Docker build validation (builder stage only, no push)

## Rollback Procedure

If a bad deployment reaches production, you should immediately rollback to the previous stable revision.

### Step 1: List Revisions
```bash
gcloud run revisions list --service=freshdesk-mcp-server --region=YOUR_REGION
```
Identify the revision ID you want to restore. Note that `PREVIOUS` can be used generally if you only want to step back exactly 1 revision.

### Step 2: Route Traffic
To rollback all 100% of traffic to the previous revision:
```bash
gcloud run services update-traffic freshdesk-mcp-server \
  --to-revisions=PREVIOUS=100 \
  --region=YOUR_REGION
```

If you need a specific older revision:
```bash
gcloud run services update-traffic freshdesk-mcp-server \
  --to-revisions=freshdesk-mcp-server-0000X-XXX=100 \
  --region=YOUR_REGION
```

### Step 3: Verify Integrity
Check logs and metrics to ensure traffic is flowing properly to the stable revision and errors have receded.


## Local Testing with Docker

```bash
# Build the image
npm run docker:build

# Create a local .env file with real credentials (never commit this)
cp .env.example .env
# Edit .env: set FRESHDESK_DOMAIN and FRESHDESK_API_KEY

# Run locally
npm run docker:run
# Server available at http://localhost:8080

# Test health
curl http://localhost:8080/health

# Test MCP tools/list
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

## Cost Estimate

| Scenario | Estimated Monthly Cost |
|---|---|
| Scale to zero, under 2M requests | **$0** (free tier) |
| Moderate traffic, 256MB, 1 vCPU | ~$0.50–$2.00 |
| Always-on (min 1 instance) | ~$5–$10 |

The free tier covers 2 million requests/month and 180,000 vCPU-seconds/month. A typical MCP tool call takes less than 1 second of vCPU time, meaning the free tier supports approximately 180,000 tool calls per month at zero cost.

## Monitoring and Logs

```bash
# Tail live logs
gcloud run services logs tail freshdesk-mcp-server \
  --region=YOUR_REGION \
  --project=YOUR_PROJECT_ID

# View last 100 log entries
gcloud run services logs read freshdesk-mcp-server \
  --limit=100 \
  --region=YOUR_REGION \
  --project=YOUR_PROJECT_ID
```

Structured JSON logs from Pino are parsed automatically by Cloud Logging. Filter by severity or field in the Cloud Console at: https://console.cloud.google.com/logs.

## Service Configuration Reference

`infra/cloud-run/service.yaml` is the declarative source of truth for the Cloud Run service configuration. Key settings:

| Setting | Value | Purpose |
|---|---|---|
| `minScale` | 0 | Scale to zero when idle |
| `maxScale` | 3 | Cap concurrent instances |
| `sessionAffinity` | true | Route MCP sessions to same instance |
| `timeoutSeconds` | 3600 | Allow long-running streaming connections |
| `containerConcurrency` | 80 | Requests per instance before scaling |
| Secrets | Secret Manager refs | No plaintext credentials in config |
