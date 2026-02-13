import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/workflow/engine/**'],
        },
    },
});
