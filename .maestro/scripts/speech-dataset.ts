#!/usr/bin/env bun

import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runMaestro } from './lib/run-maestro';
import {
  DEFAULT_SPEECH_RESULTS_DIRECTORY,
  discoverSpeechAudioFiles,
  findResumeStartIndex,
  parseSpeechDatasetArgs,
  type SpeechDatasetCapture,
  validateSpeechDatasetQualityLine,
} from './speech-dataset-plan';
import {
  isSpeechExperimentVariant,
  type ExperimentVariant,
} from '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-experiment';
import { parseQualitySnapshotInput } from '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-cohort-report';

const repositoryRoot = path.resolve(import.meta.dir, '../..');
const BUNDLE_ID = 'com.goldjunge91.fam1';
const QUALITY_TEST_RESULTS_FILE_NAME = 'fam-natural-language-addition-quality.jsonl';
const maestroConfig = path.join(repositoryRoot, '.maestro/ios/config.yaml');
const openFlow = path.join(
  repositoryRoot,
  '.maestro/ios/flows/speech/speech-dataset-open.yaml',
);
const finishFlow = path.join(
  repositoryRoot,
  '.maestro/ios/flows/speech/speech-dataset-finish.yaml',
);
const cleanupFlow = path.join(
  repositoryRoot,
  '.maestro/ios/flows/speech/speech-dataset-cleanup.yaml',
);
type QualityCaptureStatus = 'running' | 'completed' | 'failed';

type QualityCaptureManifest = {
  schemaVersion: number;
  status: QualityCaptureStatus;
  runId: string;
  device: string;
  qualityFile: string;
  previousQualityFile: string;
  experimentVariant: ExperimentVariant;
  fixtureSetVersion?: string | null;
  plannedAudioFiles?: string[];
  nextAudioIndex: number;
  lastCompletedAudio: string | null;
  capturedCount: number;
  captures: SpeechDatasetCapture[];
};

type QualityCaptureContext = {
  runId: string;
  runDirectory: string;
  cacheFilePath: string;
  aggregateFilePath: string;
  manifestFilePath: string;
  previousFilePath: string;
  device: string;
  experimentVariant: ExperimentVariant;
  fixtureSetVersion: string | null;
  plannedAudioFiles: string[];
  capturedLineCount: number;
  captures: SpeechDatasetCapture[];
  qualityLines: string[];
};

const USAGE = `
Speech-to-text Datensätze über BlackHole und Maestro ausführen

Usage:
  bun .maestro/scripts/speech-dataset.ts [dataset ...] [options]

Ohne dataset-Argumente wird der versionierte 20-Sätze-Datensatz verwendet.
Die macOS-Ausgabe muss vor dem Start auf BlackHole geroutet sein.

Options:
  --dataset <dir>             Dataset wiederholt angeben
  --formats <wav|mp3|both>    Audioformat wählen (default: wav)
  --device <udid>             iOS-Simulator (default: ${process.env.MAESTRO_DEVICE ?? '4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D'})
  --audio-player <command>    Player (default: /usr/bin/afplay)
  --limit <number>             Nur die ersten Dateien ausführen
  --audio-start-delay-ms <ms>  Wartezeit nach dem Öffnen der Sprachsession
  --audio-finish-delay-ms <ms> Wartezeit nach dem Audioende
  --results-dir <dir>         Ergebniswurzel (default: ${DEFAULT_SPEECH_RESULTS_DIRECTORY})
  --variant <name>            baseline oder contextual-strings (default: baseline)
  --resume-latest              Letzten unvollständigen Lauf fortsetzen
  --dry-run                    Nur die Ausführungsreihenfolge ausgeben
  -h, --help                  Hilfe anzeigen
`;

// Host-seitige Pause. Diese wartet nicht auf UI-Zustände, sondern gibt der
// iOS-Spracherkennung nach dem Öffnen bzw. nach dem Audioende Zeit zu starten
// oder das letzte erkannte Signal zu übernehmen.
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Maestro wird synchron ausgeführt: Der Runner geht erst weiter, wenn der
// komplette Flow inklusive seiner YAML-Waits beendet ist.
function runFlow(flowPath: string, device: string): number {
  return runMaestro([
    'test',
    '--config',
    maestroConfig,
    '--device',
    device,
    flowPath,
  ]);
}

function createRunId(now = new Date()): string {
  return `run-${now.toISOString().replaceAll(':', '-').replaceAll('.', '-')}`;
}

async function readTextOrEmpty(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return '';
    throw error;
  }
}

function nonEmptyLines(content: string): string[] {
  return content.split(/\r?\n/u).filter((line) => line.trim().length > 0);
}

function captureFileName(index: number, audioPath: string): string {
  return `${String(index).padStart(2, '0')}-${path.basename(audioPath, path.extname(audioPath))}.jsonl`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isQualityCaptureStatus(value: unknown): value is QualityCaptureStatus {
  return value === 'running' || value === 'completed' || value === 'failed';
}

function parseManifestCaptures(value: unknown, manifestPath: string): SpeechDatasetCapture[] {
  if (!Array.isArray(value)) {
    throw new Error(`Resume-Manifest enthält keine Capture-Liste: ${manifestPath}`);
  }

  return value.map((capture, index) => {
    if (!isRecord(capture)) {
      throw new Error(`Resume-Manifest enthält eine ungültige Capture bei Index ${index}.`);
    }
    const { audio, line, capturedAt } = capture;
    if (
      typeof audio !== 'string' ||
      !Number.isInteger(line) ||
      line < 1 ||
      typeof capturedAt !== 'string'
    ) {
      throw new Error(`Resume-Manifest enthält eine ungültige Capture bei Index ${index}.`);
    }
    return { audio, line, capturedAt };
  });
}

async function readQualityCaptureManifest(
  manifestPath: string,
): Promise<QualityCaptureManifest | null> {
  const content = await readTextOrEmpty(manifestPath);
  if (!content.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error(`Resume-Manifest ist kein gültiges JSON: ${manifestPath}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`Resume-Manifest hat ein ungültiges Format: ${manifestPath}`);
  }

  const {
    schemaVersion,
    status,
    runId,
    device,
    qualityFile,
    previousQualityFile,
    experimentVariant,
    fixtureSetVersion,
    plannedAudioFiles,
    nextAudioIndex,
    lastCompletedAudio,
    capturedCount,
    captures,
  } = parsed;
  const parsedCaptures = parseManifestCaptures(captures, manifestPath);
  const normalizedNextAudioIndex = nextAudioIndex ?? parsedCaptures.length;
  const normalizedLastCompletedAudio =
    lastCompletedAudio ?? parsedCaptures.at(-1)?.audio ?? null;
  const normalizedCapturedCount = capturedCount ?? parsedCaptures.length;
  const normalizedExperimentVariant = experimentVariant ?? 'baseline';
  const normalizedFixtureSetVersion = fixtureSetVersion ?? null;
  if (
    !Number.isInteger(schemaVersion) ||
    !isQualityCaptureStatus(status) ||
    typeof runId !== 'string' ||
    typeof device !== 'string' ||
    typeof qualityFile !== 'string' ||
    typeof previousQualityFile !== 'string' ||
    !isSpeechExperimentVariant(normalizedExperimentVariant) ||
    (fixtureSetVersion !== undefined &&
      fixtureSetVersion !== null &&
      typeof fixtureSetVersion !== 'string') ||
    (nextAudioIndex !== undefined &&
      (!Number.isInteger(nextAudioIndex) || nextAudioIndex < 0)) ||
    (lastCompletedAudio !== undefined &&
      lastCompletedAudio !== null &&
      typeof lastCompletedAudio !== 'string') ||
    (capturedCount !== undefined &&
      (!Number.isInteger(capturedCount) || capturedCount < 0))
  ) {
    throw new Error(`Resume-Manifest hat ein ungültiges Format: ${manifestPath}`);
  }
  if (
    plannedAudioFiles !== undefined &&
    (!Array.isArray(plannedAudioFiles) ||
      plannedAudioFiles.some((audioPath) => typeof audioPath !== 'string'))
  ) {
    throw new Error(`Resume-Manifest enthält ungültige geplante Audiodateien: ${manifestPath}`);
  }

  if (
    normalizedCapturedCount !== parsedCaptures.length ||
    normalizedNextAudioIndex !== parsedCaptures.length
  ) {
    throw new Error(`Resume-Manifest enthält widersprüchliche Zähler: ${manifestPath}`);
  }

  return {
    schemaVersion,
    status,
    runId,
    device,
    qualityFile,
    previousQualityFile,
    experimentVariant: normalizedExperimentVariant,
    fixtureSetVersion: normalizedFixtureSetVersion,
    ...(plannedAudioFiles === undefined ? {} : { plannedAudioFiles }),
    nextAudioIndex: normalizedNextAudioIndex,
    lastCompletedAudio: normalizedLastCompletedAudio,
    capturedCount: normalizedCapturedCount,
    captures: parsedCaptures,
  };
}

function sameAudioPlan(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((audioPath, index) => audioPath === right[index]);
}

async function findLatestResumableRun(
  resultsRoot: string,
  device: string,
  plannedAudioFiles: readonly string[],
  experimentVariant: ExperimentVariant,
): Promise<{ manifest: QualityCaptureManifest; runDirectory: string }> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(resultsRoot, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Kein unvollständiger Datensatzlauf in ${resultsRoot} gefunden.`);
    }
    throw error;
  }

  const runDirectories = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('run-'))
    .sort((left, right) => right.name.localeCompare(left.name));
  for (const entry of runDirectories) {
    const runDirectory = path.join(resultsRoot, entry.name);
    const manifestPath = path.join(runDirectory, 'manifest.json');
    const manifest = await readQualityCaptureManifest(manifestPath);
    if (
      !manifest ||
      manifest.status === 'completed' ||
      manifest.device !== device ||
      manifest.experimentVariant !== experimentVariant
    )
      continue;
    if (
      manifest.plannedAudioFiles &&
      !sameAudioPlan(manifest.plannedAudioFiles, plannedAudioFiles)
    ) {
      continue;
    }
    return { manifest, runDirectory };
  }

  throw new Error(`Kein passender unvollständiger Datensatzlauf in ${resultsRoot} gefunden.`);
}

async function readCaptureLines(
  runDirectory: string,
  captures: readonly SpeechDatasetCapture[],
  experimentVariant: ExperimentVariant,
): Promise<string[]> {
  return Promise.all(
    captures.map(async (capture) => {
      const capturePath = path.join(
        runDirectory,
        'captures',
        captureFileName(capture.line, capture.audio),
      );
      return validateSpeechDatasetQualityLine(
        await readFile(capturePath, 'utf8'),
        capture.audio,
        experimentVariant,
      );
    }),
  );
}

function fixtureSetVersionFromQualityLines(qualityLines: readonly string[]): string | null {
  let fixtureSetVersion: string | null | undefined;

  for (const [index, line] of qualityLines.entries()) {
    const snapshot = parseQualitySnapshotInput(line)[0];
    if (!snapshot) {
      throw new Error(`Capture ${index + 1} enthält keinen Qualitäts-Snapshot.`);
    }
    if (fixtureSetVersion === undefined) {
      fixtureSetVersion = snapshot.fixtureSetVersion;
      continue;
    }
    if (snapshot.fixtureSetVersion !== fixtureSetVersion) {
      throw new Error(
        `Resume-Captures mischen unterschiedliche Fixture-Set-Versionen (Capture ${index + 1}).`,
      );
    }
  }

  return fixtureSetVersion ?? null;
}

function simulatorDataContainer(device: string): string {
  // simctl wird synchron aufgerufen. Hier gibt es keinen eigenen Timeout; ein
  // Fehler des Simulator-Dienstes beendet die Vorbereitung des Laufs.
  try {
    return execFileSync(
      'xcrun',
      ['simctl', 'get_app_container', device, BUNDLE_ID, 'data'],
      { encoding: 'utf8' },
    ).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Simulator-Container konnte nicht gelesen werden: ${message}`);
  }
}

function manifestForContext(
  context: QualityCaptureContext,
  status: QualityCaptureStatus,
): QualityCaptureManifest {
  const lastCapture = context.captures.at(-1);
  return {
    schemaVersion: 4,
    status,
    runId: context.runId,
    device: context.device,
    qualityFile: path.basename(context.aggregateFilePath),
    previousQualityFile: path.basename(context.previousFilePath),
    experimentVariant: context.experimentVariant,
    fixtureSetVersion: context.fixtureSetVersion,
    plannedAudioFiles: context.plannedAudioFiles,
    nextAudioIndex: context.captures.length,
    lastCompletedAudio: lastCapture?.audio ?? null,
    capturedCount: context.captures.length,
    captures: context.captures,
  };
}

async function writeQualityCaptureManifest(
  context: QualityCaptureContext,
  status: QualityCaptureStatus,
): Promise<void> {
  const temporaryManifestPath = `${context.manifestFilePath}.tmp`;
  await writeFile(
    temporaryManifestPath,
    `${JSON.stringify(manifestForContext(context, status), null, 2)}\n`,
    'utf8',
  );
  await rename(temporaryManifestPath, context.manifestFilePath);
}

async function prepareQualityCapture(
  device: string,
  resultsDirectory: string,
  audioFiles: readonly string[],
  resumeLatest: boolean,
  experimentVariant: ExperimentVariant,
): Promise<QualityCaptureContext> {
  // Die Dateioperationen werden abgewartet, damit der Cache sicher vorbereitet
  // ist, bevor der erste Testfall startet.
  const dataContainer = simulatorDataContainer(device);
  const cacheFilePath = path.join(
    dataContainer,
    'Library',
    'Caches',
    QUALITY_TEST_RESULTS_FILE_NAME,
  );
  const resultsRoot = path.resolve(repositoryRoot, resultsDirectory);
  const plannedAudioFiles = audioFiles.map((audioPath) => path.relative(repositoryRoot, audioPath));

  await mkdir(resultsRoot, { recursive: true });
  if (resumeLatest) {
    const { manifest, runDirectory } = await findLatestResumableRun(
      resultsRoot,
      device,
      plannedAudioFiles,
      experimentVariant,
    );
    const capturesDirectory = path.join(runDirectory, 'captures');
    await mkdir(capturesDirectory, { recursive: false }).catch((error) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    });
    const qualityLines = await readCaptureLines(
      runDirectory,
      manifest.captures,
      manifest.experimentVariant,
    );
    const startIndex = findResumeStartIndex(audioFiles, manifest.captures, repositoryRoot);
    if (startIndex !== qualityLines.length) {
      throw new Error('Resume-Manifest und gespeicherte Capture-Zeilen sind inkonsistent.');
    }
    const capturedFixtureSetVersion = fixtureSetVersionFromQualityLines(qualityLines);
    if (
      manifest.fixtureSetVersion !== undefined &&
      manifest.fixtureSetVersion !== capturedFixtureSetVersion
    ) {
      throw new Error('Resume-Manifest und Capture-Zeilen haben unterschiedliche Fixture-Set-Versionen.');
    }

    const aggregateFilePath = path.join(
      runDirectory,
      path.basename(manifest.qualityFile || QUALITY_TEST_RESULTS_FILE_NAME),
    );
    const previousFilePath = path.join(
      runDirectory,
      path.basename(manifest.previousQualityFile || 'quality-before.jsonl'),
    );
    if (!existsSync(previousFilePath)) await writeFile(previousFilePath, '', 'utf8');
    await writeFile(cacheFilePath, qualityLines.length > 0 ? `${qualityLines.join('\n')}\n` : '', 'utf8');

    return {
      runId: manifest.runId,
      runDirectory,
      cacheFilePath,
      aggregateFilePath,
      manifestFilePath: path.join(runDirectory, 'manifest.json'),
      previousFilePath,
      device,
      experimentVariant: manifest.experimentVariant,
      fixtureSetVersion: capturedFixtureSetVersion,
      plannedAudioFiles,
      capturedLineCount: startIndex,
      captures: manifest.captures,
      qualityLines,
    };
  }

  const runId = createRunId();
  const runDirectory = path.join(resultsRoot, runId);
  const capturesDirectory = path.join(runDirectory, 'captures');
  const aggregateFilePath = path.join(runDirectory, QUALITY_TEST_RESULTS_FILE_NAME);
  const manifestFilePath = path.join(runDirectory, 'manifest.json');
  const previousFilePath = path.join(runDirectory, 'quality-before.jsonl');

  await mkdir(runDirectory, { recursive: false });
  await mkdir(capturesDirectory, { recursive: false });
  const previousContent = await readTextOrEmpty(cacheFilePath);
  await writeFile(previousFilePath, previousContent, 'utf8');
  await writeFile(cacheFilePath, '', 'utf8');

  const context: QualityCaptureContext = {
    runId,
    runDirectory,
    cacheFilePath,
    aggregateFilePath,
    manifestFilePath,
    previousFilePath,
    device,
    experimentVariant,
    fixtureSetVersion: null,
    plannedAudioFiles,
    capturedLineCount: 0,
    captures: [],
    qualityLines: [],
  };
  await writeQualityCaptureManifest(context, 'running');
  return context;
}

async function captureQualityLine(
  context: QualityCaptureContext,
  audioPath: string,
  index: number,
): Promise<void> {
  const content = await readTextOrEmpty(context.cacheFilePath);
  const lines = nonEmptyLines(content);
  const newLines = lines.slice(context.capturedLineCount);
  if (newLines.length !== 1) {
    throw new Error(
      `Erwartete genau eine neue Qualitätszeile für ${path.basename(audioPath)}, erhalten: ${newLines.length}`,
    );
  }

  const line = validateSpeechDatasetQualityLine(
    newLines.join('\n'),
    path.basename(audioPath),
    context.experimentVariant,
  );
  const snapshot = parseQualitySnapshotInput(line)[0];
  if (!snapshot) {
    throw new Error(`Qualitätszeile für ${path.basename(audioPath)} enthält keinen Snapshot.`);
  }
  if (context.capturedLineCount === 0) {
    context.fixtureSetVersion = snapshot.fixtureSetVersion;
  } else if (context.fixtureSetVersion !== snapshot.fixtureSetVersion) {
    throw new Error(
      `Qualitätszeile für ${path.basename(audioPath)} mischt eine andere Fixture-Set-Version.`,
    );
  }

  if (index !== context.capturedLineCount + 1) {
    throw new Error(
      `Qualitätszeile für ${path.basename(audioPath)} hat den unerwarteten Datensatzindex ${index}.`,
    );
  }
  const captureName = captureFileName(index, audioPath);
  await writeFile(path.join(context.runDirectory, 'captures', captureName), `${line}\n`, 'utf8');
  context.capturedLineCount += 1;
  context.qualityLines.push(line);
  context.captures.push({
    audio: path.relative(repositoryRoot, audioPath),
    line: index,
    capturedAt: new Date().toISOString(),
  });
  await writeQualityCaptureManifest(context, 'running');
}

async function finalizeQualityCapture(
  context: QualityCaptureContext,
  status: QualityCaptureStatus,
): Promise<void> {
  const content = context.qualityLines.length > 0 ? `${context.qualityLines.join('\n')}\n` : '';
  await writeFile(context.aggregateFilePath, content, 'utf8');
  await writeQualityCaptureManifest(context, status);
}

function playAudio(audioPath: string, player: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const relativeAudioPath = path.relative(repositoryRoot, audioPath);
    const startedAt = Date.now();
    let spawned = false;
    // spawn startet den Host-Audioplayer. Die Promise bleibt bis zum close-
    // Event offen, also bis afplay die Datei vollständig abgespielt hat oder
    // mit einem Fehler/Signal endet.
    const child = spawn(player, [audioPath], {
      cwd: repositoryRoot,
      stdio: 'inherit',
    });

    child.once('spawn', () => {
      spawned = true;
      console.log(`Audio gestartet: ${relativeAudioPath} über ${player}`);
    });
    child.once('error', (error) => {
      reject(new Error(`Audio konnte nicht gestartet werden: ${error.message}`));
    });
    child.once('close', (code, signal) => {
      const durationMs = Date.now() - startedAt;
      const result = signal ? `Signal ${signal}` : `Exit ${code ?? 1}`;
      console.log(
        `Audio ${spawned ? 'beendet' : 'nicht gestartet'}: ${relativeAudioPath} | ${result} | ${durationMs} ms`,
      );
      resolve(code ?? 1);
    });
  });
}

async function runAudioCase(
  audioPath: string,
  index: number,
  total: number,
  options: ReturnType<typeof parseSpeechDatasetArgs>,
  qualityCapture: QualityCaptureContext,
): Promise<void> {
  const relativeAudioPath = path.relative(repositoryRoot, audioPath);
  console.log(`\n[${index}/${total}] ${relativeAudioPath}`);

  // Der Open-Flow wartet auf die sichtbare Sprachaufnahme und endet erst dann.
  const openStatus = runFlow(openFlow, options.device);
  if (openStatus !== 0) throw new Error(`Sprachsession konnte nicht geöffnet werden (Exit ${openStatus}).`);

  // Feste Host-Pause nach dem erfolgreichen Open-Flow; kein Maestro-Timeout.
  console.log(`Wartezeit vor Audio: ${options.audioStartDelayMs} ms`);
  await delay(options.audioStartDelayMs);

  // await wartet auf das tatsächliche Ende des Audio-Prozesses, nicht nur auf
  // dessen Start. Erst danach darf die Aufnahme beendet werden.
  const audioStatus = await playAudio(audioPath, options.audioPlayer);
  if (audioStatus !== 0) throw new Error(`Audio-Player beendet sich mit Exit ${audioStatus}.`);

  // Kurzer Nachlauf, damit das letzte erkannte Sprachsignal verarbeitet wird.
  console.log(`Wartezeit nach Audio: ${options.audioFinishDelayMs} ms`);
  await delay(options.audioFinishDelayMs);

  // Der Finish-Flow wartet auf Preview, Modal-Ausfahren, Snapshot-Speicherung
  // und das anschließende Schließen. Der nächste Fall startet erst danach.
  const finishStatus = runFlow(finishFlow, options.device);
  if (finishStatus !== 0) throw new Error(`Sprachsession konnte nicht abgeschlossen werden (Exit ${finishStatus}).`);

  // Der Cache wird erst nach dem erfolgreichen Finish-Flow gelesen; erwartet
  // wird genau eine neue JSONL-Zeile für diesen Audiofall.
  await captureQualityLine(qualityCapture, audioPath, index);
}

async function run(): Promise<void> {
  const options = parseSpeechDatasetArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE.trim());
    return;
  }

  if (options.audioPlayer.startsWith('/') && !existsSync(options.audioPlayer)) {
    throw new Error(`Audio-Player nicht gefunden: ${options.audioPlayer}`);
  }

  const discoveredFiles = await discoverSpeechAudioFiles(options.datasetPaths, options.formats);
  const audioFiles = options.limit ? discoveredFiles.slice(0, options.limit) : discoveredFiles;
  if (audioFiles.length === 0) {
    throw new Error(
      `Keine Audiodateien gefunden. Geprüfte Datensätze: ${options.datasetPaths.join(', ')}`,
    );
  }

  console.log(`Gefunden: ${audioFiles.length} Audiodatei(en)`);
  console.log(`Gerät: ${options.device}`);
  console.log(`Player: ${options.audioPlayer}`);
  console.log(`Variante: ${options.experimentVariant}`);
  console.log(`Modus: ${options.resumeLatest ? 'letzten unvollständigen Lauf fortsetzen' : 'neuer Lauf'}`);

  if (options.dryRun) {
    audioFiles.forEach((audioPath, index) => {
      console.log(`[${index + 1}/${audioFiles.length}] ${path.relative(repositoryRoot, audioPath)}`);
    });
    return;
  }

  const qualityCapture = await prepareQualityCapture(
    options.device,
    options.resultsDirectory,
    audioFiles,
    options.resumeLatest,
    options.experimentVariant,
  );
  let status: QualityCaptureStatus = 'failed';
  try {
    // Bewusst sequenziell: Kein Audiofall darf beginnen, bevor der vorherige
    // Finish-Flow und dessen Qualitäts-Snapshot abgeschlossen sind.
    const resumeStartIndex = qualityCapture.captures.length;
    if (resumeStartIndex > 0) {
      console.log(
        `Resume: ${resumeStartIndex}/${audioFiles.length} Capture(s) bereits erfolgreich gesichert.`,
      );
    }
    for (const [offset, audioPath] of audioFiles.slice(resumeStartIndex).entries()) {
      const index = resumeStartIndex + offset + 1;
      await runAudioCase(audioPath, index, audioFiles.length, options, qualityCapture);
    }

    if (qualityCapture.capturedLineCount !== audioFiles.length) {
      throw new Error(
        `Qualitätszeilen unvollständig: ${qualityCapture.capturedLineCount}/${audioFiles.length}`,
      );
    }
    status = 'completed';
    console.log(`\nDatensatzlauf erfolgreich abgeschlossen: ${qualityCapture.runDirectory}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Datensatz fehlgeschlagen: ${message}`);
    console.error('Versuche, die aktuelle Sprachansicht zu schließen.');
    runFlow(cleanupFlow, options.device);
    throw error;
  } finally {
    try {
      await finalizeQualityCapture(qualityCapture, status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Qualitätsdatei konnte nicht finalisiert werden: ${message}`);
      if (status === 'completed') throw error;
    }
  }
}

if (import.meta.main) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
