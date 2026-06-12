# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately via
**[GitHub private vulnerability reporting](https://github.com/zivkong/token-tamers/security/advisories/new)**
(Security tab → "Report a vulnerability"). Do not open a public issue for security
reports. You should receive a response within 7 days.

## Security model

Token Tamers' core security promise is architectural: **the program contains no
network-capable code at all.** It never calls an AI API, never phones home, never
updates itself, and never transmits anything. It reads coding-agent log files and
writes only to `~/.tokentamers/`. This is enforced mechanically:

- ESLint bans importing every network-capable Node module, repo-wide.
- `scripts/check-zero-network.sh` greps for network modules / `fetch` / sockets in CI.
- Zero runtime dependencies — the shipped bundle contains only this repo's code
  (`scripts/check-runtime-deps.sh` enforces it).

Anything that weakens that promise is a vulnerability — report it.

## Supply-chain protections (in-repo)

Defenses against self-replicating npm-worm attacks and CI compromise:

| Layer              | Protection                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle scripts  | pnpm blocks dependency install scripts; only `esbuild` is allowlisted (`pnpm-workspace.yaml`). Worms that propagate via `postinstall` cannot execute.                                             |
| Release cooldown   | `minimumReleaseAge: 4320` — versions younger than 3 days are never installed, so freshly-poisoned releases are caught/yanked before they reach us. Dependabot mirrors this with a 7-day cooldown. |
| Version pinning    | `save-exact=true`; `pnpm-lock.yaml` is committed; CI installs with `--frozen-lockfile` only.                                                                                                      |
| Runtime deps       | Zero, permanently — adding one requires an approved issue and fails CI otherwise.                                                                                                                 |
| Actions pinning    | Every GitHub Action is pinned to a full commit SHA (mutable tags are a known compromise vector); `scripts/check-workflow-pins.sh` fails CI on any unpinned ref.                                   |
| Token scope        | Workflows default to `contents: read`; `persist-credentials: false` on checkout; write scopes are granted per-job only where needed (release).                                                    |
| Dependency review  | `dependency-review-action` blocks PRs introducing vulnerable/malicious packages.                                                                                                                  |
| Static analysis    | CodeQL (security-extended) on every PR + weekly.                                                                                                                                                  |
| Posture monitoring | OpenSSF Scorecard runs weekly and publishes results.                                                                                                                                              |
| Release integrity  | Release artifacts ship `SHA256SUMS.txt` and signed build provenance — verify with `gh attestation verify <file> --repo zivkong/token-tamers`.                                                     |
| Review gate        | `CODEOWNERS` requires maintainer review on workflows, scripts, manifests, and the lockfile.                                                                                                       |

## Maintainer settings checklist (GitHub-side, not in-repo)

These complement the in-repo gates and must be enabled in repository settings:

- [ ] **Secret scanning + push protection** (Settings → Code security)
- [ ] **Private vulnerability reporting** (Settings → Code security)
- [ ] **Branch ruleset on `main`:** require PRs, require CI + dependency-review status
      checks, block force pushes (maintainer bypass allowed)
- [ ] **Actions:** require approval for first-time outside contributors; default
      workflow permissions = read-only (Settings → Actions → General)
- [ ] If ever publishing to npm: use **trusted publishing (OIDC)** — no long-lived
      npm tokens anywhere, `npm publish --provenance`

## Supported versions

Only the latest release receives security fixes.
