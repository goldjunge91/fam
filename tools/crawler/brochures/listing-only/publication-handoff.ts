#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { appendFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const PUBLICATION_HANDOFF_MANIFEST = 'publication-handoff.json';
export const PUBLICATION_INPUT_FILES = [
  'all-stores-full.json',
  'canonical-page-verification.json',
  'canonical-brochures.json',
] as const;

type PublicationInputName = (typeof PUBLICATION_INPUT_FILES)[number];

type PublicationBinding = {
  repository: string;
  runId: string;
  commitSha: string;
};

type PublicationHandoffFile = {
  name: PublicationInputName;
  sha256: string;
  bytes: number;
};

export type PublicationHandoffManifest = PublicationBinding & {
  version: 1;
  inputFingerprint: string;
  files: PublicationHandoffFile[];
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

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

function parseInputFingerprint(verificationBytes: Uint8Array): string {
  const verification = JSON.parse(Buffer.from(verificationBytes).toString('utf8')) as unknown;
  if (!isRecord(verification) || !SHA256_PATTERN.test(String(verification.inputFingerprint))) {
    throw new Error('Verification inputFingerprint must be a SHA-256 digest');
  }
  return String(verification.inputFingerprint);
}

function parseManifest(value: unknown): PublicationHandoffManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.files)) {
    throw new Error('Publication handoff manifest must be version 1 with a files array');
  }

  if (value.files.length !== PUBLICATION_INPUT_FILES.length) {
    throw new Error('Publication handoff manifest must contain the exact publisher input allowlist');
  }

  const files = value.files.map((entry, index): PublicationHandoffFile => {
    const expectedName = PUBLICATION_INPUT_FILES[index];
    if (!expectedName || !isRecord(entry) || entry.name !== expectedName) {
      throw new Error('Publication handoff manifest must contain the exact publisher input allowlist');
    }
    const sha = requiredString(entry.sha256, `${expectedName} SHA-256`);
    if (!SHA256_PATTERN.test(sha)) throw new Error(`${expectedName} has an invalid SHA-256 digest`);
    if (typeof entry.bytes !== 'number' || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1) {
      throw new Error(`${expectedName} has an invalid byte count`);
    }
    return { name: expectedName, sha256: sha, bytes: entry.bytes };
  });

  const inputFingerprint = requiredString(value.inputFingerprint, 'inputFingerprint');
  if (!SHA256_PATTERN.test(inputFingerprint)) {
    throw new Error('Publication handoff inputFingerprint must be a SHA-256 digest');
  }

  return {
    version: 1,
    repository: requiredString(value.repository, 'repository'),
    runId: requiredString(value.runId, 'runId'),
    commitSha: requiredString(value.commitSha, 'commitSha'),
    inputFingerprint,
    files,
  };
}

function assertBinding(actual: PublicationBinding, expected: PublicationBinding): void {
  if (
    actual.repository !== expected.repository ||
    actual.runId !== expected.runId ||
    actual.commitSha !== expected.commitSha
  ) {
    throw new Error('Publication handoff binding does not match this workflow run');
  }
}

export async function createPublicationHandoff(options: {
  sourceDir: string;
  bundleDir: string;
  binding: PublicationBinding;
}): Promise<{ manifest: PublicationHandoffManifest; manifestSha256: string }> {
  if (resolve(options.sourceDir) === resolve(options.bundleDir)) {
    throw new Error('Publication handoff source and bundle directories must differ');
  }
  const binding: PublicationBinding = {
    repository: requiredString(options.binding.repository, 'repository'),
    runId: requiredString(options.binding.runId, 'runId'),
    commitSha: requiredString(options.binding.commitSha, 'commitSha'),
  };

  await mkdir(options.bundleDir, { recursive: true });
  if ((await readdir(options.bundleDir)).length > 0) {
    throw new Error('Publication handoff bundle directory must be empty');
  }

  const sourceFiles = await Promise.all(
    PUBLICATION_INPUT_FILES.map(async (name) => ({
      name,
      bytes: await readFile(join(options.sourceDir, name)),
    })),
  );
  const verification = sourceFiles.find(({ name }) => name === 'canonical-page-verification.json');
  if (!verification) throw new Error('Verification report is missing from publication inputs');

  const files: PublicationHandoffFile[] = [];
  for (const file of sourceFiles) {
    await writeFile(join(options.bundleDir, file.name), file.bytes);
    files.push({ name: file.name, sha256: sha256(file.bytes), bytes: file.bytes.byteLength });
  }

  const manifest: PublicationHandoffManifest = {
    version: 1,
    ...binding,
    inputFingerprint: parseInputFingerprint(verification.bytes),
    files,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(options.bundleDir, PUBLICATION_HANDOFF_MANIFEST), manifestBytes);

  return { manifest, manifestSha256: sha256(manifestBytes) };
}

export async function validatePublicationHandoff(options: {
  bundleDir: string;
  manifestSha256: string;
  binding: PublicationBinding;
}): Promise<{
  manifest: PublicationHandoffManifest;
  paths: Record<PublicationInputName, string>;
}> {
  if (!SHA256_PATTERN.test(options.manifestSha256)) {
    throw new Error('Expected publication manifest SHA-256 is invalid');
  }

  const expectedEntries = new Set([PUBLICATION_HANDOFF_MANIFEST, ...PUBLICATION_INPUT_FILES]);
  const actualEntries = await readdir(options.bundleDir);
  if (
    actualEntries.length !== expectedEntries.size ||
    actualEntries.some((entry) => !expectedEntries.has(entry))
  ) {
    const missing = [...expectedEntries].filter((entry) => !actualEntries.includes(entry));
    const extra = actualEntries.filter((entry) => !expectedEntries.has(entry));
    throw new Error(
      `Publication handoff bundle must contain the exact file allowlist; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`,
    );
  }
  for (const entry of expectedEntries) {
    if (!(await lstat(join(options.bundleDir, entry))).isFile()) {
      throw new Error(`Publication handoff entry ${entry} is not a regular file`);
    }
  }

  const manifestPath = join(options.bundleDir, PUBLICATION_HANDOFF_MANIFEST);
  const manifestBytes = await readFile(manifestPath);
  if (sha256(manifestBytes) !== options.manifestSha256) {
    throw new Error('Publication handoff manifest SHA-256 does not match the verifier output');
  }

  const manifest = parseManifest(JSON.parse(manifestBytes.toString('utf8')) as unknown);
  assertBinding(manifest, options.binding);

  const paths = {} as Record<PublicationInputName, string>;
  for (const file of manifest.files) {
    const path = join(options.bundleDir, file.name);
    const bytes = await readFile(path);
    if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256) {
      throw new Error(`Publication input ${file.name} failed SHA-256 or byte-count validation`);
    }
    paths[file.name] = path;
  }

  const verificationBytes = await readFile(paths['canonical-page-verification.json']);
  if (parseInputFingerprint(verificationBytes) !== manifest.inputFingerprint) {
    throw new Error('Publication verification inputFingerprint does not match the handoff manifest');
  }

  return { manifest, paths };
}

function argumentValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];
  const prefixed = args.find((argument) => argument.startsWith(`${flag}=`));
  return prefixed?.slice(flag.length + 1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] !== 'create') throw new Error('Expected publication-handoff.ts create');

  const sourceDir = argumentValue(args, '--source-dir');
  const bundleDir = argumentValue(args, '--bundle-dir');
  if (!sourceDir || !bundleDir) throw new Error('--source-dir and --bundle-dir are required');

  const result = await createPublicationHandoff({
    sourceDir,
    bundleDir,
    binding: {
      repository: requiredString(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY'),
      runId: requiredString(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
      commitSha: requiredString(process.env.GITHUB_SHA, 'GITHUB_SHA'),
    },
  });

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `manifest_sha256=${result.manifestSha256}\n`, 'utf8');
  }
  console.log(`Publication handoff manifest SHA-256: ${result.manifestSha256}`);
}

if (process.argv[1]?.endsWith('publication-handoff.ts')) {
  main().catch((error: unknown) => {
    console.error(`Publication handoff failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
