import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/prisma.mock.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/real_sabor_test?schema=public',
      JWT_SECRET: 'test-secret',
    },
  },
});
