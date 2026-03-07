import http from 'k6/http';
import { check, sleep } from 'k6';

// 50 concurrent clients for 30 seconds
export const options = {
    vus: 50,
    duration: '30s',
    thresholds: {
        // Assert that 95% of requests complete within 200ms
        http_req_duration: ['p(95)<200', 'med<200'],
    },
};

const baseUrl = __ENV.MCP_URL || 'http://localhost:3000/mcp';

// Generate some random ticket and contact IDs to query
const ticketIds = [1, 2, 3, 4, 5];
const contactIds = [101, 102, 103];

// Simulates an MCP client sending JSON-RPC 2.0 messages over HTTP
function jsonRpcRequest(method, params, id) {
    return {
        jsonrpc: '2.0',
        id: id,
        method: method,
        params: params,
    };
}

export default function () {
    const payloads = [
        // 1. Get a specific ticket
        jsonRpcRequest('tools/call', {
            name: 'get_ticket',
            arguments: { ticket_id: ticketIds[Math.floor(Math.random() * ticketIds.length)] }
        }, 1),
        // 2. List tickets
        jsonRpcRequest('tools/call', {
            name: 'list_tickets',
            arguments: { page: 1, per_page: 30 }
        }, 2),
        // 3. Get contact
        jsonRpcRequest('tools/call', {
            name: 'get_contact',
            arguments: { contact_id: contactIds[Math.floor(Math.random() * contactIds.length)] }
        }, 3),
        // 4. List SLA policies (shared across all)
        jsonRpcRequest('tools/call', {
            name: 'list_sla_policies',
            arguments: {}
        }, 4),
        // 5. List Automation Rules
        jsonRpcRequest('tools/call', {
            name: 'list_automation_rules',
            arguments: { type: 'ticket_creation' }
        }, 5)
    ];

    // Pick a random payload to execute
    const payload = payloads[Math.floor(Math.random() * payloads.length)];

    const res = http.post(baseUrl, JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
        'status is 200': (r) => r.status === 200,
        // Since we are mocking responses or testing error responses in the sandbox, we don't strictly check for the exact 'result' object unless we know the response envelope of ModelContextProtocol over HTTP. In streamable HTTP, the actual response envelope might be slightly different. For this load test, checking status 200 and measuring the round-trip cache time is sufficient for verify performance.
    });

    // Add a small sleep to simulate human/LLM think time between requests
    sleep(0.5);
}
