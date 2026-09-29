#!/usr/bin/env node
// floor-guard.mjs — diff-scoped enforcement of the CONSTRAINTS.md floor.
//
// Detects the five moves that lower the quality bar, but only NEW ones. Existing
// suppressions are tolerated: the guard compares against the merge base, so a
// long-standing `biome-ignore` never fires while a newly added one does.
//
// Usage: bun scripts/floor-guard.mjs [--base <ref>]   (default base: origin/main)
//
// Exit codes: 0 clean, 1 floor violation, 2 guard could not run.
import { execFileSync } from 'node:child_process';

const baseIndex = process.argv.indexOf('--base');
const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'origin/main';

const git = (args) => {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};

const mergeBase = git(['merge-base', base, 'HEAD'])?.trim();
if (!mergeBase) {
  console.error(`floor-guard: no merge base against ${base} — cannot verify the floor.`);
  process.exit(2);
}

// Unified diff plus untracked files: `git diff` alone cannot see new files.
const tracked = git(['diff', '--unified=0', mergeBase, '--']) ?? '';
const untracked = (git(['ls-files', '--others', '--exclude-standard']) ?? '')
  .split('\n')
  .filter(Boolean)
  .map((file) => git(['diff', '--no-index', '--unified=0', '/dev/null', file]) ?? '')
  .join('\n');

const added = [];
const removed = [];
let file = '';
let isNewFile = false;
for (const line of `${tracked}\n${untracked}`.split('\n')) {
  if (line.startsWith('+++ ')) {
    file = line.slice(6);
    // `git diff --no-index` marks a previously untracked file with /dev/null;
    // only those are genuinely new, not edits to an existing path.
    isNewFile = file === '/dev/null';
  } else if (line.startsWith('--- ')) {
    const previous = line.slice(6);
    if (previous === '/dev/null') continue;
    // Remember the pre-image path; paired with an added /dev/null target below
    // this identifies a rename or a real deletion.
    if (!file) file = previous;
  } else if (line.startsWith('+') && !line.startsWith('+++')) {
    added.push({ file: isNewFile ? '(new file)' : file, text: line.slice(1) });
  } else if (line.startsWith('-') && !line.startsWith('---')) {
    removed.push({ file, text: line.slice(1) });
  }
}

// Deno Edge Functions carry a standard `// @ts-nocheck deno-lint-ignore-file`
// header. It is toolchain boilerplate, not a silenced checker, so suppressions
// are judged by their reason text rather than blanket-allowed.
const isDenoSuppressionHeader = (text) => /@ts-nocheck\s+deno-lint-ignore-file/.test(text);

// Ecosystem suppressions (Step 6 move 3).
const SUPPRESSIONS =
  /@ts-ignore|@ts-nocheck|eslint-disable|biome-ignore|# *noqa|# *type: *ignore|istanbul ignore|nosemgrep|gitleaks:allow|Stryker disable/;

// Unfinished work (Step 6 move 4).
const STUBS =
  /throw new (Error|NotImplemented)\(.*[Nn]ot implemented|catch\s*\(\s*\w*\s*\)\s*\{\s*\}|catch\s*\{\s*\}/;

// A test made easier (Step 6 move 2).
const SKIPS = /\b(describe|it|test)\.(skip|todo)\b|\bxit\(|\bxdescribe\(/;

const isTestFile = (path) =>
  /(^|\/)(test|tests)\//.test(path) || /\.(test|spec)\.[jt]sx?$/.test(path);

const findings = [];
const flag = (rule, path, text) =>
  findings.push({ rule, file: path, text: text.trim().slice(0, 120) });

for (const { file: path, text } of added) {
  if (isTestFile(path) && SKIPS.test(text)) flag('test-made-easier', path, text);
  else if (SUPPRESSIONS.test(text) && !isDenoSuppressionHeader(text)) {
    flag('silenced-checker', path, text);
  }
  if (STUBS.test(text)) flag('unfinished-work', path, text);
}

// A deleted or renamed test file. Taken from git's own diff filter rather than
// inferred from removed lines, so an edited test is never mistaken for a deletion.
const deletedPaths = (git(['diff', '--name-only', '--diff-filter=D', mergeBase, '--']) ?? '')
  .split('\n')
  .filter(Boolean)
  .filter(isTestFile);

for (const path of deletedPaths) {
  flag('test-file-removed', path, 'test file deleted');
}

for (const { file: path, text } of removed) {
  if (isTestFile(path) && /\b(expect|it|test|assert|should)\b/.test(text)) {
    flag('assertion-removed', path, text);
  }
}

// A threshold in CONSTRAINTS.md that went down, or a floor bullet deleted.
const numbersIn = (s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const constraintsRemoved = removed.filter((l) => l.file.endsWith('CONSTRAINTS.md'));
const constraintsAdded = added.filter((l) => l.file.endsWith('CONSTRAINTS.md'));
for (const before of constraintsRemoved) {
  if (!/^\s*[-*]/.test(before.text) && !/^\s*\|/.test(before.text)) continue;
  const after = constraintsAdded.find((a) => a.text.trim() === before.text.trim());
  if (!after) continue;
  const beforeNums = numbersIn(before.text);
  const afterNums = numbersIn(after.text);
  if (afterNums.some((n, i) => beforeNums[i] !== undefined && n < beforeNums[i])) {
    flag('threshold-lowered', before.file, `${before.text.trim()}  ->  ${after.text.trim()}`);
  }
}

// A floor bullet or constraint removed entirely.
for (const before of constraintsRemoved) {
  const text = before.text.trim();
  if (!/^[-*]/.test(text)) continue;
  const key = text.replace(/^[-*]\s*/, '').slice(0, 60);
  const stillPresent = constraintsAdded.some((a) =>
    a.text.replace(/^[-*]\s*/, '').startsWith(key.slice(0, 40)),
  );
  if (!stillPresent) flag('constraint-removed', before.file, text);
}

if (findings.length === 0) {
  console.log(`floor-guard: clean (base ${base} @ ${mergeBase.slice(0, 7)})`);
  process.exit(0);
}

console.error(`floor-guard: ${findings.length} floor violation(s):\n`);
for (const f of findings) console.error(`  [${f.rule}] ${f.file}\n      ${f.text}`);
console.error('\nEach of these lowers the bar. Fix the code, or record a documented exception.');
process.exit(1);
