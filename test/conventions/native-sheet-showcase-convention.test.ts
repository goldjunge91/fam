import fs from 'node:fs';
import path from 'node:path';

const showcasePath = path.join(
  __dirname,
  '../../src/features/settings/dev/design-system/showcase-components.tsx',
);

describe('native sheet showcase convention', () => {
  it('documents modal, bottom-sheet, and action-sheet semantics in one showcase section', () => {
    const source = fs.readFileSync(showcasePath, 'utf8');

    expect(source).toContain('@expo/ui/swift-ui');
    expect(source).toMatch(/<Subsection title="Modal und Sheets"\s*>/u);
    expect(source).toContain('<ClassicModalDemo />');
    expect(source).toContain('<ClassicBottomSheetDemo />');
    expect(source).toContain('<NativeBottomSheetExample />');
    expect(source).toContain('<NativeActionSheetExample />');
    expect(source).toContain('<SwiftUIBottomSheet');
    expect(source).toContain('presentationDetents');
    expect(source).toContain('<ConfirmationDialog.Trigger>');
    expect(source).toContain('<ConfirmationDialog.Actions>');
    expect(source).toContain('role={NATIVE_DESTRUCTIVE_ROLE}');
    expect(source).not.toContain('@expo/ui/community/bottom-sheet');
  });
});
