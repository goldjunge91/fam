import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import * as ts from 'typescript';

type Options = {
  includeSameFile: boolean;
  includeTests: boolean;
  json: boolean;
  minLines: number;
  minTokens: number;
  quiet: boolean;
  threshold: number;
  top: number;
  targets: string[];
};

type FunctionCandidate = {
  endLine: number;
  filePath: string;
  kind: string;
  name: string;
  normalizedTokens: string[];
  relativePath: string;
  startLine: number;
};

type SourceFileInput = {
  filePath: string;
  relativePath: string;
  source: string;
};

type SimilarityMatch = {
  left: FunctionCandidate;
  score: number;
  sharedShingles: number;
  right: FunctionCandidate;
};

type FunctionReference = {
  file: string;
  kind: string;
  name: string;
  range: string;
};

type ReportSimilarityMatch = {
  left: FunctionReference;
  score: number;
  sharedShingles: number;
  right: FunctionReference;
};

type AnalysisReport = {
  exactDuplicateGroups: Array<{
    functions: Array<{
      file: string;
      name: string;
      range: string;
    }>;
    normalizedTokenCount: number;
  }>;
  files: string[];
  functions: number;
  similarMatches: ReportSimilarityMatch[];
};

const DEFAULT_TARGETS = [
  'src/lib/sync/coalesce.ts',
  'src/lib/sync/inventory-move.ts',
  'src/lib/sync/inventory-open-merge.ts',
  'src/lib/sync/inventory-open-split.ts',
  'src/lib/sync/inventory-quantity-correction.ts',
  'src/lib/sync/inventory-quantity-reversal.ts',
  'src/lib/sync/inventory-quantity.ts',
  'src/lib/sync/mirror-write.ts',
  'src/lib/sync/pull.ts',
  'src/lib/sync/push.ts',
  'src/lib/sync/resolve-inventory-conflict.ts',
  'src/lib/sync/resolve.ts',
  'src/lib/sync/inventory-push.ts',
  'src/features/inventory',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SHINGLE_WIDTH = 5;

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function positiveIntegerOption(name: string, fallback: number): number {
  const value = argument(name);
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} muss eine positive ganze Zahl sein.`);
  }
  return parsed;
}

function thresholdOption(): number {
  const value = argument('threshold');
  if (!value) return 0.78;

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error('--threshold muss zwischen 0 und 1 liegen.');
  }
  return parsed;
}

function parseOptions(): Options {
  const targets = process.argv.slice(2).filter((value) => !value.startsWith('--'));

  return {
    includeSameFile: hasFlag('same-file'),
    includeTests: hasFlag('include-tests'),
    json: hasFlag('json'),
    minLines: positiveIntegerOption('min-lines', 6),
    minTokens: positiveIntegerOption('min-tokens', 30),
    quiet: hasFlag('quiet'),
    threshold: thresholdOption(),
    top: positiveIntegerOption('top', 40),
    targets: targets.length > 0 ? targets : DEFAULT_TARGETS,
  };
}

function printHelp(): void {
  console.log(`Usage: bun scripts/analyze-inventory-duplicates.ts [options] [path ...]

Ohne Pfade werden die Inventory-Sync-Dateien aus dem Refactor sowie
src/features/inventory geprüft. Fehlende, in HEAD vorhandene Dateien werden
als [HEAD] aufgenommen, damit Löschungen gegen den aktuellen Bestand geprüft
werden können.

Optionen:
  --threshold=0.78  Mindestähnlichkeit für Kandidaten (0..1)
  --min-lines=6    Kleinste Funktionsgröße in Zeilen
  --min-tokens=30   Kleinste Funktionsgröße in normalisierten Tokens
  --top=40          Maximale Zahl ähnlicher Paare
  --same-file       Auch Paare innerhalb derselben Datei melden
  --include-tests   Testdateien in Verzeichnispfaden einschließen
  --json            Maschinenlesbaren JSON-Bericht ausgeben
  --quiet           Fortschrittsmeldungen unterdrücken
  --help            Diese Hilfe anzeigen`);
}

function progress(options: Options, message: string): void {
  if (!options.quiet) console.error(`[inventory-duplicates] ${message}`);
}

function isSourceFile(filePath: string, includeTests: boolean): boolean {
  const extension = filePath.slice(filePath.lastIndexOf('.'));
  if (!SOURCE_EXTENSIONS.has(extension)) return false;
  if (includeTests) return true;
  return !/\.test\.[jt]sx?$/.test(filePath) && !/\.integration\.test\.[jt]sx?$/.test(filePath);
}

async function collectFiles(target: string, includeTests: boolean): Promise<string[]> {
  const absoluteTarget = resolve(target);
  const targetStat = await stat(absoluteTarget).catch(() => undefined);
  if (!targetStat) {
    throw new Error(`Datei oder Verzeichnis nicht gefunden: ${target}`);
  }

  if (targetStat.isFile()) {
    if (!isSourceFile(absoluteTarget, includeTests)) return [];
    return [absoluteTarget];
  }

  const entries = await readdir(absoluteTarget, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const childPath = resolve(absoluteTarget, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(childPath, includeTests)));
      continue;
    }
    if (entry.isFile() && isSourceFile(childPath, includeTests)) files.push(childPath);
  }
  return files;
}

function sourceFromHead(target: string): SourceFileInput | undefined {
  const filePath = resolve(target);
  const relativePath = relative(process.cwd(), filePath);
  try {
    const source = execFileSync('git', ['show', `HEAD:${relativePath}`], { encoding: 'utf8' });
    return {
      filePath: `git:HEAD:${relativePath}`,
      relativePath: `${relativePath} [HEAD]`,
      source,
    };
  } catch {
    return undefined;
  }
}

async function collectSourceFiles(
  target: string,
  includeTests: boolean,
): Promise<SourceFileInput[]> {
  const absoluteTarget = resolve(target);
  const targetStat = await stat(absoluteTarget).catch(() => undefined);
  if (!targetStat) {
    const headFile = sourceFromHead(target);
    if (headFile) return [headFile];
    throw new Error(`Datei oder Verzeichnis nicht gefunden, auch nicht in HEAD: ${target}`);
  }

  const filePaths = await collectFiles(target, includeTests);
  return Promise.all(
    filePaths.map(async (filePath) => ({
      filePath,
      relativePath: relative(process.cwd(), filePath),
      source: await readFile(filePath, 'utf8'),
    })),
  );
}

function sourceLine(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function functionName(node: ts.Node): string | undefined {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)) &&
    node.name
  ) {
    return node.name.getText();
  }

  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
    return ts.isIdentifier(parent.name) ? parent.name.text : undefined;
  }

  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    return parent.name.getText();
  }

  if (ts.isPropertyDeclaration(parent) && parent.initializer === node) {
    return parent.name.getText();
  }

  return undefined;
}

function functionKind(node: ts.Node): string {
  if (ts.isArrowFunction(node)) return 'arrow';
  if (ts.isFunctionExpression(node)) return 'expression';
  if (ts.isMethodDeclaration(node)) return 'method';
  if (ts.isGetAccessorDeclaration(node)) return 'getter';
  if (ts.isSetAccessorDeclaration(node)) return 'setter';
  return 'declaration';
}

function isFunctionNode(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  );
}

function normalizedTokens(node: ts.Node, sourceFile: ts.SourceFile): string[] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    sourceFile.fileName.endsWith('.tsx') ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
    sourceFile.text.slice(node.getStart(sourceFile), node.end),
  );
  const tokens: string[] = [];
  let token = scanner.scan();

  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.Identifier) {
      tokens.push('identifier');
    } else if (
      token === ts.SyntaxKind.StringLiteral ||
      token === ts.SyntaxKind.NumericLiteral ||
      token === ts.SyntaxKind.BigIntLiteral ||
      token === ts.SyntaxKind.RegularExpressionLiteral ||
      token === ts.SyntaxKind.NoSubstitutionTemplateLiteral
    ) {
      tokens.push('literal');
    } else {
      tokens.push(ts.tokenToString(token) ?? scanner.getTokenText());
    }
    token = scanner.scan();
  }

  return tokens;
}

function collectCandidates(
  sourceFile: ts.SourceFile,
  filePath: string,
  relativePath: string,
  options: Options,
): FunctionCandidate[] {
  const candidates: FunctionCandidate[] = [];

  function visit(node: ts.Node): void {
    if (isFunctionNode(node)) {
      const name = functionName(node);
      if (name) {
        const startLine = sourceLine(sourceFile, node.getStart(sourceFile));
        const endLine = sourceLine(sourceFile, node.end);
        const tokens = normalizedTokens(node, sourceFile);
        if (endLine - startLine + 1 >= options.minLines && tokens.length >= options.minTokens) {
          candidates.push({
            endLine,
            filePath,
            kind: functionKind(node),
            name,
            normalizedTokens: tokens,
            relativePath,
            startLine,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return candidates;
}

function shingles(tokens: string[]): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index <= tokens.length - SHINGLE_WIDTH; index += 1) {
    result.add(tokens.slice(index, index + SHINGLE_WIDTH).join(' '));
  }
  return result;
}

function similarity(
  left: FunctionCandidate,
  right: FunctionCandidate,
): Omit<SimilarityMatch, 'left' | 'right'> {
  const leftShingles = shingles(left.normalizedTokens);
  const rightShingles = shingles(right.normalizedTokens);
  let intersection = 0;

  for (const shingle of leftShingles) {
    if (rightShingles.has(shingle)) intersection += 1;
  }

  const union = leftShingles.size + rightShingles.size - intersection;
  return {
    score: union === 0 ? 0 : intersection / union,
    sharedShingles: intersection,
  };
}

function isSameFunction(left: FunctionCandidate, right: FunctionCandidate): boolean {
  return (
    left.filePath === right.filePath &&
    left.startLine === right.startLine &&
    left.endLine === right.endLine
  );
}

function compareFunctions(
  candidates: FunctionCandidate[],
  options: Options,
): {
  exactDuplicateGroups: AnalysisReport['exactDuplicateGroups'];
  similarMatches: SimilarityMatch[];
} {
  const exactGroups = new Map<string, FunctionCandidate[]>();
  for (const candidate of candidates) {
    const key = candidate.normalizedTokens.join(' ');
    const group = exactGroups.get(key) ?? [];
    group.push(candidate);
    exactGroups.set(key, group);
  }

  const exactDuplicateGroups = [...exactGroups.values()]
    .filter(
      (group) =>
        group.length > 1 &&
        (options.includeSameFile || new Set(group.map((candidate) => candidate.filePath)).size > 1),
    )
    .map((group) => ({
      functions: group.map((candidate) => ({
        file: candidate.relativePath,
        name: candidate.name,
        range: `${candidate.startLine}-${candidate.endLine}`,
      })),
      normalizedTokenCount: group[0]?.normalizedTokens.length ?? 0,
    }));

  const similarMatches: SimilarityMatch[] = [];
  let comparisons = 0;
  const progressInterval = 10_000;
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    const left = candidates[leftIndex];
    if (!left) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const right = candidates[rightIndex];
      if (!right || isSameFunction(left, right)) continue;
      if (!options.includeSameFile && left.filePath === right.filePath) continue;

      comparisons += 1;
      const match = similarity(left, right);
      if (match.score >= options.threshold) {
        similarMatches.push({ left, right, ...match });
      }
      if (comparisons % progressInterval === 0) {
        progress(options, `${comparisons} Funktionspaare verglichen ...`);
      }
    }
  }

  similarMatches.sort((left, right) => right.score - left.score);
  progress(options, `Funktionsvergleich abgeschlossen: ${comparisons} Paare geprüft.`);
  return {
    exactDuplicateGroups,
    similarMatches: similarMatches.slice(0, options.top),
  };
}

function displayFunction(candidate: FunctionReference): string {
  return `${candidate.file}:${candidate.range} ${candidate.name}`;
}

function functionReference(candidate: FunctionCandidate): FunctionReference {
  return {
    file: candidate.relativePath,
    kind: candidate.kind,
    name: candidate.name,
    range: `${candidate.startLine}-${candidate.endLine}`,
  };
}

function printReport(report: AnalysisReport, options: Options): void {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('Inventory-Duplikatprüfung');
  console.log(`Dateien: ${report.files.length} | benannte Funktionen: ${report.functions}`);
  console.log(
    `Heuristik: mindestens ${options.minLines} Zeilen, ${options.minTokens} Tokens, Ähnlichkeit ab ${options.threshold.toFixed(2)}`,
  );

  console.log(`\nExakte normalisierte Duplikatgruppen: ${report.exactDuplicateGroups.length}`);
  if (report.exactDuplicateGroups.length === 0) {
    console.log('  Keine gefunden.');
  } else {
    for (const [index, group] of report.exactDuplicateGroups.entries()) {
      console.log(`  ${index + 1}. ${group.normalizedTokenCount} normalisierte Tokens`);
      for (const candidate of group.functions) {
        console.log(`     ${candidate.file}:${candidate.range} ${candidate.name}`);
      }
    }
  }

  console.log(`\nÄhnliche Funktionskandidaten: ${report.similarMatches.length}`);
  if (report.similarMatches.length === 0) {
    console.log('  Keine oberhalb des Schwellenwerts gefunden.');
  } else {
    for (const match of report.similarMatches) {
      console.log(
        `  ${(match.score * 100).toFixed(1)}% (${match.sharedShingles} gemeinsame Shingles)`,
      );
      console.log(`     ${displayFunction(match.left)}`);
      console.log(`     ${displayFunction(match.right)}`);
    }
  }

  console.log(
    '\nHinweis: Treffer sind statische Prüfhinweise, keine automatische Löschentscheidung.',
  );
}

async function analyze(options: Options): Promise<AnalysisReport> {
  progress(options, `Sammle Dateien aus ${options.targets.length} Ziel(en) ...`);
  const collectedGroups = await Promise.all(
    options.targets.map(async (target) => {
      progress(options, `Scanne ${target} ...`);
      const files = await collectSourceFiles(target, options.includeTests);
      progress(options, `${target}: ${files.length} Datei(en) gefunden.`);
      return files;
    }),
  );
  const collectedInputs = collectedGroups.flat();
  const uniqueInputs = new Map<string, SourceFileInput>();
  for (const input of collectedInputs) uniqueInputs.set(input.filePath, input);
  const inputs = [...uniqueInputs.values()].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  if (inputs.length === 0) throw new Error('Keine TypeScript-Dateien zum Prüfen gefunden.');

  const candidates: FunctionCandidate[] = [];
  progress(options, `Lese und parse ${inputs.length} Datei(en) ...`);
  for (const [index, input] of inputs.entries()) {
    const sourceFile = ts.createSourceFile(
      input.filePath,
      input.source,
      ts.ScriptTarget.Latest,
      true,
      input.filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    candidates.push(...collectCandidates(sourceFile, input.filePath, input.relativePath, options));
    const processed = index + 1;
    if (processed === 1 || processed % 25 === 0 || processed === inputs.length) {
      progress(options, `${processed}/${inputs.length} Datei(en) analysiert ...`);
    }
  }

  progress(options, `${candidates.length} benannte Funktionen gefunden.`);
  progress(options, `Vergleiche Funktionen bei Schwelle ${options.threshold.toFixed(2)} ...`);
  const comparison = compareFunctions(candidates, options);
  return {
    exactDuplicateGroups: comparison.exactDuplicateGroups,
    files: inputs.map((input) => input.relativePath),
    functions: candidates.length,
    similarMatches: comparison.similarMatches.map((match) => ({
      left: functionReference(match.left),
      score: match.score,
      sharedShingles: match.sharedShingles,
      right: functionReference(match.right),
    })),
  };
}

async function main(): Promise<void> {
  if (hasFlag('help')) {
    printHelp();
    return;
  }

  const options = parseOptions();
  const report = await analyze(options);
  printReport(report, options);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
