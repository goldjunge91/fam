import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { DateWheelField } from './date-wheel-field.android';
import { TimeWheelField } from './time-wheel-field.android';
import { WheelPickerField, type WheelPickerOption } from './wheel-picker-field.android';

type DateTimePickerProps = {
  value: Date;
  mode: 'date' | 'time';
  presentation?: 'dialog';
  onValueChange: (_event: unknown, date: Date) => void;
  onDismiss?: () => void;
};

type WheelPickerProps = {
  selectedValue: string;
  onValueChange: (value: string) => void;
  children?: ReactNode;
};

const mockDateTimePicker = jest.fn((_props: DateTimePickerProps) => null);
const mockPickerRender = jest.fn((_props: WheelPickerProps) => null);

jest.mock('@expo/ui/community/datetime-picker', () => ({
  __esModule: true,
  default: (props: DateTimePickerProps) => {
    mockDateTimePicker(props);
    return null;
  },
}));

jest.mock('@expo/ui/community/picker', () => {
  const Picker = (props: WheelPickerProps) => {
    mockPickerRender(props);
    return null;
  };
  Picker.Item = () => null;

  return { Picker };
});

function lastDateTimePickerProps(): DateTimePickerProps {
  const props = mockDateTimePicker.mock.calls.at(-1)?.[0];
  if (!props) throw new Error('Der native Datums- oder Zeitpicker wurde nicht gerendert');
  return props;
}

function lastWheelPickerProps(): WheelPickerProps {
  const props = mockPickerRender.mock.calls.at(-1)?.[0];
  if (!props) throw new Error('Der native Auswahlpicker wurde nicht gerendert');
  return props;
}

beforeEach(() => {
  mockDateTimePicker.mockClear();
  mockPickerRender.mockClear();
});

describe('Android wheel fields', () => {
  it('updates the date from the dialog and falls back to a label when omitted', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    await render(<DateWheelField label="Startdatum" value="2024-01-02" onChange={onChange} />);
    await user.press(screen.getByRole('button', { name: 'Startdatum 02.01.2024 ändern' }));

    expect(lastDateTimePickerProps()).toEqual(
      expect.objectContaining({ mode: 'date', presentation: 'dialog' }),
    );
    await act(async () => {
      lastDateTimePickerProps().onValueChange({}, new Date(2025, 5, 6));
    });
    expect(onChange).toHaveBeenCalledWith('2025-06-06');

    const emptyChange = jest.fn();
    await render(<DateWheelField value="" onChange={emptyChange} />);
    await user.press(screen.getByRole('button', { name: 'Datum auswählen' }));
    await act(async () => {
      lastDateTimePickerProps().onDismiss?.();
    });

    expect(emptyChange).not.toHaveBeenCalled();
  });

  it('converts a selected time and dismisses a later dialog', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    await render(<TimeWheelField value="" onChange={onChange} />);
    await user.press(screen.getByRole('button', { name: 'Uhrzeit auswählen' }));

    expect(lastDateTimePickerProps().mode).toBe('time');
    await act(async () => {
      lastDateTimePickerProps().onValueChange({}, new Date(2025, 5, 6, 13, 45));
    });
    expect(onChange).toHaveBeenCalledWith('13:45');

    await render(<TimeWheelField label="Erinnerung" value="08:00" onChange={onChange} />);
    await user.press(screen.getByRole('button', { name: 'Erinnerung 08:00 ändern' }));
    await act(async () => {
      lastDateTimePickerProps().onDismiss?.();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('passes options and selected values through to the native picker', async () => {
    const options: readonly WheelPickerOption[] = [
      { value: 'g', label: 'Gramm' },
      { value: 'kg', label: 'Kilogramm' },
    ];
    const onChange = jest.fn();

    await render(
      <WheelPickerField
        label="Einheit"
        value="g"
        options={options}
        onChange={onChange}
        accessibilityLabel="Einheit ändern"
      />,
    );

    expect(screen.getByRole('button', { name: 'Einheit ändern' })).toBeOnTheScreen();
    expect(screen.getByText('Einheit')).toBeOnTheScreen();
    expect(lastWheelPickerProps().selectedValue).toBe('g');
    expect(lastWheelPickerProps().children).toHaveLength(2);
    lastWheelPickerProps().onValueChange('kg');
    expect(onChange).toHaveBeenCalledWith('kg');

    await render(<WheelPickerField value="" options={[]} onChange={onChange} />);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
