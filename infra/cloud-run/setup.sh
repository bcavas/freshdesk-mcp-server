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
# GITHUB_REPO must be set before running this script, e.g.:
#   GITHUB_REPO="bcavas/freshdesk-mcp-server" bash setup.sh
if [[ -z "${GITHUB_REPO:-}" ]]; then
  echo "ERROR: GITHUB_REPO environment variable is required."
  echo "  Set it before running this script, e.g.:"
  echo "  GITHUB_REPO=\"<your-github-org>/<your-repo>\" bash setup.sh"
  exit 1
fi

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

# Allow GitHub Actions to generate access tokens for the service account
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_PROVIDER%/providers/*}/attribute.repository/${GITHUB_REPO}" \
  --project="${PROJECT_ID}"

# Grant service account permissions to deploy Cloud Run and push images
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}"

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
