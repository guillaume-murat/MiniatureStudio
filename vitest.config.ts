import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'local/**/*.test.ts', 'mcp/**/*.test.ts'],
  },
});
