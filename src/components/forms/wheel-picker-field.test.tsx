import { render, screen, userEvent } from '@testing-library/react-native';

import { UNIT_OPTIONS } from '@/lib/units';

import { WheelPickerField } from './wheel-picker-field';

/**
 * `WheelPickerField` delegiert die Auswahl an den nativen Picker aus
 * `@expo/ui`. Dessen `Picker.Item` ist eine reine Daten-Komponente ohne
 * eigenen Baumknoten (siehe `node_modules/@expo/ui/src/community/picker/types.tsx`),
 * die Optionen lassen sich unter Jest also nicht durchtippen.
 *
 * Deshalb wird die native Grenze gemockt und über einen Spying beobachtet —
 * dasselbe Muster wie `datetime-picker` in `wheel-fields.test.tsx`.
 *
 * `Picker` ist ein SwiftUI-`Host` aus `@expo/ui`. Unter Jest existiert diese
 * native Instanz nicht — das Wheel lässt sich weder rendern noch per Geste
 * drehen. Geprüft wird deshalb der Vertrag der Komponente: welcher Wert und
 * welche Optionen gehen an das Native-Modul, und was `onChange` bei
 * `Übernehmen` bzw. `Abbrechen` bekommt. Das Verhalten des Rads selbst
 * gehört auf das Gerät (manuell), nicht in diese Suite.
 */
type PickerProps = {
  selectedValue: string;
  onValueChange: (value: string) => void;
  children: { props: { value: string; label: string } }[];
};

const mockPickerRender = jest.fn();

jest.mock('@expo/ui/community/picker', () => {
  // Der Spying wird erst beim Rendern des Pickers aufgerufen, nicht beim
  // Anlegen der Factory — bis dahin ist die Konstante initialisiert.
  const Picker = (props: PickerProps) => {
    mockPickerRender(props);
    return null;
  };
  Picker.Item = () => null;

  return { __esModule: true, default: Picker, Picker };
});

/** Props des zuletzt gerenderten nativen Pickers. */
function lastPickerProps(): PickerProps {
  const call = mockPickerRender.mock.calls.at(-1);
  if (!call) throw new Error('Picker wurde nicht gerendert');
  return call[0];
}

beforeEach(() => {
  mockPickerRender.mockClear();
});

describe('WheelPickerField', () => {
  it('übergibt den aktuellen Wert und alle Optionen an den nativen Picker', async () => {
    const user = userEvent.setup();

    await render(
      <WheelPickerField
        label="Einheit"
        value="piece"
        options={UNIT_OPTIONS}
        onChange={jest.fn()}
      />,
    );
    await user.press(screen.getByRole('button', { name: 'Einheit Stück ändern' }));

    const props = lastPickerProps();
    expect(props.selectedValue).toBe('piece');
    expect(props.children.map((child) => child.props.value)).toEqual(
      UNIT_OPTIONS.map((option) => option.value),
    );
  });

  it('meldet die ausgewählte Einheit beim Übernehmen nach außen', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    await render(
      <WheelPickerField label="Einheit" value="piece" options={UNIT_OPTIONS} onChange={onChange} />,
    );
    await user.press(screen.getByRole('button', { name: 'Einheit Stück ändern' }));

    lastPickerProps().onValueChange('g');
    await user.press(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(onChange).toHaveBeenCalledWith('g');
  });

  it('verwirft eine Auswahl beim Abbrechen', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    await render(
      <WheelPickerField label="Einheit" value="piece" options={UNIT_OPTIONS} onChange={onChange} />,
    );
    await user.press(screen.getByRole('button', { name: 'Einheit Stück ändern' }));

    lastPickerProps().onValueChange('kg');
    await user.press(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).not.toBeOnTheScreen();
  });

  it('übernimmt beim nächsten Öffnen den von außen gesetzten Wert statt der zuletzt gewählten', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    const { rerender } = await render(
      <WheelPickerField label="Einheit" value="piece" options={UNIT_OPTIONS} onChange={onChange} />,
    );
    await user.press(screen.getByRole('button', { name: 'Einheit Stück ändern' }));
    lastPickerProps().onValueChange('kg');
    await user.press(screen.getByRole('button', { name: 'Abbrechen' }));

    // Der äußere Wert ändert sich, während das Feld nie bestätigt wurde.
    await rerender(
      <WheelPickerField label="Einheit" value="ml" options={UNIT_OPTIONS} onChange={onChange} />,
    );
    await user.press(screen.getByRole('button', { name: 'Einheit Milliliter (ml) ändern' }));

    expect(lastPickerProps().selectedValue).toBe('ml');
    expect(onChange).not.toHaveBeenCalled();
  });
});
