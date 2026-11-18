import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const launchFlow = readFileSync(
  join(process.cwd(), '.maestro', 'ios', 'subflows', 'launch-local-dev-client.yaml'),
  'utf8',
);

describe('iOS local dev-client launch flow', () => {
  it('keeps native open confirmation conditional without a fixed delay when absent', () => {
    const openLinkIndex = launchFlow.indexOf('- openLink:');
    const fixedOpenWait = launchFlow.indexOf(
      '- extendedWaitUntil:\n    visible: "^(Open|Öffnen)$"\n    timeout: 30000\n    optional: true',
    );
    const acceptanceIndex = launchFlow.indexOf(
      '- runFlow:\n    when:\n      visible: \'^(Open in "fam"|In .* öffnen\\?)$\'',
    );

    expect(openLinkIndex).toBeGreaterThanOrEqual(0);
    expect(fixedOpenWait).toBe(-1);
    expect(acceptanceIndex).toBeGreaterThan(openLinkIndex);
    expect(launchFlow).toContain(
      '- extendedWaitUntil:\n    visible: "Weiter"\n    timeout: 120000',
    );
  });

  it('keeps a manual Dev Client fallback tied to the plain Metro URL', () => {
    expect(launchFlow).toContain('METRO_URL: ${METRO_URL || "http://127.0.0.1:8081"}');
    expect(launchFlow).toContain('METRO_MANIFEST_URL: ${METRO_MANIFEST_URL || ""}');
    expect(launchFlow).toContain(
      'evalScript: ${output.metroManifestUrl = METRO_MANIFEST_URL || encodeURIComponent(METRO_URL)}',
    );
    expect(launchFlow).toContain('optional: true');
    expect(launchFlow).toContain('visible: "Enter URL manually"');
    expect(launchFlow).toContain('inputText: "${METRO_URL}"');
    expect(launchFlow).toContain('tapOn: "Connect"');
  });
});
