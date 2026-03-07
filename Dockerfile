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
