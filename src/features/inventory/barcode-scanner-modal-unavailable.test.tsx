import { render, screen } from '@testing-library/react-native';
import { BarcodeScannerModal } from './barcode-scanner-modal';

jest.mock('expo-camera', () => {
  throw new Error('Expo Camera native module unavailable');
});

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { accent: '#6750A4' } }),
}));

it('erklärt die manuelle Barcode-Suche ohne verfügbares natives Kameramodul', async () => {
  await render(<BarcodeScannerModal visible onClose={jest.fn()} onBarcodeDetected={jest.fn()} />);

  expect(screen.getByText(/Kamera-Barcode-Scanner benötigt ein natives Build/)).toBeOnTheScreen();
  expect(screen.queryByTestId('barcode-camera')).not.toBeOnTheScreen();
});
