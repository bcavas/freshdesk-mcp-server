import { FreshdeskApiError } from './freshdesk-error.js';

export function mapErrorToToolResult(err: unknown): {
    content: { type: string; text: string }[];
    isError: boolean;
} {
    if (err instanceof FreshdeskApiError) {
        const suggestions: Record<number, string> = {
            401: 'Check your FRESHDESK_API_KEY — it may be invalid or expired. Find it in Freshdesk > Profile Settings > Your API Key.',
            403: 'Your API key lacks permission for this operation. Check the agent role in Freshdesk admin.',
            404: 'The requested resource was not found. Verify the ID is correct.',
            409: 'Conflict — this resource may have been modified concurrently. Retry with fresh data.',
            429: 'Rate limit exceeded. The server will automatically retry. If persistent, reduce request frequency.',
        };
        const suggestion =
            suggestions[err.statusCode] ?? 'An unexpected Freshdesk API error occurred.';
        return {
            content: [
                {
                    type: 'text',
                    text: `Freshdesk API Error (${err.statusCode}): ${err.message}. ${suggestion}`,
                },
            ],
            isError: true,
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
            },
        ],
        isError: true,
    };
}
