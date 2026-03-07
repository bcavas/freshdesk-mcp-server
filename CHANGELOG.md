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
