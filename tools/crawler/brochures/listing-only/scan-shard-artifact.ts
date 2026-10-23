#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  PHASE_ARTIFACT_MANIFEST,
  validatePhaseArtifact,
  type PhaseArtifactBinding,
} from './phase-artifact';

const SHARD_COUNT = 4;
const SCAN_FILE = 'all-stores-full.json';

type ScanShard = {
  totalLocations: number;
  completedLocations: number;
  byZipCode: Record<string, unknown>;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseScanShard(value: unknown, shardIndex: number, zipCodes: readonly string[]): ScanShard {
  if (
    !isRecord(value) ||
    !isRecord(value.byZipCode) ||
    !isRecord(value.shard) ||
    !Array.isArray(value.shard.zipCodes)
  ) {
    throw new Error(`Scan shard ${shardIndex} must contain its exact shard ZIP metadata`);
  }
  if (
    value.shard.index !== shardIndex ||
    value.shard.count !== SHARD_COUNT ||
    JSON.stringify(value.shard.zipCodes.slice().sort()) !== JSON.stringify([...zipCodes].sort())
  ) {
    throw new Error(`Scan shard ${shardIndex} metadata does not match its phase manifest`);
  }
  if (
    typeof value.totalLocations !== 'number' ||
    typeof value.completedLocations !== 'number' ||
    !Number.isSafeInteger(value.totalLocations) ||
    !Number.isSafeInteger(value.completedLocations) ||
    value.totalLocations !== zipCodes.length ||
    value.completedLocations !== zipCodes.length
  ) {
    throw new Error(`Scan shard ${shardIndex} is not complete for its ZIP set`);
  }

  const actualZipCodes = Object.keys(value.byZipCode).sort();
  if (JSON.stringify(actualZipCodes) !== JSON.stringify([...zipCodes].sort())) {
    throw new Error(`Scan shard ${shardIndex} ZIP set does not match its phase manifest`);
  }
  return {
    totalLocations: value.totalLocations,
    completedLocations: value.completedLocations,
    byZipCode: value.byZipCode,
  };
}

export async function mergeScanShards(options: {
  shardsDir: string;
  outputPath: string;
  binding: PhaseArtifactBinding;
  predecessorManifestSha256: string;
  shardCount?: number;
}): Promise<{ predecessorManifestSha256: string[] }> {
  const shardCount = options.shardCount ?? SHARD_COUNT;
  if (!Number.isSafeInteger(shardCount) || shardCount !== SHARD_COUNT) {
    throw new Error(`The brochure scan requires exactly ${SHARD_COUNT} shards`);
  }
  try {
    await unlink(options.outputPath);
  } catch (error) {
    if (!isRecord(error) || error.code !== 'ENOENT') throw error;
  }
  const entries = await readdir(options.shardsDir, { withFileTypes: true });
  const expectedNames = new Set(Array.from({ length: shardCount }, (_, index) => String(index)));
  if (
    entries.length !== expectedNames.size ||
    entries.some((entry) => !entry.isDirectory() || !expectedNames.has(entry.name))
  ) {
    throw new Error(`The brochure scan requires exactly the ${shardCount} numbered shard artifacts`);
  }

  const mergedByZipCode: Record<string, unknown> = {};
  const shardManifestDigests: string[] = [];
  let totalLocations = 0;
  for (let shardIndex = 0; shardIndex < shardCount; shardIndex++) {
    const artifactDir = join(options.shardsDir, String(shardIndex));
    const manifestBytes = await readFile(join(artifactDir, PHASE_ARTIFACT_MANIFEST));
    const manifestSha256 = sha256(manifestBytes);
    const result = await validatePhaseArtifact({
      artifactDir,
      phase: 'scan-locations',
      files: [SCAN_FILE],
      binding: options.binding,
      manifestSha256,
      predecessorManifestSha256: [options.predecessorManifestSha256],
      shard: { index: shardIndex, count: shardCount },
    });
    shardManifestDigests.push(manifestSha256);
    const shard = parseScanShard(
      JSON.parse(await readFile(result.paths[SCAN_FILE], 'utf8')) as unknown,
      shardIndex,
      result.manifest.shard?.zipCodes ?? [],
    );

    for (const [zipCode, offers] of Object.entries(shard.byZipCode)) {
      if (Object.hasOwn(mergedByZipCode, zipCode)) {
        throw new Error(`ZIP ${zipCode} occurs in more than one scan shard`);
      }
      mergedByZipCode[zipCode] = offers;
    }
    totalLocations += shard.totalLocations;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    totalLocations,
    completedLocations: totalLocations,
    byZipCode: Object.fromEntries(
      Object.entries(mergedByZipCode).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
  if (Object.keys(output.byZipCode).length !== totalLocations) {
    throw new Error('Merged brochure scan contains missing or duplicate ZIP locations');
  }
  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  return { predecessorManifestSha256: shardManifestDigests.sort() };
}

function argumentValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];
  const prefixed = args.find((argument) => argument.startsWith(`${flag}=`));
  return prefixed?.slice(flag.length + 1);
}

function bindingFromEnvironment(): PhaseArtifactBinding {
  return {
    repository: requiredString(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY'),
    runId: requiredString(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID'),
    commitSha: requiredString(process.env.GITHUB_SHA, 'GITHUB_SHA'),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] !== 'merge') throw new Error('Expected scan-shard-artifact.ts merge');
  const shardsDir = argumentValue(args, '--shards-dir');
  const outputPath = argumentValue(args, '--output');
  const predecessorManifestSha256 = argumentValue(args, '--predecessor-manifest-sha256');
  if (!shardsDir || !outputPath || !predecessorManifestSha256) {
    throw new Error('--shards-dir, --output, and --predecessor-manifest-sha256 are required');
  }

  const result = await mergeScanShards({
    shardsDir,
    outputPath,
    binding: bindingFromEnvironment(),
    predecessorManifestSha256,
  });
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(
      process.env.GITHUB_OUTPUT,
      `predecessor_manifest_sha256=${result.predecessorManifestSha256.join(',')}\n`,
      { flag: 'a' },
    );
  }
  console.log(`Merged ${result.predecessorManifestSha256.length} verified scan shard manifests.`);
}

if (process.argv[1]?.endsWith('scan-shard-artifact.ts')) {
  main().catch((error: unknown) => {
    console.error(`Scan shard merge failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
