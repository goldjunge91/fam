import fs from 'node:fs';
import path from 'node:path';

const showcasePath = path.join(
  __dirname,
  '../../src/features/settings/dev/design-system/showcase-components.tsx',
);
const contractPath = path.join(__dirname, '../../docs/design-system/contracts/12-date-picker.md');

describe('native date picker showcase convention', () => {
  it('documents a controlled SwiftUI DatePicker without implying a product migration', () => {
    const source = fs.readFileSync(showcasePath, 'utf8');
    const contract = fs.readFileSync(contractPath, 'utf8');

    expect(source).toContain('<Subsection title="Native iOS-DatePicker">');
    expect(source).toContain('<NativeDatePickerExample />');
    expect(source).toContain('<SwiftUIDatePicker');
    expect(source).toContain('selection={selectedDate}');
    expect(source).toContain('onDateChange={setSelectedDate}');
    expect(source).toContain("datePickerStyle('compact')");
    expect(contract).toContain('# Vertrag: Native iOS-DatePicker');
    expect(contract).toContain('`selection`');
    expect(contract).toContain('`onDateChange`');
    expect(contract).toContain('`datePickerStyle`');
    expect(contract).toContain('date-wheel-field.tsx');
    expect(contract).toContain('kein Sheet');
  });
});
