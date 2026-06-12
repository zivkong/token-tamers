#!/usr/bin/env node
// Commit message format gate (commit-msg hook). The format is documented in
// CONTRIBUTING.md — keep the two in sync.
//
// Rules:
//   1. Subject line: required, 8–72 chars, starts with a capital letter,
//      imperative mood encouraged, no trailing period.
//   2. If a body follows, the second line must be blank.
//   3. Body lines wrap at 100 chars (URLs and trailer lines exempt).
import { readFileSync } from 'node:fs';

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

const subject = lines[0] ?? '';
const errors = [];

// Merge/revert/fixup/squash commits are git-generated shapes — let them through.
const exempt = /^(Merge |Revert |fixup! |squash! |amend! )/.test(subject);

if (!exempt) {
  if (subject.trim().length === 0) errors.push('Subject line is empty.');
  if (subject.length > 72) errors.push(`Subject is ${subject.length} chars (max 72).`);
  if (subject.length > 0 && subject.length < 8) errors.push('Subject is too short (min 8 chars).');
  if (/^[a-z]/.test(subject))
    errors.push('Subject must start with a capital letter (e.g. "Add …", "Fix …").');
  if (/^\s/.test(subject)) errors.push('Subject must not start with whitespace.');
  if (/\.$/.test(subject)) errors.push('Subject must not end with a period.');
}

if (lines.length > 1 && lines[1].trim() !== '') {
  errors.push('Leave a blank line between the subject and the body.');
}

const trailerOrUrl = /(https?:\/\/|^[A-Za-z-]+:\s|^\s{4})/;
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
    '\nFormat (see CONTRIBUTING.md): capitalized imperative subject ≤ 72 chars,\n' +
      'no trailing period, blank line before an optional body wrapped at 100 chars.\n' +
      'Example:\n\n' +
      '  Add static cycle-policy DST handling\n\n' +
      '  Window math previously assumed fixed UTC offsets; derive offsets per\n' +
      '  event instead. Covers the week-anchor migration case from docs/design.\n',
  );
  process.exit(1);
}
