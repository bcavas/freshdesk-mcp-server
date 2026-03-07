import { describe, it, expect } from 'vitest';
import { Redactor } from '../../../src/middleware/redactor.js';

describe('Redactor', () => {
    const redactor = new Redactor(['phone', 'mobile', 'twitter_id']);

    describe('redact()', () => {
        it('redacts top-level fields', () => {
            const result = redactor.redact({
                id: 1,
                name: 'Jane',
                phone: '+1-555-0100',
                mobile: '+1-555-0101',
                email: 'jane@example.com',
            });
            expect(result.phone).toBe('[REDACTED]');
            expect(result.mobile).toBe('[REDACTED]');
            expect(result.name).toBe('Jane');
            expect(result.email).toBe('jane@example.com');
        });

        it('redacts nested object fields', () => {
            const result = redactor.redact({
                id: 1,
                requester: {
                    id: 101,
                    name: 'Jane',
                    phone: '+1-555-0100',
                    email: 'jane@example.com',
                },
            });
            expect((result.requester as Record<string, unknown>)['phone']).toBe('[REDACTED]');
            expect((result.requester as Record<string, unknown>)['name']).toBe('Jane');
        });

        it('does not redact null values', () => {
            const result = redactor.redact({
                phone: null,
                mobile: null,
            });
            // null values are not replaced (spec: redacted[key] != null)
            expect(result.phone).toBeNull();
        });

        it('does not alter unrelated fields', () => {
            const result = redactor.redact({
                id: 42,
                subject: 'Test ticket',
                tags: ['a', 'b'],
            });
            expect(result.id).toBe(42);
            expect(result.subject).toBe('Test ticket');
            expect(result.tags).toEqual(['a', 'b']);
        });

        it('uses custom field list from constructor', () => {
            const customRedactor = new Redactor(['email']);
            const result = customRedactor.redact({
                email: 'jane@example.com',
                phone: '+1-555-0100',
            });
            expect(result.email).toBe('[REDACTED]');
            expect(result.phone).toBe('+1-555-0100'); // Not in custom list
        });
    });
});
