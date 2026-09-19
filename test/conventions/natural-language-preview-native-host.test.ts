import fs from 'node:fs';
import path from 'node:path';

const previewPath = path.join(
  __dirname,
  '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/components/natural-language-addition-swift-ui-preview.ios.tsx',
);
const previewContentPath = path.join(
  __dirname,
  '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/components/natural-language-addition-swift-ui-preview-content.tsx',
);

describe('natural language preview native host convention', () => {
  it('keeps the hosted preview content fill-sized for native touch routing', () => {
    const source = fs.readFileSync(previewPath, 'utf8');

    expect(source).toContain('<RNHostView>');
    expect(source).toContain('flexGrow: 1');
    expect(source).toContain('height: 0');
    expect(source).toContain("width: '100%'");
  });

  it('gives the hosted preview sheet an explicit width and minimum height', () => {
    const source = fs.readFileSync(previewContentPath, 'utf8');

    expect(source).toContain("width: '100%'");
    expect(source).toContain('minHeight: theme.space.xxxl * 6');
  });

  it('keeps the dev-only capture section after long preview rows', () => {
    const source = fs.readFileSync(previewContentPath, 'utf8');
    const testPanelIndex = source.indexOf('testID="natural-language-addition-test-panel"');
    const rowsIndex = source.indexOf('<View style={styles.rows}>');

    expect(testPanelIndex).toBeGreaterThan(-1);
    expect(rowsIndex).toBeGreaterThan(-1);
    expect(testPanelIndex).toBeGreaterThan(rowsIndex);
  });
});
