import { readFile } from 'node:fs/promises';
import path from 'node:path';

const flowPath = path.resolve(
  process.cwd(),
  '.maestro/ios/flows/speech/speech-dataset-finish.yaml',
);
const openFlowPath = path.resolve(
  process.cwd(),
  '.maestro/ios/flows/speech/speech-dataset-open.yaml',
);
const preserveStateFlowPath = path.resolve(
  process.cwd(),
  '.maestro/ios/subflows/launch-local-dev-client-preserve-state.yaml',
);
const cleanupFlowPath = path.resolve(
  process.cwd(),
  '.maestro/ios/flows/speech/speech-dataset-cleanup.yaml',
);

describe('speech dataset finish flow', () => {
  it('saves the preview test capture before closing with Später', async () => {
    const flow = await readFile(flowPath, 'utf8');

    const saveSelector = flow.indexOf('natural-language-addition-test-save');
    const savedStatus = flow.indexOf('Testergebnis gespeichert');
    const laterAction = flow.lastIndexOf('- tapOn: "Später"');
    const expandSheet = flow.indexOf('- swipe:');
    const scrollToTestCapture = flow.indexOf('- scrollUntilVisible:');
    const saveRetry = flow.indexOf('- retry:');
    const finishAction = flow.indexOf('- tapOn: "Fertig"');

    expect(saveSelector).toBeGreaterThan(-1);
    expect(savedStatus).toBeGreaterThan(saveSelector);
    expect(flow).not.toContain('visible: "Später"');
    const previewHeading = flow.indexOf('visible: "Passt das so?"');
    expect(previewHeading).toBeGreaterThan(finishAction);
    expect(expandSheet).toBeGreaterThan(previewHeading);
    expect(scrollToTestCapture).toBeGreaterThan(expandSheet);
    expect(saveRetry).toBeGreaterThan(scrollToTestCapture);
    expect(flow).toContain('maxRetries: 1');
    expect(flow.match(/id: "natural-language-addition-test-save"/gu)).toHaveLength(2);
    expect(savedStatus).toBeGreaterThan(saveRetry);
    expect(laterAction).toBeGreaterThan(savedStatus);
    expect(flow).not.toContain('Artikel hinzufügen');
  });

  it('reuses the running app instead of reopening the dev client per audio fixture', async () => {
    const [openFlow, preserveStateFlow] = await Promise.all([
      readFile(openFlowPath, 'utf8'),
      readFile(preserveStateFlowPath, 'utf8'),
    ]);

    expect(openFlow).toContain('launch-local-dev-client-preserve-state.yaml');
    expect(openFlow).toContain('Neu hinzufügen');
    expect(openFlow.match(/tapOn: "Neu hinzufügen"/gu)).toHaveLength(1);
    expect(openFlow.indexOf('Ich höre zu')).toBeGreaterThan(openFlow.indexOf('Spracheingabe'));
    expect(preserveStateFlow).not.toMatch(/^\s*-\s+(stopApp|launchApp|openLink)\b/m);
  });

  it('keeps both cleanup branches optional for either modal state', async () => {
    const cleanupFlow = await readFile(cleanupFlowPath, 'utf8');

    expect(cleanupFlow).toContain('visible: "Später"');
    expect(cleanupFlow).toContain('visible: "Abbrechen"');
    expect(cleanupFlow).toContain('text: "Später"\n          optional: true');
    expect(cleanupFlow).toContain('text: "Abbrechen"\n          optional: true');
  });
});
