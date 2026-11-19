import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(import.meta.dirname, '.env.test.local'), quiet: true });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
  },
});
