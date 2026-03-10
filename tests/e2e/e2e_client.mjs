import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";

const urlObj = new URL(process.env.E2E_SERVICE_URL || "http://localhost:3000");
const path = urlObj.pathname === "/" ? "/mcp" : `${urlObj.pathname}/mcp`;
const mcpUrl = new URL(path, urlObj.origin);

const method = process.argv[2];
const params = JSON.parse(process.argv[3] || "{}");

setTimeout(() => {
    console.error(JSON.stringify({ result: { isError: true, content: [{ text: "Timeout inside official SDK e2e_client" }] } }));
    process.exit(1);
}, 10000);

async function run() {
    try {
        const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
        const client = new Client({ name: "e2e-test", version: "1.0" }, { capabilities: {} });

        await client.connect(transport);

        let reqPayload;
        try {
            reqPayload = await client.request({ method, params }, z.any()); // Pass a passthrough validation
        } catch (e) {
            // client.request might throw if it gets an error from the server
            reqPayload = e;
        }

        // Output exactly what run-e2e.sh expects: the `.result` object nested in `{ result: ... }`
        const wrapped = { result: reqPayload };
        process.stdout.write(JSON.stringify(wrapped) + "\n", () => {
            process.exit(0);
        });
    } catch (err) {
        console.error("SDK Error:", err.message);
        process.exit(1);
    }
}

run();
