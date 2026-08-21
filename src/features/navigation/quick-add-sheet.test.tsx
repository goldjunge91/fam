import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QuickAddSheet } from '@/features/navigation/quick-add-sheet';

const mockCloseQuickAdd = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('./navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isQuickAddOpen: true,
    closeQuickAdd: mockCloseQuickAdd,
  }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({
    isQuickAddOpen: true,
    closeQuickAdd: mockCloseQuickAdd,
  }),
}));

jest.mock('@/hooks/use-deferred-mount', () => ({
  useDeferredMount: () => true,
}));

describe('QuickAddSheet', () => {
  it('rendert Schnellauswahl-Aktionen', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QuickAddSheet />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Neu hinzufügen')).toBeTruthy();
    expect(screen.getByText('Vorratsartikel')).toBeTruthy();
    expect(screen.getByText('Einkaufsartikel')).toBeTruthy();
    expect(screen.getByText('Tagebucheintrag')).toBeTruthy();
    expect(screen.getByText('Rezept')).toBeTruthy();
  });
});
