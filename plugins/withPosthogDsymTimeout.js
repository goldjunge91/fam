const { IOSConfig, withBaseMod, withFinalizedMod } = require('expo/config-plugins');
const { readFileSync, writeFileSync } = require('fs');

const APP_TARGET_NAME = 'fam';
const POSTHOG_PHASE_NAME = 'Upload PostHog Debug Symbols';
const DSYM_TIMEOUT_SECONDS = 300;
// Matches PostHog's manual iOS setup: the main DWARF is declared as an input so Xcode produces
// the dSYM before the upload phase runs instead of racing it.
const DSYM_INPUT_PATH =
  '"$(DWARF_DSYM_FOLDER_PATH)/$(DWARF_DSYM_FILE_NAME)/Contents/Resources/DWARF/$(EXECUTABLE_NAME)"';

function withoutQuotes(value) {
  return String(value ?? '').replace(/^"|"$/g, '');
}

function decodePbxShellScript(value) {
  const shellScript = String(value ?? '');
  if (!shellScript.startsWith('"') || !shellScript.endsWith('"')) {
    return shellScript;
  }
  return shellScript.slice(1, -1).replace(/\\(.)/g, (_match, character) => {
    if (character === 'n') return '\n';
    if (character === 't') return '\t';
    return character;
  });
}

function encodePbxShellScript(value) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

// Adds the dSYM input declaration and the longer timeout to the phase, so Xcode orders
// dSYM generation before the upload. Runs after the rest of the xcode mod chain.
function patchPosthogPhase(config) {
  const project = config.modResults;
  const target = project.pbxTargetByName(APP_TARGET_NAME);
  if (!target) {
    throw new Error(`withPosthogDsymTimeout: target '${APP_TARGET_NAME}' not found`);
  }
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
  const phaseIndex = target.buildPhases.findIndex(
    ({ value }) => withoutQuotes(phases[value]?.name) === POSTHOG_PHASE_NAME,
  );
  if (phaseIndex === -1) {
    throw new Error(
      `withPosthogDsymTimeout: phase '${POSTHOG_PHASE_NAME}' not found on target '${APP_TARGET_NAME}'`,
    );
  }
  const posthogPhase = phases[target.buildPhases[phaseIndex].value];
  const timeoutExport = `export POSTHOG_DSYM_TIMEOUT=${DSYM_TIMEOUT_SECONDS}`;
  const shellScript = decodePbxShellScript(posthogPhase.shellScript);
  if (!shellScript.includes(timeoutExport)) {
    posthogPhase.shellScript = encodePbxShellScript(`${timeoutExport}\n${shellScript}`);
  }
  const inputPaths = Array.isArray(posthogPhase.inputPaths) ? posthogPhase.inputPaths : [];
  if (!inputPaths.includes(DSYM_INPUT_PATH)) {
    posthogPhase.inputPaths = [...inputPaths, DSYM_INPUT_PATH];
  }
  return config;
}

// @bacons/apple-targets writes the project through its own later mod, so it can leave the
// watch/extension embed phases after PostHog's upload phase even when our patch ran last. A
// finalized mod is guaranteed to run after every other mod; it moves the phase entry to the end
// of the fam target's buildPhases list with a surgical edit so the rest of the project is
// untouched.
function movePosthogPhaseToEnd(projectRoot) {
  const pbxPath = IOSConfig.Paths.getPBXProjectPath(projectRoot);
  const contents = readFileSync(pbxPath, 'utf8');
  const targetStart = contents.indexOf(`/* ${APP_TARGET_NAME} */ = {`);
  if (targetStart === -1) {
    throw new Error(`withPosthogDsymTimeout: '${APP_TARGET_NAME}' target block not found`);
  }
  const targetEnd = contents.indexOf('\t\t\tbuildRules = (', targetStart);
  if (targetEnd === -1) {
    throw new Error(`withPosthogDsymTimeout: '${APP_TARGET_NAME}' buildRules block not found`);
  }
  const famTarget = contents.slice(targetStart, targetEnd);
  const match = famTarget.match(/\t\t\tbuildPhases = \(\n([\s\S]*?)\t\t\t\);/);
  if (!match) {
    throw new Error(`withPosthogDsymTimeout: '${APP_TARGET_NAME}' buildPhases block not found`);
  }
  const [block, body] = match;
  const lines = body.split('\n').filter((line) => line.trim().length > 0);
  const phaseLine = lines.find((line) => line.includes(`/* ${POSTHOG_PHASE_NAME} */`));
  if (!phaseLine) {
    throw new Error(`withPosthogDsymTimeout: '${POSTHOG_PHASE_NAME}' not found in fam buildPhases`);
  }
  if (lines[lines.length - 1] === phaseLine) {
    return false;
  }
  const reordered = [...lines.filter((line) => line !== phaseLine), phaseLine].join('\n');
  const replacement = `\t\t\tbuildPhases = (\n${reordered}\n\t\t\t);`;
  writeFileSync(pbxPath, contents.replace(block, () => replacement));
  return true;
}

module.exports = function withPosthogDsymTimeout(config) {
  config = withBaseMod(config, {
    platform: 'ios',
    mod: 'xcodeproj',
    async action(config) {
      const { nextMod, ...modRequest } = config.modRequest;
      const results = await nextMod({ ...config, modRequest });
      return patchPosthogPhase(results);
    },
  });

  return withFinalizedMod(config, [
    'ios',
    (config) => {
      movePosthogPhaseToEnd(config.modRequest.projectRoot);
      return config;
    },
  ]);
};
