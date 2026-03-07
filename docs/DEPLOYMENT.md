# Azure Deployment Guide

## Prerequisites

- Azure CLI (`az --version` ≥ 2.50)
- An Azure subscription
- Node.js 20+

---

## Option 1: Azure Developer CLI (Recommended)

```bash
# Install azd
npm install -g @azure/dev
# or: brew install azure/azd/azd (macOS)

# Login
az login
azd auth login

# Deploy (provisions and deploys in one step)
azd up
```

You'll be prompted for:
- **Environment name** (e.g., `freshdesk-mcp-prod`)
- **Azure subscription**
- **Region** (recommend `eastus` or `westus2`)
- `FRESHDESK_DOMAIN` and `FRESHDESK_API_KEY` (stored in Key Vault)

---

## Option 2: Manual Bicep Deployment

```bash
# Create resource group
az group create --name freshdesk-mcp-rg --location eastus

# Deploy Bicep template
az deployment group create \
  --resource-group freshdesk-mcp-rg \
  --template-file infra/main.bicep \
  --parameters appName=freshdesk-mcp-server location=eastus

# Build and deploy function app
npm ci && npm run build
az functionapp deployment source config-zip \
  --resource-group freshdesk-mcp-rg \
  --name freshdesk-mcp-server \
  --src dist.zip
```

---

## Setting Secrets in Key Vault

```bash
# After deployment, add your Freshdesk API key
az keyvault secret set \
  --vault-name freshdesk-mcp-server-kv \
  --name freshdesk-api-key \
  --value "YOUR_API_KEY"

# Set the domain in app settings
az functionapp config appsettings set \
  --resource-group freshdesk-mcp-rg \
  --name freshdesk-mcp-server \
  --settings FRESHDESK_DOMAIN=yourcompany
```

---

## Verifying the Deployment

```bash
# Health check
curl https://freshdesk-mcp-server.azurewebsites.net/health
# Expected: {"status":"ok","version":"0.1.0"}

# Test MCP endpoint (initialize session)
curl -X POST https://freshdesk-mcp-server.azurewebsites.net/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","clientInfo":{"name":"test","version":"1.0"}}}'
```

---

## MCP Client Configuration (Remote Mode)

For Claude Desktop or other MCP clients that support remote servers:

```json
{
  "mcpServers": {
    "freshdesk": {
      "url": "https://freshdesk-mcp-server.azurewebsites.net/mcp"
    }
  }
}
```

---

## Cost Estimate

| Resource | SKU | Est. Monthly Cost |
|---|---|---|
| Functions (Flex Consumption) | FC1 | ~$1–8 (scale-to-zero) |
| Storage Account | Standard LRS | ~$0.05 |
| Application Insights | Pay-as-you-go | ~$0–3 |
| Key Vault | Standard | ~$0.03 |
| **Total** | | **~$2–12/month** |
