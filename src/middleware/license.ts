/**
 * License key validation module (optional/future monetization)
 * Currently a no-op stub — activate by setting LICENSE_KEY_REQUIRED=true
 */

export interface LicenseValidationResult {
    valid: boolean;
    reason?: string;
    tier?: 'free' | 'pro' | 'enterprise';
    callsRemaining?: number;
}

export class LicenseValidator {
    private required: boolean;

    constructor(required: boolean = false) {
        this.required = required;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async validate(licenseKey?: string): Promise<LicenseValidationResult> {
        if (!this.required) {
            return { valid: true, tier: 'free' };
        }

        if (!licenseKey) {
            return { valid: false, reason: 'LICENSE_KEY_REQUIRED is true but no license key provided.' };
        }

        // TODO: Implement actual license validation with PayMCP or custom server
        // For now, any non-empty key is accepted
        return { valid: true, tier: 'pro' };
    }
}
