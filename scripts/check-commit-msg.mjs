#!/usr/bin/env node
// Commit message format gate (commit-msg hook) — Conventional Commits.
// The format is documented in CONTRIBUTING.md; keep the two in sync.
//
//   <type>(<scope>)?: <description>        e.g. feat(core): add DST handling
//
// Rules:
//   1. type ∈ feat | fix | docs | chore | refactor | test | perf | build | ci |
//      style | revert; optional lowercase-kebab (scope); optional ! for breaking.
//   2. Description: required, lowercase start, no trailing period.
//   3. Header (whole first line) ≤ 72 chars.
//   4. If a body follows, the second line must be blank; body wraps at 100
//      (URLs and `Key: value` trailers exempt). Breaking changes may use a
//      `BREAKING CHANGE:` footer.
import { readFileSync } from 'node:fs';

const TYPES = [
  'feat',
  'fix',
  'docs',
  'chore',
  'refactor',
  'test',
  'perf',
  'build',
  'ci',
  'style',
  'revert',
];

const file = process.argv[2];
if (!file) {
  console.error('usage: check-commit-msg.mjs <commit-msg-file>');
  process.exit(2);
}

const raw = readFileSync(file, 'utf8');
const lines = raw
  .split('\n')
  .filter((l) => !l.startsWith('#')) // strip git comment lines
  .join('\n')
  .trimEnd()
  .split('\n');

const header = lines[0] ?? '';
const errors = [];

// Git-generated shapes pass through untouched.
const exempt = /^(Merge |Revert "|fixup! |squash! |amend! )/.test(header);

if (!exempt) {
  const m = header.match(/^([a-z]+)(\(([^)]*)\))?(!)?: (.*)$/);
  if (!m) {
    errors.push(
      'Header must be Conventional Commits: "<type>(<scope>)?: <description>", e.g. "feat(core): add DST handling".',
    );
  } else {
    const [, type, , scope, , description] = m;
    if (!TYPES.includes(type)) {
      errors.push(`Unknown type "${type}". Allowed: ${TYPES.join(', ')}.`);
    }
    if (scope !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(scope)) {
      errors.push(`Scope "(${scope})" must be lowercase kebab-case, e.g. (core), (cli), (deps).`);
    }
    if (description.trim().length < 4) {
      errors.push('Description is too short (min 4 chars).');
    }
    if (/^[A-Z]/.test(description)) {
      errors.push('Description starts lowercase ("feat: add …", not "feat: Add …").');
    }
    if (/\.$/.test(description)) {
      errors.push('Description must not end with a period.');
    }
  }
  if (header.length > 72) {
    errors.push(`Header is ${header.length} chars (max 72).`);
  }
}

if (lines.length > 1 && lines[1].trim() !== '') {
  errors.push('Leave a blank line between the header and the body.');
}

const trailerOrUrl = /(https?:\/\/|^[A-Za-z-]+(\s[A-Z-]+)*:\s|^\s{4})/;
for (let i = 2; i < lines.length; i++) {
  const l = lines[i];
  if (l.length > 100 && !trailerOrUrl.test(l)) {
    errors.push(`Body line ${i + 1} is ${l.length} chars (max 100): "${l.slice(0, 40)}…"`);
  }
}

if (errors.length > 0) {
  console.error('✖ Commit message rejected:\n');
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    '\nConventional Commits format (see CONTRIBUTING.md):\n\n' +
      '  <type>(<scope>)?: <description>   — header ≤ 72 chars, description\n' +
      '  lowercase, no trailing period; blank line before an optional body\n' +
      `  wrapped at 100. Types: ${TYPES.join(', ')}.\n\n` +
      'Examples:\n\n' +
      '  feat(core): add static cycle-policy DST handling\n' +
      '  fix(tui): restore cursor on SIGTERM during shell teardown\n' +
      '  docs: clarify grade-roll odds in the wiki\n' +
      '  chore(deps): bump vitest to 2.1.9\n',
  );
  process.exit(1);
}
