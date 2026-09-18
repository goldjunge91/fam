import fs from 'node:fs';
import path from 'node:path';

const previewPath = path.join(
  __dirname,
  '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/components/natural-language-addition-swift-ui-preview.ios.tsx',
);

describe('natural language preview native host convention', () => {
  it('keeps the hosted preview content fill-sized for native touch routing', () => {
    const source = fs.readFileSync(previewPath, 'utf8');

    expect(source).toContain('<RNHostView>');
    expect(source).toContain('flex: 1');
    expect(source).not.toContain('height: 0');
  });
});
