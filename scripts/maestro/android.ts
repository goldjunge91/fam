#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { runMaestro } from './lib/run-maestro';

function findAdb(): string | null {
  const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const sdkRoot = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  const pathCandidates = (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .map((directory) => join(directory, executable));
  const candidates = [
    process.env.ADB_BIN,
    sdkRoot ? join(sdkRoot, 'platform-tools', executable) : null,
    ...pathCandidates,
  ];

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

function findConnectedAndroidDevice(): string | null {
  const adb = findAdb();
  if (!adb) {
    console.error(
      'ADB wurde nicht gefunden. Setze ANDROID_HOME, ANDROID_SDK_ROOT oder ADB_BIN.',
    );
    return null;
  }

  const result = spawnSync(adb, ['devices'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error(`ADB konnte Geräte nicht auflisten: ${result.error?.message ?? result.stderr}`);
    return null;
  }

  return (
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.match(/^(\S+)\s+device(?:\s|$)/)?.[1])
      .find((device): device is string => Boolean(device)) ?? null
  );
}

const root = '.maestro/android/flows';
const args = process.argv.slice(2);
const requestedFlow = args.find((arg) => arg.endsWith('.yaml'));
const flowPath = requestedFlow ? `${root}/${requestedFlow}` : root;
const forwardedArgs = args.filter((arg) => arg !== requestedFlow);
const excludedTags = requestedFlow ? [] : ['--exclude-tags', 'fixture,local-session'];
const hasExplicitDevice = forwardedArgs.some(
  (arg) => arg === '--device' || arg.startsWith('--device='),
);
const device = hasExplicitDevice ? null : findConnectedAndroidDevice();

if (!hasExplicitDevice && !device) {
  console.error(
    'Kein verbundenes Android-Gerät gefunden. Starte einen Emulator oder verbinde ein Gerät mit aktiviertem USB-Debugging.',
  );
  process.exit(1);
}

console.log(
  `Android-Maestro-Test startet mit com.goldjunge91.fam${device ? ` auf ${device}` : ''}`,
);
process.exit(
  runMaestro([
    'test',
    '--reinstall-driver',
    flowPath,
    ...excludedTags,
    ...forwardedArgs,
    ...(device ? ['--device', device] : []),
  ]),
);
