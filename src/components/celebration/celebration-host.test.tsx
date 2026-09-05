import { act, render, screen } from '@testing-library/react-native';

import { celebrate } from '@/lib/celebration';
import { CelebrationHost } from './celebration-host';

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: require('@/components/theme').colorsLight }),
}));

jest.mock('@/lib/haptics', () => ({
  celebrate: jest.fn(),
}));

describe('CelebrationHost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('zeigt das optionale Streak-Badge nach einer Celebration', async () => {
    await render(<CelebrationHost />);

    await act(async () => {
      celebrate('🔥 7 Tage Streak!');
    });

    expect(await screen.findByText('🔥 7 Tage Streak!')).toBeOnTheScreen();
  });
});
