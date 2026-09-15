import fs from 'node:fs';
import path from 'node:path';

const featureRoot = path.join(__dirname, '../../src/features/shopping-list/sheets');

function readSheet(fileName: string): string {
  return fs.readFileSync(path.join(featureRoot, fileName), 'utf8');
}

describe('native sheet product consumer convention', () => {
  it('uses direct SwiftUI presentation on iOS', () => {
    for (const fileName of ['category-order-sheet.tsx', 'complete-run-sheet.tsx']) {
      const source = readSheet(fileName);

      expect(source).toContain("from '@expo/ui/swift-ui'");
      expect(source).toContain('<RNHostView>');
      expect(source).toContain('presentationDetents');
      expect(source).toContain('presentationDragIndicator');
      expect(source).toContain('paddingTop: theme.space.lg');
      expect(source).not.toContain('@expo/ui/community/bottom-sheet');
    }
  });

  it('keeps the Android adapters free of SwiftUI imports', () => {
    for (const fileName of ['category-order-sheet.android.tsx', 'complete-run-sheet.android.tsx']) {
      const source = readSheet(fileName);

      expect(source).toContain('@expo/ui/community/bottom-sheet');
      expect(source).not.toContain('@expo/ui/swift-ui');
    }
  });
});
