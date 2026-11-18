import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const launchFlow = readFileSync(
  join(process.cwd(), '.maestro', 'ios', 'subflows', 'launch-local-dev-client.yaml'),
  'utf8',
);
describe('iOS local dev-client launch flow', () => {
  it('uses clipboard paste for the explicit localhost Dev Client Home path', () => {
    expect(launchFlow).toContain('METRO_URL: ${METRO_URL || "http://127.0.0.1:8081"}');
    expect(launchFlow).not.toContain('METRO_MANIFEST_URL');
    expect(launchFlow).not.toContain('openLink');
    expect(launchFlow).not.toContain('optional: true');
    expect(launchFlow).not.toContain('inputText: "${METRO_URL}"');
    const manualWaitIndex = launchFlow.indexOf(
      '- extendedWaitUntil:\n    visible: "Enter URL manually"\n    timeout: 120000',
    );
    const manualTapIndex = launchFlow.indexOf('- tapOn: "Enter URL manually"');
    const setClipboardIndex = launchFlow.indexOf('- setClipboard: "${METRO_URL}"');
    const pasteIndex = launchFlow.indexOf('- pasteText', setClipboardIndex);
    const connectIndex = launchFlow.indexOf('- tapOn: "Connect"');
    expect(manualWaitIndex).toBeGreaterThanOrEqual(0);
    expect(manualTapIndex).toBeGreaterThan(manualWaitIndex);
    expect(setClipboardIndex).toBeGreaterThan(manualTapIndex);
    expect(pasteIndex).toBeGreaterThan(setClipboardIndex);
    expect(connectIndex).toBeGreaterThan(pasteIndex);
  });
  it('requires the Famm onboarding signal before the generic continue control', () => {
    const onboardingReadyIndex = launchFlow.indexOf(
      '- extendedWaitUntil:\n    visible: "Willkommen"\n    timeout: 120000',
    );
    const continueReadyIndex = launchFlow.indexOf(
      '- extendedWaitUntil:\n    visible: "Weiter"\n    timeout: 120000',
    );
    expect(onboardingReadyIndex).toBeGreaterThanOrEqual(0);
    expect(continueReadyIndex).toBeGreaterThan(onboardingReadyIndex);
  });
});
