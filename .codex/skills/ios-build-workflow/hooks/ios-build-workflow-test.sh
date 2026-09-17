#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
find_project_root() {
  local candidate="$1"
  while [ "$candidate" != "/" ]; do
    if [ -f "$candidate/native-build-lock.json" ] && [ -f "$candidate/package.json" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
    candidate="$(dirname "$candidate")"
  done
  return 1
}

ROOT="$(find_project_root "$PWD" || find_project_root "$SCRIPT_DIR")" || {
  printf 'project root with native-build-lock.json was not found\n' >&2
  exit 1
}
HOOK="$ROOT/.codex/hooks/ios-build-workflow.sh"
RUNNER="$ROOT/.codex/hooks/ios-build-workflow-runner.sh"
FASTPATH="$ROOT/scripts/native-testflight-fastpath.sh"
TEST_RUNNER="$ROOT/.codex/hooks/ios-build-workflow-test-runner.sh"
SKILL="$ROOT/.codex/skills/ios-build-workflow/SKILL.md"
TEMP_LOGS=()

cleanup() {
  for log_file in "${TEMP_LOGS[@]}"; do
    rm -f "$log_file"
  done
}
trap cleanup EXIT

if grep -Eq 'bun run|eas (build|submit)|native:(dev|rebuild|run|restore)' "$HOOK"; then
  printf 'prompt hook must delegate instead of executing build or upload commands\n' >&2
  exit 1
fi

if grep -Eq 'build:version:(set|sync)' "$HOOK" "$RUNNER" "$FASTPATH"; then
  printf 'workflow hook and runner must not mutate remote EAS build version state\n' >&2
  exit 1
fi

assert_symlink() {
  local link="$1"
  local target="$2"
  if [ ! -L "$link" ] || [ "$(readlink "$link")" != "$target" ]; then
    printf 'expected %s to be a symlink to %s\n' "$link" "$target" >&2
    exit 1
  fi
}

assert_symlink "$HOOK" "../skills/ios-build-workflow/hooks/ios-build-workflow.sh"
assert_symlink "$RUNNER" "../skills/ios-build-workflow/hooks/ios-build-workflow-runner.sh"
assert_symlink "$TEST_RUNNER" "../skills/ios-build-workflow/hooks/ios-build-workflow-test-runner.sh"
assert_symlink "$ROOT/.codex/hooks/ios-build-workflow-test.sh" "../skills/ios-build-workflow/hooks/ios-build-workflow-test.sh"
assert_symlink "$FASTPATH" "../.codex/skills/ios-build-workflow/scripts/native-testflight-fastpath.sh"

for executable in "$HOOK" "$RUNNER" "$FASTPATH"; do
  if [ ! -x "$executable" ]; then
    printf 'workflow script must retain its executable bit: %s\n' "$executable" >&2
    exit 1
  fi
done

assert_context() {
  local input="$1"
  local expected_mode="$2"
  local output
  local log_file
  log_file="$(mktemp)"
  TEMP_LOGS+=("$log_file")

  output="$(printf '%s' "$input" | env IOS_BUILD_WORKFLOW_RUNNER="$TEST_RUNNER" IOS_BUILD_WORKFLOW_TEST_LOG="$log_file" bash "$HOOK")"
  if [ "$(cat "$log_file")" != "$expected_mode" ]; then
    printf 'expected runner mode %s, got %s\n' "$expected_mode" "$(cat "$log_file")" >&2
    exit 1
  fi

  HOOK_OUTPUT="$output" EXPECTED_MODE="$expected_mode" node <<'NODE'
const payload = JSON.parse(process.env.HOOK_OUTPUT ?? '');
const specific = payload.hookSpecificOutput;
const mode = process.env.EXPECTED_MODE;

if (specific?.hookEventName !== 'UserPromptSubmit') {
  throw new Error(`unexpected hook event: ${specific?.hookEventName}`);
}

if (!specific.additionalContext.includes(`!ios-build ${mode}`)) {
  throw new Error(`hook context is missing the ${mode} command`);
}

if (!specific.additionalContext.includes('already ran')) {
  throw new Error('hook context does not prevent an automatic duplicate run');
}

for (const requiredPolicy of [
  'wait for its natural exit',
  'do not inspect, poll, edit, correct, interrupt, kill, or restart it',
]) {
  if (!specific.additionalContext.includes(requiredPolicy)) {
    throw new Error(`hook context is missing active-build protection: ${requiredPolicy}`);
  }
}
NODE
}

assert_silent() {
  local input="$1"
  local output
  output="$(printf '%s' "$input" | bash "$HOOK")"
  if [ -n "$output" ]; then
    printf 'expected silent hook, got: %s\n' "$output" >&2
    exit 1
  fi
}

assert_context '{"prompt":"!ios-build simulator"}' 'simulator'
assert_context '{"user_prompt":"!ios-build testflight"}' 'testflight'
assert_context '{"prompt":"!ios-build both"}' 'both'
assert_silent '{"prompt":"Build the iOS simulator app."}'
assert_silent '{"prompt":"!ios-build testflight now"}'
assert_silent '{"prompt":"Build the Android APK."}'
assert_silent '{"prompt":"Wie funktioniert TestFlight?"}'

RUNNER_TEXT="$(cat "$RUNNER")" FASTPATH_TEXT="$(cat "$FASTPATH")" SKILL_TEXT="$(cat "$SKILL")" RUNNER_PATH="$RUNNER" FASTPATH_PATH="$FASTPATH" node <<'NODE'
const runner = process.env.RUNNER_TEXT ?? '';
const fastpath = process.env.FASTPATH_TEXT ?? '';
const skill = process.env.SKILL_TEXT ?? '';
const path = process.env.RUNNER_PATH ?? '';
const fastpathPath = process.env.FASTPATH_PATH ?? '';
const testflight = runner.slice(runner.indexOf('run_testflight()'));

const status = testflight.indexOf('run_step bun run native:status');
const fastpathStep = testflight.indexOf('run_step bash "$FASTPATH"');
const fallback = testflight.lastIndexOf('run_testflight_rebuild_fallback');
const submit = testflight.indexOf('eas-cli submit --platform ios --profile preview-testflight');
if (status < 0 || fastpathStep < 0 || fallback < 0 || submit < 0 || !runner.includes('native:rebuild -- --target ios-preview-testflight')) {
  throw new Error(`TestFlight runner is missing a required build stage: ${path}`);
}
if (status > fastpathStep || fastpathStep > fallback || fallback > submit) {
  throw new Error(`TestFlight runner order must be status, fastpath, fallback, submit: ${path}`);
}
if (/native:(run|restore)/.test(runner)) {
  throw new Error('TestFlight runner must not use a locked or restored artifact');
}
if (!runner.includes('if [ ! -s "$ARTIFACT" ]')) {
  throw new Error('TestFlight runner must verify the fresh artifact before submit');
}
if (!runner.includes('run_simulator || simulator_status=$?')) {
  throw new Error('both mode must continue to TestFlight after a Simulator failure');
}
if (fastpath.includes('native:rebuild')) {
  throw new Error(`Fastpath must not rebuild: ${fastpathPath}`);
}
for (const [forbiddenProcessControl, pattern] of [
  ['ps', /\bps\b/],
  ['pgrep', /\bpgrep\b/],
  ['top', /\btop\b/],
  ['ccache -s', /\bccache -s\b/],
  ['kill', /\bkill\b/],
  ['pkill', /\bpkill\b/],
  ['killall', /\bkillall\b/],
  ['SIGINT', /\bSIGINT\b/],
  ['SIGTERM', /\bSIGTERM\b/],
]) {
  if (pattern.test(runner)) {
    throw new Error(`Runner must not intervene in an active process: ${forbiddenProcessControl}`);
  }
}
if (!fastpath.includes('CONFIGURATION_ERROR_STATUS=43') || !fastpath.includes('exit "$CONFIGURATION_ERROR_STATUS"')) {
  throw new Error(`Fastpath must stop before build for invalid remote version configuration: ${fastpathPath}`);
}
if (!testflight.includes('if [ "$fastpath_status" -eq 42 ]') || !testflight.includes('elif [ "$fastpath_status" -ne 0 ]')) {
  throw new Error(`Runner must only use rebuild fallback for cache-preflight exit 42: ${path}`);
}
for (const forbiddenRemoteMutation of ['build:version:set', 'build:version:sync']) {
  if (runner.includes(forbiddenRemoteMutation) || fastpath.includes(forbiddenRemoteMutation)) {
    throw new Error(`Workflow must not mutate remote EAS version state: ${forbiddenRemoteMutation}`);
  }
}
for (const forbiddenDottedBuildLogic of ['BUILD_PREFIX', 'BUILD_SUFFIX', '0.0.23']) {
  if (fastpath.includes(forbiddenDottedBuildLogic)) {
    throw new Error(`Fastpath must not create dotted CFBundleVersion values: ${forbiddenDottedBuildLogic}`);
  }
}
if (!fastpath.includes('must be an integer')) {
  throw new Error(`Fastpath must reject non-integer remote build numbers: ${fastpathPath}`);
}
if (!fastpath.includes('BUILD_SETTINGS_OUTPUT') || !fastpath.includes('escapes DerivedData')) {
  throw new Error(`Fastpath must fail closed when effective Xcode paths escape DerivedData: ${fastpathPath}`);
}
for (const requiredPolicy of [
  '## Bundled files',
  'compatibility symlinks',
  'through `bash`',
  'already ran',
  'do not invoke the hook, runner, or build command again',
  'do not retry automatically',
  'Do not use for Android',
  'Report each requested mode separately',
]) {
  if (!skill.includes(requiredPolicy)) {
    throw new Error(`Skill is missing required workflow guidance: ${requiredPolicy}`);
  }
}
for (const required of [
  'ccache',
  'DerivedData',
  'BUILD_INTERMEDIATES',
  'BUILD_PRODUCTS',
  'SHARED_PRECOMPS',
  'effective_build_setting',
  'assert_build_setting_under_derived_data',
  'OBJROOT="$BUILD_INTERMEDIATES"',
  'SYMROOT="$BUILD_PRODUCTS"',
  'SHARED_PRECOMPS_DIR="$SHARED_PRECOMPS"',
  'xcodebuild archive',
  'xcodebuild -exportArchive',
  'unzip -p',
  'plutil -extract CFBundleShortVersionString raw',
  'plutil -extract CFBundleVersion raw',
  '"$ACTUAL_APP_VERSION" != "$APP_VERSION"',
  '"$ACTUAL_BUILD" != "$NEW_BUILD"',
]) {
  if (!fastpath.includes(required)) {
    throw new Error(`Fastpath is missing ${required}: ${fastpathPath}`);
  }
}
if (!runner.includes('LOCK_DIR=') || !runner.includes('mkdir "$LOCK_DIR"') || !runner.includes('rmdir "$LOCK_DIR"')) {
  throw new Error(`Runner is missing the native workflow lock: ${path}`);
}
NODE

node - "$ROOT/.codex/skills/ios-build-workflow/evals/evals.json" <<'NODE'
const fs = require('node:fs');
const evalsPath = process.argv[2];
const data = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));

if (data.skill_name !== 'ios-build-workflow') {
  throw new Error(`Unexpected eval skill name: ${evalsPath}`);
}
if (!Array.isArray(data.evals) || data.evals.length < 2 || data.evals.length > 3) {
  throw new Error(`Expected 2-3 focused eval cases: ${evalsPath}`);
}
for (const evaluation of data.evals) {
  if (!Number.isInteger(evaluation.id) || !evaluation.prompt || !evaluation.expected_output) {
    throw new Error(`Eval case is missing id, prompt, or expected_output: ${evalsPath}`);
  }
  if (!Array.isArray(evaluation.assertions) || evaluation.assertions.length === 0) {
    throw new Error(`Eval case is missing observable assertions: ${evalsPath}`);
  }
}
if (!data.evals.some((evaluation) => evaluation.prompt === '!ios-build testflight')) {
  throw new Error(`Eval set is missing the primary TestFlight trigger: ${evalsPath}`);
}
if (!data.evals.some((evaluation) => evaluation.prompt.includes('starte keinen Build'))) {
  throw new Error(`Eval set is missing a should-not-trigger near miss: ${evalsPath}`);
}
if (!data.evals.some((evaluation) => evaluation.prompt.includes('native-build.lock'))) {
  throw new Error(`Eval set is missing the lock and permissions edge case: ${evalsPath}`);
}
NODE

PARSER_DEFINITION="$(sed -n '/^effective_build_setting() {/,/^}/p' "$FASTPATH")"
SETTINGS_OUTPUT="$(awk 'BEGIN { print "BUILD_DIR = /tmp/derived"; for (i = 0; i < 5000; i++) print "SETTING_" i " = /tmp/path" }')"
PARSER_OUTPUT=""
if ! PARSER_OUTPUT="$(BUILD_SETTINGS_OUTPUT="$SETTINGS_OUTPUT" bash -c "set -euo pipefail; $PARSER_DEFINITION; effective_build_setting BUILD_DIR")"; then
  printf 'effective_build_setting failed on large settings output\n' >&2
  exit 1
fi
if [ "$PARSER_OUTPUT" != '/tmp/derived' ]; then
  printf 'effective_build_setting returned %s instead of /tmp/derived\n' "$PARSER_OUTPUT" >&2
  exit 1
fi

node - "$ROOT/.codex/hooks.json" "$ROOT/.codex/hooks/hooks.json" <<'NODE'
const fs = require('node:fs');
const [projectConfigPath, pluginConfigPath] = process.argv.slice(2);
const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
const pluginConfig = JSON.parse(fs.readFileSync(pluginConfigPath, 'utf8'));
const registrations = projectConfig.hooks?.UserPromptSubmit ?? [];
const registration = registrations
  .flatMap((entry) => entry.hooks ?? [])
  .find((hook) => hook.command?.includes('ios-build-workflow.sh'));

if (!registration) throw new Error(`missing iOS workflow registration in ${projectConfigPath}`);
if (registration.timeout !== 5400) throw new Error(`unexpected hook timeout in ${projectConfigPath}`);

if (JSON.stringify(pluginConfig).includes('ios-build-workflow.sh')) {
  throw new Error(`iOS workflow must not be registered in plugin config ${pluginConfigPath}`);
}

if (!registration.command.includes('bash') || !registration.command.includes('.codex/hooks/ios-build-workflow.sh')) {
  throw new Error(`iOS workflow registration must invoke the skill hook through bash: ${projectConfigPath}`);
}
NODE

echo 'ios-build-workflow hook tests OK'
