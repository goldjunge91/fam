import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  IOS_TARGET_NAME,
  IOS_TARGET_SYSTEM_VERSION,
  IOS_TARGET_UDID,
} from './ios-target.mjs';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

async function loadAppleRunner() {
  const packageJsonPath = require.resolve('@react-native-harness/platform-apple/package.json');
  const runnerPath = join(dirname(packageJsonPath), 'dist/runner.js');
  const module = await import(pathToFileURL(runnerPath).href);
  return module.default;
}

async function listSimulators() {
  const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices', '--json'], {
    encoding: 'utf8',
  });
  const devices = JSON.parse(stdout).devices ?? {};
  return Object.entries(devices).flatMap(([runtime, entries]) =>
    entries.map((entry) => ({ ...entry, runtime })),
  );
}

async function assertTargetBinding(config) {
  if (config.targetUdid !== IOS_TARGET_UDID) {
    throw new Error(
      `Harness iOS target binding mismatch: expected ${IOS_TARGET_UDID}, received ${config.targetUdid ?? 'none'}`,
    );
  }

  const simulators = await listSimulators();
  const target = simulators.find((simulator) => simulator.udid === IOS_TARGET_UDID);
  if (!target || target.isAvailable === false) {
    throw new Error(
      `Harness iOS target unavailable: no available simulator with UDID ${IOS_TARGET_UDID}`,
    );
  }

  const runtimeSuffix = `iOS-${IOS_TARGET_SYSTEM_VERSION.replaceAll('.', '-')}`;
  const matchingSimulators = simulators.filter(
    (simulator) =>
      simulator.name === IOS_TARGET_NAME && simulator.runtime.endsWith(runtimeSuffix),
  );
  if (
    matchingSimulators.length !== 1 ||
    matchingSimulators[0]?.udid !== IOS_TARGET_UDID
  ) {
    throw new Error(
      `Harness iOS target binding is ambiguous for ${IOS_TARGET_NAME} ${IOS_TARGET_SYSTEM_VERSION}: expected only ${IOS_TARGET_UDID}`,
    );
  }
}

export default async function runAppleHarness(config, harnessConfig, init) {
  await assertTargetBinding(config);
  const appleRunner = await loadAppleRunner();
  return appleRunner(config, harnessConfig, init);
}
