#!/usr/bin/env bun

/**
 * build-picker.ts — Interaktiver iOS-Build-Assistent.
 *
 * Erst Typ und Ort in einer Ebene (BUILD_CHOICES), bei lokalem Store-Build
 * danach die Submit-Methode (EAS oder Xcode). Simulator baut immer lokal.
 *
 * Keine Wrapper-Scripte: jeder Schritt ist ein roher Befehl und wird vor dem
 * Ausfuehren angezeigt. Die komplette Ausgabe geht zusaetzlich in eine Logdatei
 * unter logs/, jeder Schritt wird mit Dauer protokolliert.
 *
 * Die reine Logik lebt in scripts/build-picker-logic.ts und wird in
 * test/build-picker.test.ts geprueft.
 *
 * Verwendung:
 *   bun run build:picker
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import {
  type BuildChoice,
  type BuildLocation,
  buildChoiceOptions,
  buildLogPath,
  type CommandStep,
  easLocalBuildEnv,
  easLocalBuildEnvVars,
  findBuildChoice,
  formatDuration,
  parseAvailableIosSimulators,
  parseShowBuildSettings,
  profileFor,
  type SimulatorDevice,
  type StoreType,
  type SubmitMethod,
  simulatorBootStep,
  simulatorInstallStep,
  simulatorLaunchStep,
  simulatorSteps,
  storeSteps,
  submitMethodOptions,
} from './build-picker-logic';

const projectRoot = path.resolve(__dirname, '..');
const SIMULATOR_ENV_FILE = '.env.development.local';
const BUILD_ENV_FILE = '.env.preview';

// Jeder Lauf schreibt seine komplette Ausgabe zusaetzlich in eine Logdatei
// unter logs/ (gitignored). Das Terminal zeigt weiter alles live.
//
// Bewusst synchron: ein fs.WriteStream puffert, und process.exit(1) bei einem
// fehlgeschlagenen Schritt verwirft die noch nicht geschriebenen Zeilen. Genau
// die letzte Fehlermeldung fehlte dadurch im Log. Mit appendFileSync steht der
// Inhalt sofort auf der Platte.
let logFilePath: string | null = null;

function openBuildLog(choiceId: string): string {
  const relativeLogPath = buildLogPath(choiceId);
  const absoluteLogPath = path.join(projectRoot, relativeLogPath);
  fs.mkdirSync(path.dirname(absoluteLogPath), { recursive: true });
  logFilePath = absoluteLogPath;
  fs.writeFileSync(absoluteLogPath, '');
  return relativeLogPath;
}

function log(line = ''): void {
  process.stdout.write(`${line}\n`);
  if (logFilePath) fs.appendFileSync(logFilePath, `${line}\n`);
}

function closeBuildLog(): void {
  logFilePath = null;
}

interface StepResult {
  ok: boolean;
  durationMs: number;
}

// Umgebung fuer den naechsten Build-Befehl. Null bedeutet: Projektverzeichnis
// und geerbte Umgebung. Lokale EAS-Builds brauchen ein eigenes Workingdir
// und eigene TMPDIR, sonst liest eas-cli das lokale ios/ und bricht ab
// (siehe easLocalBuildEnv in build-picker-logic.ts).
let stepEnv: Record<string, string> | undefined;

export async function runStep(step: CommandStep): Promise<StepResult> {
  const commandLine = `$ ${step.command} ${step.args.join(' ')}`;
  p.log.step(commandLine);
  log(`\n${commandLine}`);

  const submitPathIndex = step.args.indexOf('--path');
  if (step.args.includes('submit') && submitPathIndex !== -1) {
    const submitPath = step.args[submitPathIndex + 1];
    if (!submitPath || !fs.existsSync(path.resolve(projectRoot, submitPath))) {
      const reason = `Submit-Datei fehlt: ${submitPath ?? '(kein Pfad angegeben)'}`;
      p.log.error(reason);
      log(reason);
      return { ok: false, durationMs: 0 };
    }
  }

  const startedAt = Date.now();
  const child = spawn(step.command, step.args, {
    cwd: projectRoot,
    env: stepEnv ? { ...process.env, ...stepEnv } : process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  let recentOutput = '';
  const forward = (output: NodeJS.WriteStream, chunk: Buffer): void => {
    output.write(chunk);
    recentOutput = `${recentOutput}${chunk.toString('utf8')}`.slice(-4000);
    if (logFilePath) fs.appendFileSync(logFilePath, chunk);
  };
  child.stdout?.on('data', (chunk: Buffer) => forward(process.stdout, chunk));
  child.stderr?.on('data', (chunk: Buffer) => forward(process.stderr, chunk));

  const result = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    error: Error | null;
  }>((resolve) => {
    let error: Error | null = null;
    child.once('error', (spawnError) => {
      error = spawnError;
      resolve({ code: null, signal: null, error });
    });
    child.once('close', (code, signal) => resolve({ code, signal, error }));
  });
  const durationMs = Date.now() - startedAt;

  const duration = formatDuration(durationMs);
  if (result.error || result.code !== 0 || result.signal) {
    const reason = result.error
      ? `Startfehler: ${result.error.message}`
      : result.signal
        ? `Signal ${result.signal}`
        : `Exit-Code ${result.code ?? 'unbekannt'}`;
    const outputDetail = recentOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-3)
      .join(' | ')
      .slice(-600);
    const detail = outputDetail ? ` — Ursache: ${outputDetail}` : '';
    const message = `Fehlgeschlagen nach ${duration} (${reason})${detail}.`;
    p.log.error(message);
    log(message);
    return { ok: false, durationMs };
  }

  const message = `Fertig in ${duration}.`;
  p.log.success(message);
  log(message);
  return { ok: true, durationMs };
}

function readStdout(step: CommandStep, failureMessage: string): string | null {
  log(`\n$ ${step.command} ${step.args.join(' ')}`);
  const result = spawnSync(step.command, step.args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: stepEnv ? { ...process.env, ...stepEnv } : process.env,
  });
  if (result.stdout) log(result.stdout.replace(/\n$/, ''));
  if (result.stderr) log(result.stderr.replace(/\n$/, ''));
  if (result.status !== 0) {
    p.log.error(failureMessage);
    log(failureMessage);
    return null;
  }
  return result.stdout;
}

function cancelAndExit(): never {
  p.cancel('Abgebrochen.');
  closeBuildLog();
  process.exit(0);
}

// Abbruch nach einem Fehlschlag. Schreibt zuerst die Gesamtdauer und
// schliesst den Log, damit beides auch im Fehlerfall im Log steht.
// process.exit(1) in den aufrufenden Funktionen wuerde den finally-Block
// von main() ueberspringen und genau das fehlt dann im Log.
let runStartedAt = 0;

export function beginRun(): number {
  runStartedAt = Date.now();
  return runStartedAt;
}

export function abortRun(message: string): never {
  const total = formatDuration(Date.now() - runStartedAt);
  log(`Gesamtdauer bis zum Abbruch: ${total}`);
  p.log.info(`Gesamtdauer bis zum Abbruch: ${total}`);
  p.outro(message);
  closeBuildLog();
  process.exit(1);
}

async function chooseSimulator(): Promise<SimulatorDevice> {
  const step: CommandStep = {
    command: 'xcrun',
    args: ['simctl', 'list', 'devices', 'available', '-j'],
  };
  const stdout = readStdout(step, 'Simulatorliste konnte nicht gelesen werden (xcrun simctl).');
  if (stdout === null) process.exit(1);

  const devices = parseAvailableIosSimulators(stdout);
  if (devices.length === 0) {
    p.log.error('Kein verfuegbarer iOS-Simulator gefunden.');
    process.exit(1);
  }

  const selected = await p.select<string>({
    message: 'Auf welchem Simulator installieren?',
    options: devices.map((device) => ({
      value: device.udid,
      label: `${device.name} (${device.runtime}, ${device.state})`,
    })),
  });
  if (p.isCancel(selected)) cancelAndExit();

  const device = devices.find((entry) => entry.udid === selected);
  if (!device) {
    p.log.error('Unbekannter Simulator.');
    process.exit(1);
  }
  return device;
}

async function runSimulator(choice: BuildChoice): Promise<number> {
  const installAfterBuild = choice.simulatorMode === 'install';
  const device = installAfterBuild ? await chooseSimulator() : null;
  const plan = simulatorSteps({
    mode: choice.simulatorMode ?? 'build-only',
    envFile: SIMULATOR_ENV_FILE,
    udid: device?.udid,
    cacheName: 'simulator',
  });

  for (const step of plan.build) {
    if (!(await runStep(step)).ok) {
      abortRun('Build fehlgeschlagen.');
    }
  }

  const settingsStdout = readStdout(
    plan.showSettings,
    'Build-Einstellungen konnten nicht gelesen werden.',
  );
  if (settingsStdout === null) abortRun('App-Pfad konnte nicht ermittelt werden.');

  let appPath: string;
  try {
    appPath = parseShowBuildSettings(settingsStdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(message);
    log(message);
    abortRun('App-Pfad konnte nicht ermittelt werden.');
  }

  // Ohne Installation ist der Speicherort die Ausgabe.
  p.log.success(`App liegt hier: ${appPath}`);
  log(`App liegt hier: ${appPath}`);

  if (!installAfterBuild || !device) {
    p.outro('Simulator-Build fertig (ohne Installation).');
    return 0;
  }

  // Ein Shutdown-Simulator kann keine App installieren, deshalb zuerst booten.
  const installSteps = [
    simulatorBootStep(device.udid),
    simulatorInstallStep(device.udid, appPath),
    simulatorLaunchStep(device.udid),
  ];
  for (const step of installSteps) {
    if (!(await runStep(step)).ok) {
      abortRun('Installation oder Start fehlgeschlagen.');
    }
  }

  p.outro(`Fertig: installiert und gestartet auf ${device.name}.`);
  return 0;
}

async function runStore(choice: BuildChoice): Promise<number> {
  const type = choice.type as StoreType;
  const location = choice.location as BuildLocation;

  let submit: SubmitMethod = 'eas';
  const methods = submitMethodOptions(location);
  if (methods.length > 1) {
    const answer = await p.select<string>({
      message: 'Wie hochladen?',
      options: methods.map((method) => ({
        value: method.id,
        label: method.label,
        hint: method.hint,
      })),
    });
    if (p.isCancel(answer)) cancelAndExit();
    submit = answer as SubmitMethod;
  }

  const cacheName = type === 'testflight' ? 'testflight' : 'app-store';

  // Lokale EAS-Builds brauchen ein Workingdir ausserhalb des Projekts und ein
  // eigenes TMPDIR. Sonst liest eas-cli das lokale ios/ mit den
  // CocoaPods-Dependencies und bricht im Signierpfad ab. Der Weg ist derselbe
  // wie in scripts/eas-ios-build.sh.
  if (location === 'local' && submit === 'eas') {
    const profile = profileFor(type, location);
    const runId = Date.now().toString(36);
    const localEnv = easLocalBuildEnv(profile, runId);
    fs.mkdirSync(localEnv.tmpDir, { recursive: true });
    stepEnv = easLocalBuildEnvVars(localEnv);
    p.log.info(`Workingdir: ${localEnv.workingDir}`);
    log(`Workingdir: ${localEnv.workingDir}`);
  }

  const steps = storeSteps({
    type,
    location,
    submit,
    envFile: BUILD_ENV_FILE,
    archivePath: `build/cache/ios/${cacheName}/fam.xcarchive`,
    exportPath: `build/cache/ios/${cacheName}/export`,
  });

  if (steps.length === 0) {
    p.log.error('Diese Kombination ist nicht moeglich.');
    return 1;
  }

  for (const step of steps) {
    if (!(await runStep(step)).ok) {
      abortRun('Abgebrochen. Die Logdatei enthaelt die vollstaendige Ausgabe.');
    }
  }

  p.outro(`Fertig: ${choice.label} gebaut und hochgeladen (${submit}).`);
  return 0;
}

async function main(): Promise<void> {
  p.intro('fam iOS Build Picker');

  const selected = await p.select<string>({
    message: 'Was soll gebaut werden?',
    options: buildChoiceOptions(),
  });
  if (p.isCancel(selected)) cancelAndExit();

  const choice = findBuildChoice(selected);
  if (!choice) {
    p.log.error('Unbekannte Auswahl.');
    process.exit(1);
  }

  const relativeLogPath = openBuildLog(choice.id);
  log(`fam iOS Build Picker — ${choice.label}`);
  log(`Log: ${relativeLogPath}`);
  p.log.info(`Log: ${relativeLogPath}`);

  const startedAt = beginRun();
  try {
    if (choice.type === 'simulator') {
      await runSimulator(choice);
    } else {
      await runStore(choice);
    }
    const total = formatDuration(Date.now() - startedAt);
    log(`Gesamtdauer: ${total}`);
    p.log.info(`Gesamtdauer: ${total}`);
  } finally {
    closeBuildLog();
  }
}

if (process.argv[1]?.endsWith('scripts/build-picker.ts')) {
  await main();
}
