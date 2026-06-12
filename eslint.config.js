import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Node modules that can touch the network. Token Tamers is fully offline by
// design pillar 7 — importing any of these anywhere is a build failure.
const NETWORK_MODULES = ['http', 'https', 'net', 'tls', 'dgram', 'dns', 'http2'].flatMap((m) => [
  m,
  `node:${m}`,
]);

const banNetworkImports = {
  paths: NETWORK_MODULES.map((name) => ({
    name,
    message: 'Token Tamers never touches the network (design pillar 7).',
  })),
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/node_modules/**',
      'coverage/**',
      // Local Claude Code worktrees are full repo copies — lint them from
      // inside the worktree, never from the parent checkout.
      '.claude/worktrees/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Plain Node scripts (hooks, tooling) — give them the Node globals.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
  {
    files: ['packages/**/*.ts', 'apps/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', banNetworkImports],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Token Tamers never touches the network (design pillar 7).' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // KISS/SRP guardrails: generous ceilings that catch monoliths and deep
    // nesting, not style. A file that trips these needs splitting by
    // responsibility, not a lint-disable.
    files: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      complexity: ['error', 20],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'no-duplicate-imports': 'error',
    },
  },
  {
    // packages/core is pure and deterministic: no I/O, no other workspace
    // packages, no wall clock, no ambient randomness. Time and randomness
    // enter core only as data (timestamps on events, seeded RNG).
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...banNetworkImports,
          patterns: [
            {
              group: ['@token-tamers/*', 'node:*', 'fs', 'path', 'os', 'child_process', 'crypto'],
              message: 'core imports nothing but itself (import-boundary invariant).',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'core is deterministic — accept timestamps as input instead.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'core is deterministic — use the seeded RNG from core/rng.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'core is deterministic — no wall clock.',
        },
      ],
    },
  },
  {
    // tui may import core only — never adapters or content.
    files: ['packages/tui/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...banNetworkImports,
          patterns: [
            {
              group: ['@token-tamers/adapters', '@token-tamers/content'],
              message: 'tui may import only @token-tamers/core (import-boundary invariant).',
            },
          ],
        },
      ],
    },
  },
  {
    // adapters may import core only — never tui or content.
    files: ['packages/adapters/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...banNetworkImports,
          patterns: [
            {
              group: ['@token-tamers/tui', '@token-tamers/content'],
              message: 'adapters may import only @token-tamers/core (import-boundary invariant).',
            },
          ],
        },
      ],
    },
  },
);
