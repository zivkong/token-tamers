import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // All tests live in each project's root-level __tests__/ folder.
    include: ['packages/*/__tests__/**/*.test.ts', 'apps/*/__tests__/**/*.test.ts'],
  },
});
