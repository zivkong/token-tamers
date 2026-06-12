import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { tt: 'src/main.ts' },
  // dist/tt.js (ESM) is the npm bin; dist/tt.cjs feeds the standalone-binary
  // build (@yao-pkg/pkg) in the release workflow.
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Zero runtime dependencies: bundle every workspace package (and the JSON
  // content packs they import) into the single output file.
  noExternal: [/^@token-tamers\//],
  // NOTE: node:sqlite postdates esbuild's node20 builtin list, so the OpenCode
  // adapter imports it via an indirect specifier (see opencode/index.ts) —
  // a literal import would be rewritten to a broken `import("sqlite")`.
  // `env -S` (needed to pass node flags through a shebang) requires coreutils
  // >= 8.30 and breaks the bin on older Linux installs, so the shebang stays
  // plain; the node:sqlite ExperimentalWarning is filtered in-process instead
  // (see the process 'warning' handler in main.ts).
  banner: ({ format }) => (format === 'esm' ? { js: '#!/usr/bin/env node' } : {}),
});
