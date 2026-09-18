#!/usr/bin/env bash

set -euo pipefail

ACTION="$1"
STORAGE_ROOT="$IOS_BUILD_WORKFLOW_STORAGE_ROOT"
LOG_ROOT="$IOS_BUILD_WORKFLOW_LOG_ROOT"
COUNTER_FILE="$STORAGE_ROOT/ios-build-workflow-run-number.json"
RUN_ID="$IOS_BUILD_WORKFLOW_RUN_ID"
RUN_NUMBER="$IOS_BUILD_WORKFLOW_RUN_NUMBER"
RUN_LOG="$IOS_BUILD_WORKFLOW_LOG_FILE"
RUN_STATE="$IOS_BUILD_WORKFLOW_STATE_FILE"
LATEST_STATE="$IOS_BUILD_WORKFLOW_LATEST_STATE_FILE"
HISTORY_LOG="$IOS_BUILD_WORKFLOW_HISTORY_LOG"

mkdir -p "$LOG_ROOT"

if [ "$ACTION" = "allocate" ]; then
  node - "$COUNTER_FILE" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const counterPath = process.argv[2];
let next = 1;
if (fs.existsSync(counterPath)) {
  next = JSON.parse(fs.readFileSync(counterPath, 'utf8')).nextRunNumber;
}
if (!Number.isSafeInteger(next) || next < 1) throw new Error('invalid run-number state');
const state = {
  schemaVersion: 1,
  nextRunNumber: next + 1,
  lastRunNumber: next,
  updatedAt: new Date().toISOString(),
};
const temporaryPath = counterPath + '.tmp-' + process.pid;
fs.mkdirSync(path.dirname(counterPath), { recursive: true });
fs.writeFileSync(temporaryPath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
fs.renameSync(temporaryPath, counterPath);
process.stdout.write(String(next));
NODE
  exit 0
fi

if [ "$ACTION" = "artifact" ]; then
  IOS_BUILD_WORKFLOW_ARTIFACT_SHA256="$(shasum -a 256 "$IOS_BUILD_WORKFLOW_ARTIFACT_PATH" | awk '{print $1}')"
  export IOS_BUILD_WORKFLOW_ARTIFACT_SHA256
  ACTION="artifact_ready"
fi

EVENT="$2"
[ "$ACTION" = "event" ] || [ "$ACTION" = "artifact_ready" ] || exit 64
export IOS_BUILD_WORKFLOW_EVENT="$EVENT"

node - "$RUN_STATE" "$LATEST_STATE" "$HISTORY_LOG" "$RUN_LOG" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [runStatePath, latestStatePath, historyPath, runLogPath] = process.argv.slice(2);
const env = process.env;
const event = env.IOS_BUILD_WORKFLOW_EVENT;
const runNumber = env.IOS_BUILD_WORKFLOW_RUN_NUMBER ? Number(env.IOS_BUILD_WORKFLOW_RUN_NUMBER) : null;
if (!event || !/^[a-z0-9_]+$/.test(event)) throw new Error('invalid event');
if (runNumber !== null && !Number.isSafeInteger(runNumber)) throw new Error('invalid runNumber');

const record = {
  event,
  timestamp: new Date().toISOString(),
  runId: env.IOS_BUILD_WORKFLOW_RUN_ID || null,
  runNumber,
  mode: env.IOS_BUILD_WORKFLOW_MODE || null,
  stage: env.IOS_BUILD_WORKFLOW_STAGE || null,
  status: env.IOS_BUILD_WORKFLOW_STATUS || null,
  exitCode: env.IOS_BUILD_WORKFLOW_EXIT_CODE ? Number(env.IOS_BUILD_WORKFLOW_EXIT_CODE) : null,
  artifactPath: env.IOS_BUILD_WORKFLOW_ARTIFACT_PATH || null,
  artifactSha256: env.IOS_BUILD_WORKFLOW_ARTIFACT_SHA256 || null,
  submissionId: env.IOS_BUILD_WORKFLOW_SUBMISSION_ID || null,
  lockPath: env.IOS_BUILD_WORKFLOW_LOCK_PATH || null,
  runLogPath,
  statePath: runStatePath,
  message: env.IOS_BUILD_WORKFLOW_MESSAGE || null,
};
const read = (filePath) => fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
const write = (filePath, value) => {
  const temporaryPath = filePath + '.tmp-' + process.pid;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
};
const previous = read(runStatePath);
const state = { ...previous, ...record };
for (const key of ['runNumber', 'mode', 'artifactPath', 'artifactSha256', 'submissionId', 'lockPath']) {
  if (state[key] === null && previous[key] !== undefined) state[key] = previous[key];
}
fs.mkdirSync(path.dirname(historyPath), { recursive: true });
fs.appendFileSync(historyPath, JSON.stringify(record) + '\n', { mode: 0o600 });
write(runStatePath, state);
if (env.IOS_BUILD_WORKFLOW_UPDATE_LATEST !== '0') write(latestStatePath, state);
fs.appendFileSync(runLogPath, '[' + record.timestamp + '] event=' + event + ' runId=' + (record.runId || '-') + ' runNumber=' + (state.runNumber || '-') + ' stage=' + (record.stage || '-') + ' status=' + (record.status || '-') + '\n', { mode: 0o600 });
process.stderr.write('[ios-build] event=' + event + ' runNumber=' + (state.runNumber || '-') + ' runId=' + (record.runId || '-') + ' state=' + runStatePath + ' log=' + runLogPath + '\n');
NODE
