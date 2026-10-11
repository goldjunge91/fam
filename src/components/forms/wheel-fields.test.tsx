import { act, render, screen, userEvent } from '@testing-library/react-native';
import { DateWheelField } from './date-wheel-field';
import { DateWheelField as AndroidDateWheelField } from './date-wheel-field.android';
import { TimeWheelField } from './time-wheel-field';

let mockThemeMode: 'light' | 'dark' = 'dark';

type DateTimePickerProps = {
  value: Date;
  mode: 'date' | 'time';
  themeVariant?: 'light' | 'dark';
  onValueChange: (_event: unknown, date: Date) => void;
  onDismiss?: () => void;
};

const mockDateTimePicker = jest.fn((_props: DateTimePickerProps) => null);

jest.mock('@expo/ui/community/datetime-picker', () => ({
  __esModule: true,
  default: (props: DateTimePickerProps) => {
    mockDateTimePicker(props);
    return null;
  },
}));

jest.mock('@/components/theme/ThemeProvider', () => {
  const actual = jest.requireActual(
    '@/components/theme/ThemeProvider',
  ) as typeof import('@/components/theme/ThemeProvider');

  return {
    ...actual,
    useTheme: () => ({ ...actual.useTheme(), mode: mockThemeMode }),
  };
});

describe('wheel fields', () => {
  beforeEach(() => {
    mockDateTimePicker.mockClear();
    mockThemeMode = 'dark';
  });

  it.each(['dark', 'light'] as const)(
    'passes the resolved %s mode to the iOS pickers',
    async (mode) => {
      const user = userEvent.setup();
      mockThemeMode = mode;
      await render(<DateWheelField value="" onChange={jest.fn()} />);
      await user.press(screen.getByRole('button', { name: 'Datum auswählen' }));
      expect(mockDateTimePicker).toHaveBeenLastCalledWith(
        expect.objectContaining({ themeVariant: mode }),
      );

      mockDateTimePicker.mockClear();
      await render(<TimeWheelField value="" onChange={jest.fn()} />);
      await user.press(screen.getByRole('button', { name: 'Uhrzeit auswählen' }));

      expect(mockDateTimePicker).toHaveBeenLastCalledWith(
        expect.objectContaining({ themeVariant: mode }),
      );
    },
  );

  it('confirms a changed iOS date and cancels a later selection', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    const { rerender } = await render(
      <DateWheelField label="Startdatum" value="" onChange={onChange} />,
    );
    await user.press(screen.getByRole('button', { name: 'Startdatum auswählen' }));

    const picker = mockDateTimePicker.mock.calls.at(-1)?.[0];
    expect(picker?.mode).toBe('date');
    await act(async () => {
      picker?.onValueChange({}, new Date(2024, 0, 2));
    });
    await user.press(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(onChange).toHaveBeenLastCalledWith('2024-01-02');

    await rerender(<DateWheelField label="Startdatum" value="2024-01-02" onChange={onChange} />);
    await user.press(screen.getByRole('button', { name: 'Startdatum 02.01.2024 ändern' }));
    const reopenedPicker = mockDateTimePicker.mock.calls.at(-1)?.[0];
    await act(async () => {
      reopenedPicker?.onValueChange({}, new Date(2025, 5, 6));
    });
    await user.press(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback accessibility label when no date label is provided', async () => {
    const user = userEvent.setup();
    await render(<DateWheelField value="" onChange={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: 'Datum auswählen' }));

    expect(mockDateTimePicker).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'date', display: 'spinner' }),
    );
  });

  it('uses the shared Press primitive on Android without a pressed style callback', async () => {
    const user = userEvent.setup();
    await render(<AndroidDateWheelField value="" onChange={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: 'Datum auswählen' }));

    expect(mockDateTimePicker).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ themeVariant: expect.anything() }),
    );
  });
});
