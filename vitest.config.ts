import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        env: {
            FRESHDESK_DOMAIN: 'testcompany',
            FRESHDESK_API_KEY: 'test-api-key',
        },
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/types/**', 'src/index.ts', 'src/logger.ts', 'src/server.ts', 'src/cli.ts'],
            thresholds: {
                branches: 80,
                functions: 80,
                lines: 80,
                statements: 80,
            },
        },
        testTimeout: 10000,
    },
});
