/**
 * The `tt` binary version. The monorepo root `package.json` is the single source
 * of truth: its `version` is bumped from the git tag at release time (see
 * `.github/workflows/release.yml`) and inlined into the bundle by tsup/esbuild
 * (and resolved directly by tsx in dev). Lives in its own module so both the
 * entry point (`tt --version`) and the shell's Settings page can read it without
 * an import cycle through main.ts.
 */
import rootPackageJson from '../../../package.json';

export const VERSION: string = rootPackageJson.version;
