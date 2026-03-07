const INJECTION_PATTERNS = [
    /<IMPORTANT>/i,
    /ignore\s+(previous|all|above)\s+instructions/i,
    /you\s+are\s+now/i,
    /system\s*:\s*/i,
    /\[INST\]/i,
    /<\|im_start\|>/i,
    /\u200b/, // zero-width space
    /\u200e/, // left-to-right mark
    /\ufeff/, // BOM
];

export class InputGuard {
    validate(input: Record<string, unknown>): { safe: boolean; reason?: string } {
        for (const [key, value] of Object.entries(input)) {
            if (typeof value !== 'string') continue;
            for (const pattern of INJECTION_PATTERNS) {
                if (pattern.test(value)) {
                    return { safe: false, reason: `Suspicious pattern detected in field '${key}'` };
                }
            }
        }
        return { safe: true };
    }
}
