import fs from 'node:fs';
import path from 'node:path';
import type { CommandStep } from '../build-picker-logic';

export const IOS_BUNDLE_IDENTIFIER = 'com.goldjunge91.fam1';

export type BuildKind = 'simulator' | 'testflight-eas' | 'testflight-xcode';
export type ArtifactKind = 'app' | 'ipa' | 'xcarchive';
export type UploadMethod = 'none' | 'eas' | 'xcode';

export interface BuildSpec {
  kind: BuildKind;
  buildProfile: string;
  submitProfile?: string;
  artifactKind: ArtifactKind;
  upload: UploadMethod;
}

export interface BuildMetadata {
  appVersion: string;
  buildNumber: string;
  bundleIdentifier: string;
}

export type BuildCliParseResult = { kind: 'help' } | { kind: 'run'; spec: BuildSpec };

export const IOS_BUILD_USAGE = `Usage:
  bun run build:simulator
  bun run build:testflight -- eas
  bun run build:testflight -- xcode`;

export class BuildCliUsageError extends Error {
  readonly exitCode = 2;

  constructor(message: string) {
    super(`${message}\n\n${IOS_BUILD_USAGE}`);
    this.name = 'BuildCliUsageError';
  }
}

const simulatorSpec: BuildSpec = {
  kind: 'simulator',
  buildProfile: 'development-local',
  artifactKind: 'app',
  upload: 'none',
};

const easTestFlightSpec: BuildSpec = {
  kind: 'testflight-eas',
  buildProfile: 'preview-testflight-local',
  submitProfile: 'preview-testflight',
  artifactKind: 'ipa',
  upload: 'eas',
};

const xcodeTestFlightSpec: BuildSpec = {
  kind: 'testflight-xcode',
  buildProfile: 'preview-testflight',
  artifactKind: 'xcarchive',
  upload: 'xcode',
};

export function parseIosBuildArgs(args: readonly string[]): BuildCliParseResult {
  if (args.some((argument) => argument === '--help' || argument === '-h')) {
    return { kind: 'help' };
  }

  if (args.length === 1 && args[0] === 'simulator') {
    return { kind: 'run', spec: { ...simulatorSpec } };
  }

  if (args[0] === 'testflight' && args.length !== 2) {
    throw new BuildCliUsageError('TestFlight benötigt genau einen Upload-Weg: eas oder xcode.');
  }

  if (args.length === 2 && args[0] === 'testflight') {
    if (args[1] === 'eas') {
      return { kind: 'run', spec: { ...easTestFlightSpec } };
    }
    if (args[1] === 'xcode') {
      return { kind: 'run', spec: { ...xcodeTestFlightSpec } };
    }
  }

  throw new BuildCliUsageError(`Ungültige Build-Auswahl: ${args.join(' ') || '(keine)'}`);
}

function asRecord(value: unknown, description: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${description} muss ein JSON-Objekt sein.`);
  }
  return value as Record<string, unknown>;
}

function readVersionValue(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${fieldName} fehlt oder ist ungültig.`);
  }
  const stringValue = String(value);
  if (!/^\d+$/.test(stringValue) || Number(stringValue) < 1) {
    throw new Error(`${fieldName} fehlt oder ist ungültig.`);
  }
  return stringValue;
}

export function parseRemoteBuildVersion(json: string): string {
  const parsed = asRecord(JSON.parse(json) as unknown, 'EAS-Versionsantwort');
  return readVersionValue(parsed.buildNumber, 'EAS buildNumber');
}

function readRequiredString(record: Record<string, unknown>, fieldName: string): string {
  const value = record[fieldName];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} fehlt oder ist ungültig.`);
  }
  return value;
}

export function parseInfoPlistJson(json: string): BuildMetadata {
  const parsed = asRecord(JSON.parse(json) as unknown, 'Info.plist');
  const appVersion = readRequiredString(parsed, 'CFBundleShortVersionString');
  const buildNumber = readVersionValue(parsed.CFBundleVersion, 'CFBundleVersion');
  const bundleIdentifier = readRequiredString(parsed, 'CFBundleIdentifier');

  if (bundleIdentifier !== IOS_BUNDLE_IDENTIFIER) {
    throw new Error(
      `Bundle-ID stimmt nicht: erwartet ${IOS_BUNDLE_IDENTIFIER}, erhalten ${bundleIdentifier}.`,
    );
  }

  return { appVersion, buildNumber, bundleIdentifier };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildRunTimestamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function safeFileSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function buildLogFileName(spec: BuildSpec, date: Date, metadata?: BuildMetadata): string {
  const version = metadata ? safeFileSegment(metadata.appVersion) : 'unknown';
  const buildNumber = metadata ? safeFileSegment(metadata.buildNumber) : 'unknown';
  return `${buildRunTimestamp(date)}-${spec.kind}-v${version}-b${buildNumber}.log`;
}

export function pendingBuildLogFileName(spec: BuildSpec, date: Date, runId: string): string {
  return `${buildRunTimestamp(date)}-${spec.kind}-pending-${safeFileSegment(runId)}.log`;
}

export function artifactOutputPath(spec: BuildSpec, runId: string): string {
  if (spec.artifactKind === 'xcarchive') {
    return `build/cache/ios/testflight/${runId}/fam.xcarchive`;
  }

  const extension = spec.artifactKind === 'app' ? 'app' : 'ipa';
  return `build/local/eas/${spec.buildProfile}/${runId}/fam.${extension}`;
}

export function remoteVersionCommand(profile: string): CommandStep {
  return {
    command: 'bun',
    args: [
      'x',
      'eas-cli',
      'build:version:get',
      '--platform',
      'ios',
      '--profile',
      profile,
      '--json',
      '--non-interactive',
    ],
  };
}

export function localEasBuildCommand(profile: string, outputPath: string): CommandStep {
  return {
    command: 'bash',
    args: [
      'scripts/eas-ios-build.sh',
      'local',
      profile,
      '--output',
      outputPath,
      '--non-interactive',
    ],
  };
}

export function testflightSubmitCommand(profile: string, ipaPath: string): CommandStep {
  return {
    command: 'bun',
    args: [
      'x',
      'eas-cli',
      'submit',
      '--platform',
      'ios',
      '--profile',
      profile,
      '--path',
      ipaPath,
      '--non-interactive',
    ],
  };
}

function isArtifactEntry(entry: fs.Dirent, kind: ArtifactKind): boolean {
  if (kind === 'ipa') return entry.isFile() && entry.name.endsWith('.ipa');
  if (kind === 'app') return entry.isDirectory() && entry.name.endsWith('.app');
  return entry.isDirectory() && entry.name.endsWith('.xcarchive');
}

function collectArtifacts(root: string, kind: ArtifactKind, results: string[]): void {
  if (!fs.existsSync(root)) return;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (isArtifactEntry(entry, kind)) {
      results.push(entryPath);
      continue;
    }
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      collectArtifacts(entryPath, kind, results);
    }
  }
}

function assertExpectedArtifact(pathValue: string, kind: ArtifactKind): boolean {
  if (!fs.existsSync(pathValue)) return false;
  const stat = fs.statSync(pathValue);
  if (kind === 'ipa') return stat.isFile() && pathValue.endsWith('.ipa');
  if (kind === 'app') return stat.isDirectory() && pathValue.endsWith('.app');
  return stat.isDirectory() && pathValue.endsWith('.xcarchive');
}

export function resolveArtifactPath(
  kind: ArtifactKind,
  expectedPath: string,
  searchRoot: string,
): string {
  if (assertExpectedArtifact(expectedPath, kind)) return expectedPath;

  const candidates: string[] = [];
  collectArtifacts(searchRoot, kind, candidates);
  const preferredName = path.basename(expectedPath);
  const preferred = candidates.filter((candidate) => path.basename(candidate) === preferredName);
  const matching = preferred.length === 1 ? preferred : candidates;

  if (matching.length === 1) return matching[0];
  if (matching.length === 0) {
    throw new Error(`Kein ${kind}-Artefakt unter ${searchRoot} gefunden.`);
  }
  throw new Error(`Mehrdeutige ${kind}-Artefakte unter ${searchRoot} gefunden.`);
}

export function artifactInfoPlistPath(kind: ArtifactKind, artifactPath: string): string {
  if (kind === 'ipa') {
    throw new Error('Eine IPA benötigt eine temporäre Extraktion ihrer Info.plist.');
  }
  if (kind === 'app') return path.join(artifactPath, 'Info.plist');
  return path.join(artifactPath, 'Products', 'Applications', 'fam.app', 'Info.plist');
}
