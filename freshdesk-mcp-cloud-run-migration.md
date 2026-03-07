# Freshdesk MCP Server — Google Cloud Run Migration Plan

## Preamble: What This Document Is

This document is a **step-by-step migration plan** for replacing the Azure Functions deployment target with Google Cloud Run across the `freshdesk-mcp-server` codebase. It is written to be consumed by a **code generation agent** (e.g., Claude Code, Cursor Agent, Aider). Every instruction is concrete, deterministic, and ordered. Every file path is specified relative to the repository root. Ambiguity has been eliminated wherever possible.

**Preconditions:** All work described in Sections 1–9 and Phases 1–3 of Section 10 of the original implementation plan has been completed. The repository is in a passing state: `npm run build`, `npm run test`, and `npm run lint` all succeed. The compiled output in `dist/` is functional. Do not begin this migration until those preconditions are confirmed.

**Do not modify any source file not explicitly listed in this plan.** The MCP server logic in `src/tools/`, `src/client/`, `src/middleware/`, and `src/errors/` is complete and must not be touched. Only the files listed in each section below require changes.

**Scope of this plan:**
1. Remove all Azure Functions infrastructure code
2. Adapt the server entry point for Cloud Run's execution model
3. Add container packaging files
4. Replace the GitHub Actions deployment workflow
5. Update Phase 4 of the implementation phases
6. Update all project documentation that references Azure

---

## Section A: Files to Delete

Execute these deletions before making any other changes. These files are Azure-specific and have no equivalent in the Cloud Run deployment model.

```bash
# Remove the entire Azure Functions sub-project
rm -rf infra/function-app/

# Remove the Azure Bicep template
rm -f infra/main.bicep

# The infra/ directory itself may now be empty — retain it for the Cloud Run config files added in Section C
```

After deletion, confirm the repository structure no longer contains any of the following paths:
- `infra/function-app/`
- `infra/function-app/src/functions/mcp.ts`
- `infra/function-app/host.json`
- `infra/function-app/local.settings.json`
- `infra/main.bicep`

---

## Section B: Modify Existing Source Files

### B.1 `src/index.ts` — Remote Server Entry Point

**Current state:** This file starts an HTTP server using `StreamableHTTPServerTransport` bound to `MCP_HOST` and `MCP_PORT` from the config module.

**Required changes:** Two modifications are needed. First, the server must also listen on `process.env.PORT` to satisfy Cloud Run's requirement that services bind to the port injected via the `PORT` environment variable. Second, a `/health` endpoint must be added so Cloud Run's health check system can confirm the service is live after deployment.

**Precise instructions:** Locate the section of `src/index.ts` where the HTTP server is created and `server.listen()` is called. Apply the following changes:

1. Replace the port resolution logic. The port must prefer `process.env.PORT` over `config.server.port`. This is because Cloud Run injects `PORT` at runtime and overrides whatever default is in config. Change:
   ```typescript
   const port = config.server.port;
   ```
   To:
   ```typescript
   const port = parseInt(process.env.PORT ?? String(config.server.port), 10);
   ```

2. Locate the section where the Express app (or raw `http.Server`) registers the `/mcp` route handler. Immediately **before** the `/mcp` route registration, add the following health check route:
   ```typescript
   app.get('/health', (_req, res) => {
     res.status(200).json({
       status: 'ok',
       version: process.env.npm_package_version ?? 'unknown',
       transport: 'streamable-http',
     });
   });
   ```

3. No other changes to `src/index.ts` are required. The `StreamableHTTPServerTransport` wiring, session management, and MCP server factory call remain unchanged.

**Verification:** After this change, `npm run build` must succeed. Then run `PORT=8080 npm run start` and confirm `curl http://localhost:8080/health` returns `{"status":"ok",...}` with HTTP 200.

---

### B.2 `src/config.ts` — Configuration Loading

**Current state:** The `ConfigSchema` in `src/config.ts` (and/or `src/types/config.ts`) defines `server.port` with a default of `3000`.

**Required changes:** The `PORT` environment variable is now the authoritative port source at runtime and is handled in `src/index.ts` (Section B.1). No changes to the Zod schema are required. However, add a single comment to the `server.port` field in the schema to document this:

Locate the schema field:
```typescript
port: z.number().int().min(1).max(65535).default(3000),
```

Add the JSDoc comment immediately above it:
```typescript
/** Default port for local development. At runtime on Cloud Run, process.env.PORT overrides this via src/index.ts. */
port: z.number().int().min(1).max(65535).default(3000),
```

**No other changes to `src/config.ts` are required.**

---

### B.3 `.env.example` — Environment Variable Reference

**Current state:** `.env.example` documents `MCP_TRANSPORT`, `MCP_PORT`, and `MCP_HOST` under the "Optional — Server Configuration" section.

**Required changes:** Add the `PORT` variable and a Cloud Run–specific comment block. Locate the `MCP_PORT=3000` line and add the following immediately above it:

```env
# Cloud Run runtime — injected automatically by Cloud Run, do not set manually in production
# PORT=8080
```

No other changes to `.env.example` are required.

---

### B.4 `server.json` — MCP Registry Manifest

**Current state:** `server.json` contains:
```json
"streamableHttp": {
  "url": "https://your-deployment-url.azurewebsites.net/mcp"
}
```

**Required change:** Replace the placeholder URL with the Cloud Run format. The Cloud Run service URL follows the pattern `https://SERVICE_NAME-HASH-REGION.a.run.app`. Update:

```json
"transport": {
  "streamableHttp": {
    "url": "https://freshdesk-mcp-server-REPLACE_WITH_HASH-REPLACE_WITH_REGION.a.run.app/mcp"
  },
  "stdio": {
    "command": "npx",
    "args": ["freshdesk-mcp-server"]
  }
}
```

**Note for the agent:** The hash and region segments in the URL are assigned by Google Cloud Run at first deployment and cannot be known in advance. Leave the placeholder tokens `REPLACE_WITH_HASH` and `REPLACE_WITH_REGION` in place. The documentation update instructions in Section F specify how to update this after the first deployment.

---

### B.5 `package.json` — Scripts

**Current state:** `package.json` contains Azure-specific scripts. Locate the `scripts` block and apply these precise changes:

1. Remove the following script entirely (it references Azure Developer CLI):
   ```json
   "inspect": "npx @modelcontextprotocol/inspector dist/index.js"
   ```
   Replace it with (keeping MCP Inspector but removing Azure dependency):
   ```json
   "inspect": "npx @modelcontextprotocol/inspector node dist/index.js"
   ```
   *(Note: The `inspect` script itself does not need removal — only verify it does not reference `azd` or Azure tools.)*

2. Add the following new scripts to the `scripts` block:
   ```json
   "docker:build": "docker build -t freshdesk-mcp-server .",
   "docker:run": "docker run --rm -p 8080:8080 --env-file .env freshdesk-mcp-server",
   "docker:test": "npm run docker:build && npm run docker:run"
   ```

No other changes to `package.json` are required.

---

## Section C: Create New Files

Create all files in this section exactly as specified. Do not omit any file.

### C.1 `Dockerfile`

Create at repository root. This is the primary artifact for Cloud Run deployment.

```dockerfile
# syntax=docker/dockerfile:1

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./
RUN npm ci

# Copy source and config files
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/

# Build TypeScript to ESM dist/
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs mcp

WORKDIR /app

# Copy production artifacts from builder stage
COPY --from=builder --chown=mcp:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --chown=mcp:nodejs package.json ./

USER mcp

# Cloud Run injects PORT at runtime; expose 8080 as default
EXPOSE 8080

# Healthcheck for local docker run testing (Cloud Run uses HTTP probes separately)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the remote HTTP server (not stdio CLI)
CMD ["node", "dist/index.js"]
```

---

### C.2 `.dockerignore`

Create at repository root. Prevents unnecessary files from being included in the build context, which significantly speeds up `docker build` and `gcloud run deploy --source`.

```
node_modules/
dist/
.env
*.log
coverage/
.turbo/
tests/
docs/
infra/
.github/
*.test.ts
*.spec.ts
tsup.config.ts
vitest.config.ts
.eslintrc.*
.prettierrc
*.md
!README.md
```

---

### C.3 `infra/cloud-run/service.yaml`

Create this file. It is the declarative Cloud Run service configuration used by `gcloud run services replace` for reproducible deployments. It serves the same purpose as `infra/main.bicep` did for Azure.

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: freshdesk-mcp-server
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        # Scale to zero when idle; start on first request
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "3"
        # Session affinity: route requests from same client to same instance
        # Required for stateful MCP sessions; harmless for stateless mode
        run.googleapis.com/sessionAffinity: "true"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 3600
      serviceAccountName: freshdesk-mcp-sa@PROJECT_ID.iam.gserviceaccount.com
      containers:
        - image: IMAGE_URL_PLACEHOLDER
          ports:
            - containerPort: 8080
          env:
            - name: MCP_TRANSPORT
              value: "streamable-http"
            - name: MCP_ENABLED_TOOLSETS
              value: "core"
            - name: LOG_LEVEL
              value: "info"
            - name: FRESHDESK_DOMAIN
              valueFrom:
                secretKeyRef:
                  name: freshdesk-domain
                  key: latest
            - name: FRESHDESK_API_KEY
              valueFrom:
                secretKeyRef:
                  name: freshdesk-api-key
                  key: latest
          resources:
            limits:
              cpu: "1"
              memory: "512Mi"
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 30
```

**Note for the agent:** The tokens `PROJECT_ID` and `IMAGE_URL_PLACEHOLDER` must be substituted at deployment time by the GitHub Actions workflow. Do not hardcode real values in this file. The workflow in Section C.5 handles substitution via `sed` before calling `gcloud run services replace`.

---

### C.4 `infra/cloud-run/setup.sh`

Create this file. It is a one-time setup script that provisions the Google Cloud resources required before the first deployment. It replaces the `azd provision` step and the Key Vault setup from the original Day 17–18 instructions.

```bash
#!/usr/bin/env bash
# infra/cloud-run/setup.sh
# One-time Google Cloud setup for freshdesk-mcp-server.
# Run this once before the first deployment. Safe to re-run (idempotent).
#
# Prerequisites:
#   - gcloud CLI installed and authenticated: gcloud auth login
#   - Correct project set: gcloud config set project YOUR_PROJECT_ID
#   - Billing enabled on the project

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project)
REGION="${CLOUD_RUN_REGION:-us-central1}"
SERVICE_NAME="freshdesk-mcp-server"
SA_NAME="freshdesk-mcp-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Setting up Cloud Run deployment for project: ${PROJECT_ID}"
echo "==> Region: ${REGION}"

# 1. Enable required APIs
echo "==> Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Create Artifact Registry repository for container images
echo "==> Creating Artifact Registry repository..."
gcloud artifacts repositories create "${SERVICE_NAME}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Docker images for freshdesk-mcp-server" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "    Repository already exists, skipping."

# 3. Create dedicated service account for Cloud Run
echo "==> Creating service account: ${SA_EMAIL}..."
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="Freshdesk MCP Server Runtime" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "    Service account already exists, skipping."

# 4. Create Secret Manager secrets (values set interactively)
echo "==> Creating Secret Manager secrets..."
echo "    You will be prompted to enter secret values."

for SECRET_NAME in freshdesk-domain freshdesk-api-key; do
  if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "    Secret '${SECRET_NAME}' already exists. To update it run:"
    echo "    echo -n 'NEW_VALUE' | gcloud secrets versions add ${SECRET_NAME} --data-file=-"
  else
    read -r -p "    Enter value for ${SECRET_NAME}: " SECRET_VALUE
    echo -n "${SECRET_VALUE}" | gcloud secrets create "${SECRET_NAME}" \
      --replication-policy="automatic" \
      --data-file=- \
      --project="${PROJECT_ID}"
    echo "    Created secret: ${SECRET_NAME}"
  fi
done

# 5. Grant service account access to secrets
echo "==> Granting secret access to service account..."
for SECRET_NAME in freshdesk-domain freshdesk-api-key; do
  gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="${PROJECT_ID}"
done

# 6. Grant Cloud Run invoker to the service account (needed for service identity)
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.invoker"

# 7. Create Workload Identity Federation for GitHub Actions (keyless auth)
# Replace GITHUB_ORG/REPO with your actual GitHub repository
GITHUB_REPO="${GITHUB_REPO:-YOUR_GITHUB_ORG/freshdesk-mcp-server}"
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-provider"

echo "==> Setting up Workload Identity Federation for GitHub Actions..."
echo "    GitHub repository: ${GITHUB_REPO}"

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "${POOL_NAME}" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "    Pool already exists, skipping."

# Create OIDC Provider
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
  --workload-identity-pool="${POOL_NAME}" \
  --location="global" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "    Provider already exists, skipping."

WORKLOAD_IDENTITY_PROVIDER=$(gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
  --workload-identity-pool="${POOL_NAME}" \
  --location="global" \
  --project="${PROJECT_ID}" \
  --format="value(name)")

# Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_PROVIDER%/providers/*}/attribute.repository/${GITHUB_REPO}" \
  --project="${PROJECT_ID}"

# Grant service account permissions to deploy Cloud Run and push images
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

echo ""
echo "==> Setup complete. Add these values as GitHub Actions secrets:"
echo ""
echo "    GCP_PROJECT_ID:              ${PROJECT_ID}"
echo "    GCP_REGION:                  ${REGION}"
echo "    GCP_WORKLOAD_IDENTITY_PROVIDER: ${WORKLOAD_IDENTITY_PROVIDER}"
echo "    GCP_SERVICE_ACCOUNT:         ${SA_EMAIL}"
echo ""
echo "==> Artifact Registry image base URL:"
echo "    ${REGION}-docker.pkg.dev/${PROJECT_ID}/${SERVICE_NAME}/server"
```

Make the script executable:
```bash
chmod +x infra/cloud-run/setup.sh
```

---

### C.5 `.github/workflows/deploy.yml` — Replace Entirely

**Current state:** This file contains Azure-specific deployment steps using `azure/login@v2` and `azure/functions-action@v1`.

**Action:** Delete the entire contents of `.github/workflows/deploy.yml` and replace with the following. Do not attempt to patch the existing file — replace it completely.

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

permissions:
  contents: read
  id-token: write   # Required for Workload Identity Federation

env:
  REGION: ${{ vars.GCP_REGION || 'us-central1' }}
  SERVICE: freshdesk-mcp-server
  IMAGE_BASE: ${{ vars.GCP_REGION || 'us-central1' }}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/freshdesk-mcp-server/server

jobs:
  deploy:
    name: Build, push, and deploy
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run full CI checks
        run: |
          npm run lint
          npm run typecheck
          npm run test:coverage
          npm run build

      - name: Authenticate to Google Cloud
        id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev --quiet

      - name: Set image tag
        id: image
        run: |
          IMAGE_TAG="${{ env.IMAGE_BASE }}:${{ github.sha }}"
          IMAGE_LATEST="${{ env.IMAGE_BASE }}:latest"
          echo "tag=${IMAGE_TAG}" >> "$GITHUB_OUTPUT"
          echo "latest=${IMAGE_LATEST}" >> "$GITHUB_OUTPUT"

      - name: Build and push Docker image
        run: |
          docker build \
            --tag "${{ steps.image.outputs.tag }}" \
            --tag "${{ steps.image.outputs.latest }}" \
            --cache-from "${{ steps.image.outputs.latest }}" \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            .
          docker push "${{ steps.image.outputs.tag }}"
          docker push "${{ steps.image.outputs.latest }}"

      - name: Prepare service manifest
        run: |
          sed -i \
            -e "s|IMAGE_URL_PLACEHOLDER|${{ steps.image.outputs.tag }}|g" \
            -e "s|PROJECT_ID|${{ secrets.GCP_PROJECT_ID }}|g" \
            infra/cloud-run/service.yaml

      - name: Deploy to Cloud Run
        run: |
          gcloud run services replace infra/cloud-run/service.yaml \
            --region="${{ env.REGION }}" \
            --project="${{ secrets.GCP_PROJECT_ID }}"

      - name: Allow unauthenticated invocations
        run: |
          gcloud run services add-iam-policy-binding ${{ env.SERVICE }} \
            --region="${{ env.REGION }}" \
            --member="allUsers" \
            --role="roles/run.invoker" \
            --project="${{ secrets.GCP_PROJECT_ID }}"

      - name: Get service URL and verify health
        run: |
          SERVICE_URL=$(gcloud run services describe ${{ env.SERVICE }} \
            --region="${{ env.REGION }}" \
            --project="${{ secrets.GCP_PROJECT_ID }}" \
            --format="value(status.url)")
          echo "SERVICE_URL=${SERVICE_URL}" >> "$GITHUB_ENV"
          echo "### Deployed to ${SERVICE_URL}" >> "$GITHUB_STEP_SUMMARY"
          
          # Verify health endpoint
          echo "==> Verifying health endpoint..."
          for i in {1..6}; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" || echo "000")
            if [ "${STATUS}" = "200" ]; then
              echo "    Health check passed (attempt ${i})"
              echo "**Health:** ✅ ${SERVICE_URL}/health" >> "$GITHUB_STEP_SUMMARY"
              exit 0
            fi
            echo "    Health check attempt ${i} returned HTTP ${STATUS}, retrying in 10s..."
            sleep 10
          done
          echo "    Health check failed after 6 attempts."
          exit 1
```

---

### C.6 `.github/workflows/ci.yml` — Minor Update Only

**Current state:** The CI workflow runs lint, typecheck, test coverage, and build on pull requests. It does not contain Azure-specific steps.

**Required change:** Add a Docker build validation step so that container build failures are caught on PRs, not just on deploy. Locate the final `- run: npm run build` step and add the following step immediately after it:

```yaml
      - name: Validate Docker build
        run: |
          docker build --target builder -t freshdesk-mcp-server:ci-test . \
            && echo "Docker build succeeded" \
            || (echo "Docker build FAILED" && exit 1)
```

No other changes to `.github/workflows/ci.yml` are required.

---

## Section D: Updated Section 10, Phase 4 — Deployment and Distribution

Replace the Phase 4 table and all associated content in the original implementation plan's Section 10 with the following. This is the authoritative Phase 4 for the Cloud Run deployment target.

### Phase 4: Deployment and Distribution (Days 17–22)

| Day | Task | Deliverable | Verification |
|-----|------|-------------|--------------|
| 17 | Run `infra/cloud-run/setup.sh`; add GitHub secrets; push to main to trigger first deploy | Live Cloud Run service | `curl https://SERVICE_URL/health` returns HTTP 200 |
| 18 | Confirm Secret Manager integration; verify secrets resolve in Cloud Run logs | No plaintext credentials in env | Cloud Run logs show tool calls succeeding; secret references show ✓ in Console |
| 18 | Validate GitHub Actions CI/CD pipeline end-to-end | Automated build + deploy | PR triggers CI with Docker build step; merge to main triggers full deploy |
| 19 | npm publish preparation: README, TOOLS.md, CONFIGURATION.md | Publish-ready package | `npm pack --dry-run` lists only: `dist/`, `README.md`, `LICENSE`, `server.json` |
| 19 | Publish to npm registry | `freshdesk-mcp-server` on npm | `npx freshdesk-mcp-server` runs stdio transport successfully |
| 20 | Update `server.json` with live Cloud Run URL; register on Official MCP Registry, Smithery, PulseMCP, mcp.so | Listed on 4+ registries | Searchable on each platform with correct `/mcp` endpoint URL |
| 21 | MCPize integration (if monetizing) | Credit-based gating operational | Free tier: 100 calls; Pro tier: unlimited |
| 22 | End-to-end validation with Claude Desktop | Full workflow test | Invoke 5+ tools in a real conversation against live Cloud Run endpoint |

#### Day 17 — Detailed Execution

**Prerequisite:** `gcloud` CLI installed and authenticated. Active Google Cloud project with billing enabled.

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Run setup (one-time)
GITHUB_REPO="YOUR_ORG/freshdesk-mcp-server" bash infra/cloud-run/setup.sh
```

The script outputs four values. Add them as **GitHub Actions secrets** (Settings → Secrets and variables → Actions → New repository secret):

| Secret name | Value source |
|---|---|
| `GCP_PROJECT_ID` | Your Google Cloud project ID |
| `GCP_REGION` | Region chosen during setup (e.g. `us-central1`) |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Output by setup.sh |
| `GCP_SERVICE_ACCOUNT` | Output by setup.sh |

Trigger the first deployment by pushing to `main`:
```bash
git add .
git commit -m "chore: migrate deployment target from Azure Functions to Cloud Run"
git push origin main
```

Watch the Actions tab. The deploy job will build the Docker image, push to Artifact Registry, and deploy to Cloud Run. The final step outputs the service URL and verifies the `/health` endpoint.

**Expected first-deployment service URL format:**
`https://freshdesk-mcp-server-[hash]-[region-code].a.run.app`

#### Day 18 — Secret Manager Verification

Confirm secrets resolve correctly without any plaintext values appearing in logs:

```bash
# Check that secret references show as resolved (green checkmark) in Cloud Run console
gcloud run services describe freshdesk-mcp-server \
  --region=YOUR_REGION \
  --format="yaml(spec.template.spec.containers[0].env)"
```

The output should show `secretKeyRef` entries for `FRESHDESK_DOMAIN` and `FRESHDESK_API_KEY`, not plaintext values.

Trigger a test tool call to confirm end-to-end secrets resolution works:
```bash
curl -X POST https://SERVICE_URL/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

Expected response: a JSON-RPC result containing the tools array with 15+ tools.

#### Days 19–22

These steps are identical to the original plan. The npm publish, registry listings, MCPize integration, and Claude Desktop end-to-end validation steps are platform-agnostic and require no changes. The only Day 20 difference: after registering on registries, update `server.json` with the real Cloud Run URL obtained from Day 17, commit, and push.

---

## Section E: Documentation Files to Update

### E.1 `docs/DEPLOYMENT.md` — Full Rewrite

**Action:** Delete the entire contents of `docs/DEPLOYMENT.md` and replace with the following.

```markdown
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
```

---

### E.2 `README.md` — Targeted Updates

**Do not rewrite the README.** Apply only the following targeted changes:

**Change 1: Badge row**

Locate the badge row (npm version, license, CI status, MCP Registry). Find any badge that references Azure (e.g., an Azure Functions badge or `azurewebsites.net` link). Replace it with a Google Cloud Run badge:

```markdown
[![Deploy to Cloud Run](https://img.shields.io/badge/Deploy-Cloud%20Run-4285F4?logo=googlecloud)](https://console.cloud.google.com/run)
```

**Change 2: Quick Start — remote config**

Locate the Quick Start section, specifically the Streamable HTTP configuration block. Find any URL containing `azurewebsites.net` and replace the entire URL with the actual Cloud Run URL obtained after Day 17 deployment. If the plan is still pre-deployment, use the placeholder:

```json
{
  "mcpServers": {
    "freshdesk-remote": {
      "type": "streamableHttp",
      "url": "https://freshdesk-mcp-server-REPLACE_WITH_HASH-REPLACE_WITH_REGION.a.run.app/mcp"
    }
  }
}
```

**Change 3: Azure Deployment section**

Locate the section titled "Azure Deployment" (added per the Section 11 README template in the original plan). Replace the section heading and content:

- Change heading from `## Azure Deployment` to `## Cloud Run Deployment`
- Replace all body content with:
  ```markdown
  Deploy to Google Cloud Run using the one-time setup script and GitHub Actions CI/CD:

  ```bash
  # One-time setup — provisions all required Google Cloud resources
  GITHUB_REPO="YOUR_ORG/freshdesk-mcp-server" bash infra/cloud-run/setup.sh

  # Add the four output values as GitHub Actions secrets, then push to main:
  git push origin main
  ```

  Full deployment documentation: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
  ```

**Change 4: Security section**

Locate any mention of "Azure Key Vault" in the Security section and replace with "Google Cloud Secret Manager". Replace the phrase "Key Vault secret references" with "Secret Manager secret references".

**No other changes to README.md are required.**

---

### E.3 `docs/CONFIGURATION.md` — Add PORT Variable

Locate the environment variables table in `docs/CONFIGURATION.md`. Find the row for `MCP_PORT` and add the following row immediately above it:

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No (injected by Cloud Run) | `3000` | HTTP port the server binds to. Cloud Run injects this automatically at runtime; do not set manually in production. Overrides `MCP_PORT` when present. |

No other changes to `docs/CONFIGURATION.md` are required.

---

### E.4 `CHANGELOG.md` — Create If Absent

If a `CHANGELOG.md` file does not exist in the repository root, create it. If it already exists, add the following entry at the top of the file:

```markdown
## [Unreleased]

### Changed
- Deployment target migrated from Azure Functions to Google Cloud Run
- Container packaging added: `Dockerfile`, `.dockerignore`
- CI/CD updated: GitHub Actions now builds Docker image and deploys via `gcloud run services replace`
- Secrets management migrated from Azure Key Vault to Google Cloud Secret Manager
- Session affinity and 60-minute request timeouts configured for Streamable HTTP compatibility
- `docs/DEPLOYMENT.md` rewritten for Cloud Run

### Removed
- `infra/function-app/` — Azure Functions sub-project and all associated configuration
- `infra/main.bicep` — Azure Bicep infrastructure template
- Azure-specific GitHub Actions steps (`azure/login`, `azure/functions-action`)
```

---

## Section F: Post-Migration Verification Checklist

Execute these checks in order after all code changes have been made and pushed to `main`.

**Step 1 — Local build:**
```bash
npm run build
```
Expected: Zero TypeScript errors.

**Step 2 — Local tests:**
```bash
npm run test:coverage
```
Expected: All tests pass, coverage thresholds met (≥80% lines/branches/functions).

**Step 3 — Docker build:**
```bash
npm run docker:build
```
Expected: Both `builder` and `runtime` stages complete without errors. Final image should be under 250MB.

**Step 4 — Docker run:**
```bash
npm run docker:run
```
Then in a separate terminal:
```bash
curl http://localhost:8080/health
```
Expected: `{"status":"ok","version":"...","transport":"streamable-http"}` with HTTP 200.

**Step 5 — MCP tools/list against Docker:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```
Expected: JSON-RPC response with `result.tools` array containing at least 15 tools.

**Step 6 — First Cloud Run deployment (after GitHub secrets set):**
Push to `main` and watch GitHub Actions. The deploy job must complete without errors and output the Cloud Run service URL.

**Step 7 — Remote health check:**
```bash
curl https://YOUR_CLOUD_RUN_URL/health
```
Expected: HTTP 200 with the same health JSON as local.

**Step 8 — Update `server.json` and README with real URL:**
Once the Cloud Run URL is known from Step 6, apply these changes and push:
- `server.json`: replace `REPLACE_WITH_HASH-REPLACE_WITH_REGION` tokens with actual URL path segments
- `README.md` Quick Start: replace the placeholder URL with the real URL

**Step 9 — stdio transport regression test:**
```bash
npx freshdesk-mcp-server
```
Expected: Server starts in stdio mode, waiting for JSON-RPC input on stdin. This confirms the npm package stdio transport was not broken by any of the migration changes.

**Step 10 — No Azure references remain:**
```bash
grep -r "azure\|azurewebsites\|azd\|bicep\|functions-action\|Key Vault\|@azure" \
  src/ .github/ infra/ docs/ README.md server.json --include="*.ts" --include="*.yml" --include="*.json" --include="*.md" -i -l
```
Expected: No output. If any files are listed, inspect each and either remove the reference or document the reason it must remain.

---

## Section G: Files Changed — Complete Summary

| File | Action | Reason |
|---|---|---|
| `infra/function-app/` | **DELETE (entire directory)** | Azure Functions sub-project replaced by Cloud Run |
| `infra/main.bicep` | **DELETE** | Azure Bicep IaC replaced by `infra/cloud-run/service.yaml` |
| `src/index.ts` | **MODIFY** | Add `process.env.PORT` support and `/health` endpoint |
| `src/config.ts` | **MODIFY** | Add comment documenting PORT override behavior |
| `.env.example` | **MODIFY** | Document `PORT` variable for Cloud Run context |
| `server.json` | **MODIFY** | Replace Azure URL placeholder with Cloud Run URL format |
| `package.json` | **MODIFY** | Add `docker:build`, `docker:run`, `docker:test` scripts |
| `Dockerfile` | **CREATE** | Multi-stage container build for Cloud Run |
| `.dockerignore` | **CREATE** | Optimize Docker build context |
| `infra/cloud-run/service.yaml` | **CREATE** | Declarative Cloud Run service configuration |
| `infra/cloud-run/setup.sh` | **CREATE** | One-time Google Cloud resource provisioning script |
| `.github/workflows/deploy.yml` | **REPLACE (full)** | Azure deploy steps replaced with GCP deploy steps |
| `.github/workflows/ci.yml` | **MODIFY** | Add Docker build validation step |
| `docs/DEPLOYMENT.md` | **REPLACE (full)** | Azure deployment guide replaced with Cloud Run guide |
| `README.md` | **MODIFY (targeted)** | Update badge, Quick Start URL, deployment section, Azure Key Vault references |
| `docs/CONFIGURATION.md` | **MODIFY** | Add `PORT` environment variable row |
| `CHANGELOG.md` | **CREATE or MODIFY** | Document migration changes |

**Files that must not be modified:**
`src/server.ts`, `src/cli.ts`, `src/client/**`, `src/tools/**`, `src/middleware/**`, `src/errors/**`, `src/types/**`, `tests/**`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `LICENSE`
