import fs from 'node:fs';
import path from 'node:path';

const contractPath = path.join(
  __dirname,
  '../../docs/design-system/contracts/11-modal-and-sheets.md',
);

describe('modal and sheets contract', () => {
  it('defines the native iOS presentation boundaries and lifecycle rules', () => {
    const contract = fs.readFileSync(contractPath, 'utf8');

    expect(contract).toContain('# Vertrag: Modal und Sheets');
    expect(contract).toContain('`Modal` aus `react-native`');
    expect(contract).toContain('`BottomSheet` aus `@expo/ui/swift-ui`');
    expect(contract).toContain('`ConfirmationDialog` aus `@expo/ui/swift-ui`');
    expect(contract).toContain('`isPresented`');
    expect(contract).toContain('`onIsPresentedChange`');
    expect(contract).toContain('`presentationDetents`');
    expect(contract).toContain('`onRequestClose`');
    expect(contract).toContain('Safe Area');
    expect(contract).toContain('VoiceOver');
    expect(contract).toContain('44 × 44');
    expect(contract).toContain(
      '`@expo/ui/community/bottom-sheet` wird auf iOS nicht weiter verwendet',
    );
  });
});
