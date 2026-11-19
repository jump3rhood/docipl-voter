import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(import.meta.dirname, '.env.test.local'), quiet: true });

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/stubs/empty.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
    env: {
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      HASH_SECRET: 'test-hash-secret-test-hash-secret-0123',
      ADMIN_PASSWORD: 'test-admin-password',
      ADMIN_SESSION_SECRET: 'test-session-secret-test-session-0123',
    },
  },
});
