import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SpeedDialMenu } from '@/features/navigation/speed-dial-menu';

const mockCloseQuickAdd = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isQuickAddOpen: true,
    closeQuickAdd: mockCloseQuickAdd,
  }),
}));

jest.mock('@/features/navigation/fab-position-settings', () => ({
  DEFAULT_FAB_POSITION: 'right',
  useFabPosition: () => ({ data: 'right' }),
}));

jest.mock('@/hooks/use-deferred-mount', () => ({
  useDeferredMount: () => true,
}));

describe('SpeedDialMenu', () => {
  it('rendert Schnellauswahl-Aktionen', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <SpeedDialMenu />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Vorratsartikel')).toBeTruthy();
    expect(screen.getByText('Einkaufsartikel')).toBeTruthy();
    expect(screen.getByText('Tagebucheintrag')).toBeTruthy();
    expect(screen.getByText('Rezept')).toBeTruthy();
  });
});
