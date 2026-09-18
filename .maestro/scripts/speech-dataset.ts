#!/usr/bin/env bun

import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runMaestro } from './lib/run-maestro';
import {
  DEFAULT_SPEECH_RESULTS_DIRECTORY,
  discoverSpeechAudioFiles,
  parseSpeechDatasetArgs,
} from './speech-dataset-plan';

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
type QualityCaptureStatus = 'completed' | 'failed';

type QualityCaptureContext = {
  runId: string;
  runDirectory: string;
  cacheFilePath: string;
  aggregateFilePath: string;
  manifestFilePath: string;
  previousFilePath: string;
  device: string;
  capturedLineCount: number;
  captures: Array<{
    audio: string;
    line: number;
    capturedAt: string;
  }>;
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

async function prepareQualityCapture(
  device: string,
  resultsDirectory: string,
): Promise<QualityCaptureContext> {
  // Die Dateioperationen werden abgewartet, damit der alte Cache sicher
  // gesichert und geleert ist, bevor der erste Testfall startet.
  const dataContainer = simulatorDataContainer(device);
  const cacheFilePath = path.join(
    dataContainer,
    'Library',
    'Caches',
    QUALITY_TEST_RESULTS_FILE_NAME,
  );
  const runId = createRunId();
  const resultsRoot = path.resolve(repositoryRoot, resultsDirectory);
  const runDirectory = path.join(resultsRoot, runId);
  const capturesDirectory = path.join(runDirectory, 'captures');
  const aggregateFilePath = path.join(runDirectory, QUALITY_TEST_RESULTS_FILE_NAME);
  const manifestFilePath = path.join(runDirectory, 'manifest.json');
  const previousFilePath = path.join(runDirectory, 'quality-before.jsonl');

  await mkdir(resultsRoot, { recursive: true });
  await mkdir(runDirectory, { recursive: false });
  await mkdir(capturesDirectory, { recursive: false });
  const previousContent = await readTextOrEmpty(cacheFilePath);
  await writeFile(previousFilePath, previousContent, 'utf8');
  await writeFile(cacheFilePath, '', 'utf8');

  return {
    runId,
    runDirectory,
    cacheFilePath,
    aggregateFilePath,
    manifestFilePath,
    previousFilePath,
    device,
    capturedLineCount: 0,
    captures: [],
  };
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

  const line = newLines[0];
  if (!line) throw new Error(`Leere Qualitätszeile für ${path.basename(audioPath)}`);
  let parsed: { captureKind?: unknown };
  try {
    parsed = JSON.parse(line) as { captureKind?: unknown };
  } catch {
    throw new Error(`Qualitätszeile für ${path.basename(audioPath)} ist kein JSON`);
  }
  if (parsed.captureKind !== 'maestro-preview-test') {
    throw new Error(`Qualitätszeile für ${path.basename(audioPath)} hat den falschen captureKind`);
  }

  const captureName = `${String(index).padStart(2, '0')}-${path.basename(audioPath, path.extname(audioPath))}.jsonl`;
  await writeFile(path.join(context.runDirectory, 'captures', captureName), `${line}\n`, 'utf8');
  context.capturedLineCount += 1;
  context.captures.push({
    audio: path.relative(repositoryRoot, audioPath),
    line: context.capturedLineCount,
    capturedAt: new Date().toISOString(),
  });
}

async function finalizeQualityCapture(
  context: QualityCaptureContext,
  status: QualityCaptureStatus,
): Promise<void> {
  const content = await readTextOrEmpty(context.cacheFilePath);
  await copyFile(context.cacheFilePath, context.aggregateFilePath).catch(async (error) => {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    await writeFile(context.aggregateFilePath, content, 'utf8');
  });
  await writeFile(
    context.manifestFilePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        status,
        runId: context.runId,
        device: context.device,
        qualityFile: QUALITY_TEST_RESULTS_FILE_NAME,
        previousQualityFile: path.basename(context.previousFilePath),
        capturedCount: context.captures.length,
        captures: context.captures,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
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

  if (options.dryRun) {
    audioFiles.forEach((audioPath, index) => {
      console.log(`[${index + 1}/${audioFiles.length}] ${path.relative(repositoryRoot, audioPath)}`);
    });
    return;
  }

  const qualityCapture = await prepareQualityCapture(options.device, options.resultsDirectory);
  let status: QualityCaptureStatus = 'failed';
  try {
    // Bewusst sequenziell: Kein Audiofall darf beginnen, bevor der vorherige
    // Finish-Flow und dessen Qualitäts-Snapshot abgeschlossen sind.
    for (const [index, audioPath] of audioFiles.entries()) {
      await runAudioCase(audioPath, index + 1, audioFiles.length, options, qualityCapture);
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
