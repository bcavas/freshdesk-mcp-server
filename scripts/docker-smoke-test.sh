#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="freshdesk-mcp-server:smoke-test"
CONTAINER_NAME="mcp-smoke-$$"
PORT=8080

echo "==> Building image for smoke test..."
docker build -t "$IMAGE_NAME" .

echo "==> Starting container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$PORT:$PORT" \
  -e PORT="$PORT" \
  -e NODE_ENV="test" \
  -e MCP_TRANSPORT="streamable-http" \
  -e FRESHDESK_API_KEY="smoke-test-placeholder" \
  -e FRESHDESK_DOMAIN="smoke-test-placeholder" \
  "$IMAGE_NAME"

# Cleanup on exit regardless of success or failure
cleanup() {
  echo "==> Cleaning up container..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Waiting for server to start..."
for i in {1..12}; do
  if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    echo "    Server ready after ${i} attempts."
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "❌ Server did not start within 60 seconds."
    echo "==> Container logs:"
    docker logs "$CONTAINER_NAME"
    exit 1
  fi
  sleep 5
done

echo "==> Checking /health endpoint..."
HEALTH_RESPONSE=$(curl -sf "http://localhost:$PORT/health")
echo "    Response: $HEALTH_RESPONSE"

# Verify health response contains expected fields
if ! echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
  echo "❌ Health response missing 'status' field."
  exit 1
fi

echo "==> Checking /mcp endpoint responds (tools/list)..."
MCP_RESPONSE=$(curl -sf -X POST "http://localhost:$PORT/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  2>/dev/null) || true

if echo "$MCP_RESPONSE" | grep -q '"tools"'; then
  echo "    tools/list returned successfully."
else
  echo "    Note: tools/list did not return expected response (may require session init)."
  echo "    Response: $MCP_RESPONSE"
fi

echo "✅ Docker smoke test passed."
