import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ReceiptScannerDummyScreen } from './receipt-scanner-dummy-screen';

describe('ReceiptScannerDummyScreen', () => {
  it('renders the scanner handoff with camera and gallery actions', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerDummyScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Beleg scannen')).toBeTruthy();
    expect(screen.getByLabelText('Vorschau des späteren Live-Kamera-Feeds')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beleg aufnehmen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beleg aus Galerie auswählen' })).toBeTruthy();
    expect(screen.queryByText(/Schritt/)).toBeNull();
  });
});
