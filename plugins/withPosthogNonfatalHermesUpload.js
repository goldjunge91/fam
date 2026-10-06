const { IOSConfig, withFinalizedMod } = require('expo/config-plugins');
const { readFileSync, writeFileSync } = require('fs');

const APP_TARGET_NAME = 'fam';
const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const POSTHOG_XCODE_INVOCATION =
  '`"$NODE_BINARY" --print "require(\'path\').join(require(\'path\').dirname(require.resolve(\'posthog-react-native\')), \'..\', \'tooling\', \'posthog-xcode.sh\')"`';

function decodePbxShellScript(value) {
  const shellScript = String(value ?? '');
  if (!shellScript.startsWith('"') || !shellScript.endsWith('"')) return shellScript;
  return shellScript.slice(1, -1).replace(/\\(.)/g, (_match, character) => {
    if (character === 'n') return '\n';
    if (character === 't') return '\t';
    return character;
  });
}

function encodePbxShellScript(value) {
  const encoded = value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"');
  return `"${encoded}"`;
}

function wrapHermesUpload(projectRoot) {
  const pbxPath = IOSConfig.Paths.getPBXProjectPath(projectRoot);
  const contents = readFileSync(pbxPath, 'utf8');
  const nativeTargetsStart = contents.indexOf('/* Begin PBXNativeTarget section */');
  const nativeTargetsEnd = contents.indexOf('/* End PBXNativeTarget section */', nativeTargetsStart);
  if (nativeTargetsStart === -1 || nativeTargetsEnd === -1) {
    throw new Error('withPosthogNonfatalHermesUpload: PBXNativeTarget section not found');
  }
  const appTargetOffset = contents.indexOf(`/* ${APP_TARGET_NAME} */ = {`, nativeTargetsStart);
  if (appTargetOffset === -1 || appTargetOffset >= nativeTargetsEnd) {
    throw new Error(`withPosthogNonfatalHermesUpload: target '${APP_TARGET_NAME}' not found`);
  }
  const targetEnd = contents.indexOf('\t\t\tbuildRules = (', appTargetOffset);
  const target = contents.slice(appTargetOffset, targetEnd);
  const phaseCommentOffset = target.indexOf(`/* ${BUNDLE_PHASE_NAME} */`);
  const phaseRef = target.slice(0, phaseCommentOffset).match(/([A-F0-9]+)\s*$/);
  if (phaseCommentOffset === -1 || !phaseRef) {
    throw new Error(`withPosthogNonfatalHermesUpload: phase '${BUNDLE_PHASE_NAME}' not found`);
  }

  const phaseStart = contents.indexOf(`${phaseRef[1]} /* ${BUNDLE_PHASE_NAME} */ = {`);
  const phaseEnd = contents.indexOf('\n\t\t};', phaseStart);
  if (phaseStart === -1 || phaseEnd === -1) {
    throw new Error(`withPosthogNonfatalHermesUpload: phase '${BUNDLE_PHASE_NAME}' body not found`);
  }
  const phase = contents.slice(phaseStart, phaseEnd);
  const shellMatch = phase.match(/shellScript = ("(?:\\.|[^"\\])*");/);
  if (!shellMatch) {
    throw new Error(`withPosthogNonfatalHermesUpload: phase '${BUNDLE_PHASE_NAME}' script not found`);
  }
  const shellScript = decodePbxShellScript(shellMatch[1]);
  if (!shellScript.includes(POSTHOG_XCODE_INVOCATION)) {
    throw new Error('withPosthogNonfatalHermesUpload: PostHog bundle wrapper invocation not found');
  }

  const wrapperPath = '"${SRCROOT}/../scripts/posthog-xcode-tolerant.sh"';
  const updatedPhase = phase.replace(
    shellMatch[1],
    encodePbxShellScript(shellScript.replace(POSTHOG_XCODE_INVOCATION, wrapperPath)),
  );
  writeFileSync(pbxPath, contents.slice(0, phaseStart) + updatedPhase + contents.slice(phaseEnd));
}

module.exports = function withPosthogNonfatalHermesUpload(config) {
  return withFinalizedMod(config, [
    'ios',
    (config) => {
      wrapHermesUpload(config.modRequest.projectRoot);
      return config;
    },
  ]);
};
