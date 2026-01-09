import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret',
    },
  },
});
