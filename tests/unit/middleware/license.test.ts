import { describe, it, expect } from 'vitest';
import { LicenseValidator } from '../../../src/middleware/license.js';

describe('LicenseValidator', () => {
    it('validates without key when not required', async () => {
        const validator = new LicenseValidator(false);
        const result = await validator.validate();
        expect(result.valid).toBe(true);
        expect(result.tier).toBe('free');
    });

    it('validates without key when default constructed', async () => {
        const validator = new LicenseValidator();
        const result = await validator.validate();
        expect(result.valid).toBe(true);
        expect(result.tier).toBe('free');
    });

    it('fails when required but no key provided', async () => {
        const validator = new LicenseValidator(true);
        const result = await validator.validate('');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('LICENSE_KEY_REQUIRED is true');
    });

    it('succeeds when required and key provided', async () => {
        const validator = new LicenseValidator(true);
        const result = await validator.validate('some-key');
        expect(result.valid).toBe(true);
        expect(result.tier).toBe('pro');
    });
});
