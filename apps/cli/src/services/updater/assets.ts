/**
 * Pure install-kind detection + release-asset naming. No network, no I/O.
 *
 * Asset names mirror `.github/workflows/release.yml`:
 *   tt-linux-x64 · tt-linux-arm64 · tt-macos-x64 · tt-macos-arm64 · tt-windows-x64.exe
 */

/** How this `tt` is running: a self-contained pkg binary, `node tt.js`, or tsx dev. */
export type InstallKind = 'binary' | 'node' | 'tsx';

/**
 * Detect the install kind from runtime facts (passed in so it's testable).
 * - tsx/dev: the entry script (`argv[1]`) is a `.ts` file.
 * - node: the executable is `node` (so it's running `node tt.js`).
 * - binary: the executable is the self-contained pkg binary itself.
 */
export function installKind(execPath: string, argv1: string | undefined): InstallKind {
  if (argv1 && /\.ts$/i.test(argv1)) return 'tsx';
  if (/(?:^|[/\\])node(?:\.exe)?$/i.test(execPath)) return 'node';
  return 'binary';
}

/** The release asset name for this platform+arch, or null if unsupported. */
export function assetNameFor(platform: NodeJS.Platform, arch: string): string | null {
  const os =
    platform === 'darwin'
      ? 'macos'
      : platform === 'linux'
        ? 'linux'
        : platform === 'win32'
          ? 'windows'
          : null;
  if (!os) return null;
  if (os === 'windows') return arch === 'x64' ? 'tt-windows-x64.exe' : null;
  const a = arch === 'arm64' ? 'arm64' : arch === 'x64' ? 'x64' : null;
  return a ? `tt-${os}-${a}` : null;
}
