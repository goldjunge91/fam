import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';

let mockCanGoBack = false;
const mockBack = jest.fn();
const mockListeners: Record<string, () => void> = {};

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    canGoBack: () => mockCanGoBack,
    back: () => mockBack(),
    replace: (href: string) => mockReplace(href),
  },
  useNavigation: () => ({
    canGoBack: () => mockCanGoBack,
    addListener: (event: string, cb: () => void) => {
      mockListeners[event] = cb;
      return () => delete mockListeners[event];
    },
  }),
}));

function renderScreen(element: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      {element}
    </SafeAreaProvider>,
  );
}

describe('Screen — Zurueck-Knopf', () => {
  beforeEach(() => {
    mockCanGoBack = false;
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  it('zeigt ohne Angabe keinen Zurueck-Knopf', async () => {
    mockCanGoBack = true;

    const { queryByText } = await renderScreen(
      <Screen title="Übersicht">
        <ThemedText>Inhalt</ThemedText>
      </Screen>,
    );

    expect(queryByText(/^‹/)).toBeNull();
  });

  it('benennt das Ziel, statt generisch "Zurück" zu sagen', async () => {
    const { getByText, getByLabelText } = await renderScreen(
      <Screen title="Mitglieder" back={{ label: 'Einstellungen', href: '/settings' }}>
        <ThemedText>Inhalt</ThemedText>
      </Screen>,
    );

    expect(getByText('‹ Einstellungen')).toBeTruthy();
    expect(getByLabelText('Zurück zu Einstellungen')).toBeTruthy();
  });

  it('geht zurueck, wenn es eine Historie gibt', async () => {
    const { getByLabelText } = await renderScreen(
      <Screen title="Mitglieder" back={{ label: 'Einstellungen', href: '/settings' }}>
        <ThemedText>Inhalt</ThemedText>
      </Screen>,
    );

    mockCanGoBack = true;
    fireEvent.press(getByLabelText('Zurück zu Einstellungen'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('nimmt das Ausweichziel, wenn es keine Historie gibt — und loest kein GO_BACK aus', async () => {
    const { getByLabelText } = await renderScreen(
      <Screen title="Mitglieder" back={{ label: 'Einstellungen', href: '/settings' }}>
        <ThemedText>Inhalt</ThemedText>
      </Screen>,
    );

    mockCanGoBack = false;
    fireEvent.press(getByLabelText('Zurück zu Einstellungen'));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('zeigt ein Ziel ohne Ausweichroute nur bei vorhandener Historie', async () => {
    mockCanGoBack = false;
    const ohne = await renderScreen(
      <Screen title="Haushalt erstellen" back={{ label: 'Haushalte' }}>
        <ThemedText>Inhalt</ThemedText>
      </Screen>,
    );
    expect(ohne.queryByText('‹ Haushalte')).toBeNull();

    mockCanGoBack = true;
    const mit = await renderScreen(
      <Screen title="Haushalt erstellen" back={{ label: 'Haushalte' }}>
        <ThemedText>Inhalt</ThemedText>
      </Screen>,
    );
    expect(mit.getByText('‹ Haushalte')).toBeTruthy();
  });
});
