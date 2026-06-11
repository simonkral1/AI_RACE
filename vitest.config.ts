import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**', // Exclude Playwright tests (any checkout depth)
      '**/.claude/worktrees/**', // Exclude agent worktrees
      '**/.codex/**',
    ],
  },
});
