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
  banner: ({ format }) => (format === 'esm' ? { js: '#!/usr/bin/env node' } : {}),
});
