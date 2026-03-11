# Operations Runbook — Freshdesk MCP Server

## Manual Setup Steps (one-time, performed before first deployment)

These steps cannot be automated and must be performed by the developer in the
Google Cloud Console or via `gcloud` CLI.

### Step 1: Set your GCP project ID

Replace `YOUR_PROJECT_ID` in the following files with your actual GCP project ID:
- `infra/cloud-run/service-staging.yaml`
- `infra/cloud-run/service-prod.yaml`
- `.github/workflows/deploy.yml`

### Step 2: Enable required GCP APIs

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --project=YOUR_PROJECT_ID
```

### Step 3: Create Artifact Registry repository

```bash
gcloud artifacts repositories create freshdesk-mcp-server \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID
```

### Step 4: Create the runtime service account

```bash
# Create the SA
gcloud iam service-accounts create freshdesk-mcp-runtime-sa \
  --display-name="Freshdesk MCP Runtime" \
  --project=YOUR_PROJECT_ID

# Grant only secret access — nothing else
gcloud secrets add-iam-policy-binding freshdesk-api-key \
  --member="serviceAccount:freshdesk-mcp-runtime-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_PROJECT_ID

gcloud secrets add-iam-policy-binding freshdesk-domain \
  --member="serviceAccount:freshdesk-mcp-runtime-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_PROJECT_ID
```

### Step 5: Store secrets in Secret Manager

```bash
# Store your Freshdesk API key
echo -n "YOUR_ACTUAL_FRESHDESK_API_KEY" | \
  gcloud secrets create freshdesk-api-key \
  --replication-policy=automatic \
  --data-file=- \
  --project=YOUR_PROJECT_ID

# Store your Freshdesk domain (subdomain only, e.g. "yourcompany")
echo -n "YOUR_FRESHDESK_SUBDOMAIN" | \
  gcloud secrets create freshdesk-domain \
  --replication-policy=automatic \
  --data-file=- \
  --project=YOUR_PROJECT_ID
```

### Step 6: Set up Workload Identity Federation for GitHub Actions

This enables GitHub Actions to deploy to GCP without storing service account key
files as GitHub secrets — keyless authentication.

```bash
# Create the deploy service account
gcloud iam service-accounts create freshdesk-mcp-deploy-sa \
  --display-name="Freshdesk MCP Deploy" \
  --project=YOUR_PROJECT_ID

# Grant deploy SA the permissions it needs
for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:freshdesk-mcp-deploy-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="$ROLE"
done

# Create the WIF pool
gcloud iam workload-identity-pools create github-actions-pool \
  --location=global \
  --display-name="GitHub Actions Pool" \
  --project=YOUR_PROJECT_ID

# Create the OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --workload-identity-pool=github-actions-pool \
  --location=global \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='YOUR_GITHUB_ORG/freshdesk-mcp-server'" \
  --project=YOUR_PROJECT_ID

# Bind the deploy SA to the GitHub repo
WIF_POOL=$(gcloud iam workload-identity-pools describe github-actions-pool \
  --location=global \
  --project=YOUR_PROJECT_ID \
  --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding \
  freshdesk-mcp-deploy-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/${WIF_POOL}/attribute.repository/YOUR_GITHUB_ORG/freshdesk-mcp-server" \
  --project=YOUR_PROJECT_ID

# Print the values you need for GitHub secrets
WIF_PROVIDER=$(gcloud iam workload-identity-pools providers describe github-provider \
  --workload-identity-pool=github-actions-pool \
  --location=global \
  --project=YOUR_PROJECT_ID \
  --format="value(name)")

echo "Add these as GitHub Actions secrets:"
echo "  WIF_PROVIDER:       $WIF_PROVIDER"
echo "  WIF_SERVICE_ACCOUNT: freshdesk-mcp-deploy-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

### Step 7: Add GitHub Actions secrets

In your GitHub repository: **Settings → Secrets and variables → Actions → New secret**

| Secret name | Value |
|---|---|
| `WIF_PROVIDER` | Output from Step 6 above |
| `WIF_SERVICE_ACCOUNT` | `freshdesk-mcp-deploy-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com` |

### Step 8: Configure the GitHub production environment (approval gate)

In your GitHub repository:
1. Go to **Settings → Environments → New environment**
2. Name it exactly: `production`
3. Check **Required reviewers** → add your GitHub username
4. Click **Save protection rules**

This prevents production deployments from running without your explicit approval.

### Step 9: Set up Artifact Registry cleanup policy (prevents storage cost creep)

```bash
gcloud artifacts repositories set-cleanup-policies freshdesk-mcp-server \
  --project=YOUR_PROJECT_ID \
  --location=us-central1 \
  --policy='[{
    "name": "keep-last-10",
    "action": {"type": "Keep"},
    "mostRecentVersions": {"keepCount": 10}
  }]'
```

### Step 10: Set up a billing alert

In Google Cloud Console:
**Billing → Budgets & alerts → Create Budget**
- Set monthly budget: $5 (you should never exceed this pre-revenue)
- Alert thresholds: 50%, 90%, 100%
- Enable email alerts

---

## Day-to-Day Deployment Workflow

### Deploy a change (normal flow)

1. Create a branch, make your changes, open a pull request
2. CI runs automatically — fix any failures before merging
3. Merge to `main` → staging deploys automatically
4. Verify staging: `npx @modelcontextprotocol/inspector STAGING_URL/mcp`
5. When satisfied: go to **Actions → Deploy → Run workflow** → check
   `promote_to_prod` → click **Run workflow**
6. GitHub will ask you to approve the `production` environment — click **Approve**
7. Production deploys with the same image that was tested in staging

### Rollback production (< 5 minutes)

```bash
# List recent production revisions
gcloud run revisions list \
  --service=freshdesk-mcp-server-prod \
  --region=us-central1

# Roll back to the previous revision (replace REV_NAME with actual name)
gcloud run services update-traffic freshdesk-mcp-server-prod \
  --to-revisions=REV_NAME=100 \
  --region=us-central1

# Verify
curl -f https://YOUR_PROD_URL/health
```

### When your first paying customer arrives

Run this single command to eliminate cold starts:

```bash
gcloud run services update freshdesk-mcp-server-prod \
  --min-instances=1 \
  --region=us-central1
```

This adds ~$10–15/month to your GCP bill. Do not do this before you have revenue.

---

## Cost Reference

| Configuration | Estimated monthly cost |
|---|---|
| Both services, minScale=0, no traffic | ~$0 |
| Both services, minScale=0, light traffic | ~$0–2 |
| Prod with minScale=1 (paying users) | ~$10–15 |
| + Global Load Balancer (custom domain + WAF) | +$18–25 |
