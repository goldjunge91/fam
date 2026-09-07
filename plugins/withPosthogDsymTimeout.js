const { withXcodeProject } = require('expo/config-plugins');

const APP_TARGET_NAME = 'fam';
const POSTHOG_PHASE_NAME = 'Upload PostHog Debug Symbols';
const DSYM_TIMEOUT_SECONDS = 300;

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

module.exports = function withPosthogDsymTimeout(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const target = project.pbxTargetByName(APP_TARGET_NAME);

    if (!target) {
      throw new Error(`withPosthogDsymTimeout: target '${APP_TARGET_NAME}' not found`);
    }

    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const posthogPhase = target.buildPhases
      .map(({ value }) => phases[value])
      .find((phase) => withoutQuotes(phase?.name) === POSTHOG_PHASE_NAME);

    if (!posthogPhase) {
      throw new Error(
        `withPosthogDsymTimeout: phase '${POSTHOG_PHASE_NAME}' not found on target '${APP_TARGET_NAME}'`,
      );
    }

    const timeoutExport = `export POSTHOG_DSYM_TIMEOUT=${DSYM_TIMEOUT_SECONDS}`;
    const shellScript = decodePbxShellScript(posthogPhase.shellScript);

    if (!shellScript.includes(timeoutExport)) {
      posthogPhase.shellScript = encodePbxShellScript(`${timeoutExport}\n${shellScript}`);
    }

    return config;
  });
};
