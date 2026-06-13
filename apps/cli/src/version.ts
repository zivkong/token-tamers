/**
 * The `tt` binary version. Single source of truth, kept in sync with
 * apps/cli/package.json "version". Lives in its own module so both the entry
 * point (`tt --version`) and the shell's Settings page can read it without an
 * import cycle through main.ts.
 */
export const VERSION = '0.1.0';
