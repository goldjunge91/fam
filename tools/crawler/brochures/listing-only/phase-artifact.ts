#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const PHASE_ARTIFACT_MANIFEST = 'phase-artifact.json';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type PhaseArtifactBinding = {
  repository: string;
  runId: string;
  commitSha: string;
};

type PhaseArtifactFile = {
  name: string;
  bytes: number;
  sha256: string;
};

export type PhaseArtifactShard = {
  index: number;
  count: number;
  zipCodes: string[];
};

export type PhaseArtifactManifest = PhaseArtifactBinding & {
  version: 1;
  phase: string;
  predecessorManifestSha256: string[];
  files: PhaseArtifactFile[];
  shard?: PhaseArtifactShard;
};

export type CreatePhaseArtifactOptions = {
  artifactDir: string;
  phase: string;
  files: readonly string[];
  binding: PhaseArtifactBinding;
  predecessorManifestSha256?: readonly string[];
  shard?: PhaseArtifactShard;
};

export type ValidatePhaseArtifactOptions = {
  artifactDir: string;
  phase: string;
  files: readonly string[];
  binding: PhaseArtifactBinding;
  manifestSha256: string | undefined;
  predecessorManifestSha256?: readonly string[];
  shard?: Omit<PhaseArtifactShard, 'zipCodes'> & { zipCodes?: readonly string[] };
};

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function digestList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const digests = value.map((entry) => requiredString(entry, field));
  if (digests.some((digest) => !SHA256_PATTERN.test(digest))) {
    throw new Error(`${field} must contain only SHA-256 digests`);
  }
  if (new Set(digests).size !== digests.length) {
    throw new Error(`${field} must not contain duplicate digests`);
  }
  return [...digests].sort();
}

function fileNames(files: readonly string[], field = 'files'): string[] {
  const names = files.map((file) => file.trim());
  if (
    names.length === 0 ||
    names.some((file) => file.length === 0 || file === PHASE_ARTIFACT_MANIFEST || file.includes('/') || file.includes('\\'))
  ) {
    throw new Error(`${field} must contain non-empty direct file names other than ${PHASE_ARTIFACT_MANIFEST}`);
  }
  if (new Set(names).size !== names.length) throw new Error(`${field} must not contain duplicates`);
  return [...names].sort();
}

function bindingFromEnvironment(): PhaseArtifactBinding {
  return {
    repository: requiredString(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY'),
    runId: requiredString(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
    commitSha: requiredString(process.env.GITHUB_SHA, 'GITHUB_SHA'),
  };
}

function normalizeShard(shard: PhaseArtifactShard): PhaseArtifactShard {
  if (
    !Number.isSafeInteger(shard.index) ||
    !Number.isSafeInteger(shard.count) ||
    shard.count < 1 ||
    shard.index < 0 ||
    shard.index >= shard.count
  ) {
    throw new Error('Artifact shard index and count must describe a valid shard');
  }
  const zipCodes = [...shard.zipCodes].sort();
  if (new Set(zipCodes).size !== zipCodes.length || zipCodes.some((zipCode) => !/^\d{5}$/.test(zipCode))) {
    throw new Error('Artifact shard ZIP codes must be unique five-digit ZIP codes');
  }
  return { index: shard.index, count: shard.count, zipCodes };
}

function parseShard(value: unknown): PhaseArtifactShard | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !Array.isArray(value.zipCodes)) {
    throw new Error('Artifact shard must contain an index, count, and ZIP code array');
  }
  return normalizeShard({
    index: value.index as number,
    count: value.count as number,
    zipCodes: value.zipCodes.map((entry) => requiredString(entry, 'Artifact shard ZIP code')),
  });
}

function assertBinding(actual: PhaseArtifactBinding, expected: PhaseArtifactBinding): void {
  if (
    actual.repository !== expected.repository ||
    actual.runId !== expected.runId ||
    actual.commitSha !== expected.commitSha
  ) {
    throw new Error('Phase artifact binding does not match this workflow run');
  }
}

function parseManifest(value: unknown): PhaseArtifactManifest {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error('Phase artifact manifest must be version 1');
  }
  if (!Array.isArray(value.files)) throw new Error('Phase artifact manifest must contain a files array');

  const files = value.files.map((entry, index): PhaseArtifactFile => {
    if (!isRecord(entry)) throw new Error(`Phase artifact file ${index + 1} must be an object`);
    const name = requiredString(entry.name, `Phase artifact file ${index + 1} name`);
    if (typeof entry.bytes !== 'number' || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1) {
      throw new Error(`Phase artifact file ${name} has an invalid byte count`);
    }
    const digest = requiredString(entry.sha256, `Phase artifact file ${name} SHA-256`);
    if (!SHA256_PATTERN.test(digest)) {
      throw new Error(`Phase artifact file ${name} has an invalid SHA-256 digest`);
    }
    return { name, bytes: entry.bytes, sha256: digest };
  });

  const names = fileNames(files.map((file) => file.name), 'Phase artifact manifest files');
  if (files.map((file) => file.name).join('\n') !== names.join('\n')) {
    throw new Error('Phase artifact manifest files must be sorted and exact');
  }

  return {
    version: 1,
    repository: requiredString(value.repository, 'repository'),
    runId: requiredString(value.runId, 'runId'),
    commitSha: requiredString(value.commitSha, 'commitSha'),
    phase: requiredString(value.phase, 'phase'),
    predecessorManifestSha256: digestList(
      value.predecessorManifestSha256,
      'predecessorManifestSha256',
    ),
    files,
    shard: parseShard(value.shard),
  };
}

function assertExpectedShard(
  actual: PhaseArtifactShard | undefined,
  expected: ValidatePhaseArtifactOptions['shard'],
): void {
  if (!expected && actual) throw new Error('Unexpected shard metadata in phase artifact');
  if (!expected) return;
  if (!actual || actual.index !== expected.index || actual.count !== expected.count) {
    throw new Error('Phase artifact shard identity does not match the expected shard');
  }
  if (expected.zipCodes && JSON.stringify(actual.zipCodes) !== JSON.stringify([...expected.zipCodes].sort())) {
    throw new Error('Phase artifact shard ZIP set does not match the expected ZIP set');
  }
}

async function assertExactDirectory(artifactDir: string, expectedFiles: readonly string[]): Promise<void> {
  const expected = new Set([PHASE_ARTIFACT_MANIFEST, ...expectedFiles]);
  const entries = await readdir(artifactDir, { withFileTypes: true });
  if (
    entries.length !== expected.size ||
    entries.some((entry) => !entry.isFile() || !expected.has(entry.name))
  ) {
    throw new Error('Phase artifact contains missing, extra, or non-file entries');
  }
  for (const name of expected) {
    const entry = entries.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`Phase artifact is missing ${name}`);
    const stats = await lstat(join(artifactDir, name));
    if (!stats.isFile()) throw new Error(`Phase artifact entry ${name} is not a regular file`);
  }
}

export async function createPhaseArtifact(
  options: CreatePhaseArtifactOptions,
): Promise<{ manifest: PhaseArtifactManifest; manifestSha256: string }> {
  const names = fileNames(options.files);
  const predecessorManifestSha256 = [...(options.predecessorManifestSha256 ?? [])].sort();
  if (new Set(predecessorManifestSha256).size !== predecessorManifestSha256.length ||
      predecessorManifestSha256.some((digest) => !SHA256_PATTERN.test(digest))) {
    throw new Error('predecessorManifestSha256 must contain unique SHA-256 digests');
  }
  const binding: PhaseArtifactBinding = {
    repository: requiredString(options.binding.repository, 'repository'),
    runId: requiredString(options.binding.runId, 'runId'),
    commitSha: requiredString(options.binding.commitSha, 'commitSha'),
  };
  const shard = options.shard ? normalizeShard(options.shard) : undefined;

  await mkdir(options.artifactDir, { recursive: true });
  const sourceEntries = await readdir(options.artifactDir, { withFileTypes: true });
  const expectedSourceFiles = new Set(names);
  if (
    sourceEntries.length !== expectedSourceFiles.size ||
    sourceEntries.some((entry) => !entry.isFile() || !expectedSourceFiles.has(entry.name))
  ) {
    throw new Error('Phase artifact source contains missing, extra, or non-file entries');
  }
  for (const name of names) {
    const stats = await lstat(join(options.artifactDir, name));
    if (!stats.isFile()) throw new Error(`Phase artifact source entry ${name} is not a regular file`);
  }

  const files: PhaseArtifactFile[] = [];
  for (const name of names) {
    const bytes = await readFile(join(options.artifactDir, name));
    files.push({ name, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  const manifest: PhaseArtifactManifest = {
    version: 1,
    ...binding,
    phase: requiredString(options.phase, 'phase'),
    predecessorManifestSha256,
    files,
    ...(shard ? { shard } : {}),
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(options.artifactDir, PHASE_ARTIFACT_MANIFEST), manifestBytes);
  const manifestSha256 = sha256(manifestBytes);
  if (process.env.GITHUB_OUTPUT) {
    await appendOutput('manifest_sha256', manifestSha256);
    await appendOutput('predecessor_manifest_sha256', predecessorManifestSha256.join(','));
  }
  return { manifest, manifestSha256 };
}

export async function validatePhaseArtifact(
  options: ValidatePhaseArtifactOptions,
): Promise<{ manifest: PhaseArtifactManifest; paths: Record<string, string> }> {
  const names = fileNames(options.files);
  const manifestSha256 = requiredString(
    options.manifestSha256,
    'Expected phase artifact manifest SHA-256',
  );
  if (!SHA256_PATTERN.test(manifestSha256)) {
    throw new Error('Expected phase artifact manifest SHA-256 is invalid');
  }
  const manifestPath = join(options.artifactDir, PHASE_ARTIFACT_MANIFEST);
  const manifestBytes = await readFile(manifestPath);
  if (sha256(manifestBytes) !== manifestSha256) {
    throw new Error('Phase artifact manifest SHA-256 does not match the expected digest');
  }

  const manifest = parseManifest(JSON.parse(manifestBytes.toString('utf8')) as unknown);
  assertBinding(manifest, options.binding);
  if (manifest.phase !== options.phase) {
    throw new Error(`Phase artifact belongs to ${manifest.phase}, expected ${options.phase}`);
  }
  if (JSON.stringify(manifest.files.map((file) => file.name)) !== JSON.stringify(names)) {
    throw new Error('Phase artifact file allowlist does not match the expected files');
  }
  if (options.predecessorManifestSha256) {
    const expected = [...options.predecessorManifestSha256].sort();
    if (JSON.stringify(manifest.predecessorManifestSha256) !== JSON.stringify(expected)) {
      throw new Error('Phase artifact predecessor manifest digest does not match');
    }
  }
  assertExpectedShard(manifest.shard, options.shard);
  await assertExactDirectory(options.artifactDir, names);

  const paths: Record<string, string> = {};
  for (const file of manifest.files) {
    const path = join(options.artifactDir, file.name);
    const bytes = await readFile(path);
    if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256) {
      throw new Error(`Phase artifact file ${file.name} failed byte-count or SHA-256 validation`);
    }
    paths[file.name] = path;
  }
  return { manifest, paths };
}

async function appendOutput(name: string, value: string): Promise<void> {
  await writeFile(process.env.GITHUB_OUTPUT!, `${name}=${value}\n`, { flag: 'a' });
}

function argumentValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];
  const prefixed = args.find((argument) => argument.startsWith(`${flag}=`));
  return prefixed?.slice(flag.length + 1);
}

function csv(value: string | undefined): string[] {
  return value ? value.split(',').map((entry) => entry.trim()).filter(Boolean) : [];
}

function parseShardArguments(args: readonly string[]): PhaseArtifactShard | undefined {
  const indexValue = argumentValue(args, '--shard-index');
  const countValue = argumentValue(args, '--shard-count');
  const zipCodes = csv(argumentValue(args, '--shard-zips'));
  if (indexValue === undefined && countValue === undefined && zipCodes.length === 0) return undefined;
  if (indexValue === undefined || countValue === undefined) {
    throw new Error('--shard-index and --shard-count are required together');
  }
  const index = Number(indexValue);
  const count = Number(countValue);
  return normalizeShard({ index, count, zipCodes });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const artifactDir = argumentValue(args, '--artifact-dir');
  const phase = argumentValue(args, '--phase');
  const files = fileNames(csv(argumentValue(args, '--files')));
  if (!artifactDir || !phase) throw new Error('--artifact-dir and --phase are required');

  if (command === 'create') {
    let shard = parseShardArguments(args);
    if (shard && shard.zipCodes.length === 0) {
      const firstFile = JSON.parse(await readFile(join(artifactDir, files[0]!), 'utf8')) as unknown;
      if (!isRecord(firstFile) || !isRecord(firstFile.shard) || !Array.isArray(firstFile.shard.zipCodes)) {
        throw new Error('Shard artifact must record its exact ZIP set');
      }
      const shardIndex = firstFile.shard.index;
      const shardCount = firstFile.shard.count;
      if (shardIndex !== shard.index || shardCount !== shard.count) {
        throw new Error('Shard artifact metadata does not match the requested shard');
      }
      shard = {
        ...shard,
        zipCodes: firstFile.shard.zipCodes.map((entry) => requiredString(entry, 'Artifact shard ZIP code')),
      };
    }
    const result = await createPhaseArtifact({
      artifactDir,
      phase,
      files,
      binding: bindingFromEnvironment(),
      predecessorManifestSha256: csv(argumentValue(args, '--predecessor-manifest-sha256')),
      shard,
    });
    console.log(`Phase artifact manifest SHA-256: ${result.manifestSha256}`);
    return;
  }

  if (command === 'validate') {
    const result = await validatePhaseArtifact({
      artifactDir,
      phase,
      files,
      binding: bindingFromEnvironment(),
      manifestSha256: requiredString(
        argumentValue(args, '--manifest-sha256'),
        '--manifest-sha256',
      ),
      predecessorManifestSha256: csv(argumentValue(args, '--predecessor-manifest-sha256')),
      shard: parseShardArguments(args),
    });
    console.log(`Validated ${result.manifest.phase} phase artifact.`);
    return;
  }

  throw new Error('Expected phase-artifact.ts create or validate');
}

if (process.argv[1]?.endsWith('phase-artifact.ts')) {
  main().catch((error: unknown) => {
    console.error(`Phase artifact failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
