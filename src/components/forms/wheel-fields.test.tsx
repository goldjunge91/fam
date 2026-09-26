import { render, screen, userEvent } from '@testing-library/react-native';
import { DateWheelField } from './date-wheel-field';
import { DateWheelField as AndroidDateWheelField } from './date-wheel-field.android';
import { TimeWheelField } from './time-wheel-field';

let mockThemeMode: 'light' | 'dark' = 'dark';
const mockDateTimePicker = jest.fn((_props: object) => null);

jest.mock('@expo/ui/community/datetime-picker', () => ({
  __esModule: true,
  default: (props: object) => {
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

  it('uses the shared Press primitive on Android without a pressed style callback', async () => {
    const user = userEvent.setup();
    await render(<AndroidDateWheelField value="" onChange={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: 'Datum auswählen' }));

    expect(mockDateTimePicker).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ themeVariant: expect.anything() }),
    );
  });
});
