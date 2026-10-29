import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { BarcodeScannerModal } from './barcode-scanner-modal';

const mockRequestCameraPermission = jest.fn().mockResolvedValue({ granted: true });
const mockOnBarcodeDetected = jest.fn();
const mockOnClose = jest.fn();
let mockCameraPermission: { granted: boolean } | null = null;

jest.mock('expo-camera', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    CameraView: ({
      barcodeScannerSettings,
      onBarcodeScanned,
    }: {
      barcodeScannerSettings: { barcodeTypes: string[] };
      onBarcodeScanned: (result: { data: string }) => void;
    }) => (
      <View testID="barcode-camera" barcodeTypes={barcodeScannerSettings.barcodeTypes.join(',')}>
        <Pressable testID="scan-empty" onPress={() => onBarcodeScanned({ data: '' })} />
        <Pressable
          testID="scan-value"
          onPress={() => {
            onBarcodeScanned({ data: '4006381333931' });
            onBarcodeScanned({ data: '4006381333931' });
          }}>
          <Text>Scan</Text>
        </Pressable>
        <Pressable
          testID="scan-duplicate"
          onPress={() => onBarcodeScanned({ data: '4006381333931' })}
        />
      </View>
    ),
    useCameraPermissions: () => [mockCameraPermission, mockRequestCameraPermission],
  };
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

function renderModal(visible = true) {
  return render(
    <BarcodeScannerModal
      visible={visible}
      onClose={mockOnClose}
      onBarcodeDetected={mockOnBarcodeDetected}
    />,
  );
}

beforeEach(() => {
  mockCameraPermission = null;
  mockRequestCameraPermission.mockClear();
  mockOnBarcodeDetected.mockClear();
  mockOnClose.mockClear();
  jest.mocked(Haptics.notificationAsync).mockClear();
});

describe('BarcodeScannerModal', () => {
  it('bietet ohne Berechtigung eine Anfrage an und zeigt Suchstatus und Fehler', async () => {
    await render(
      <BarcodeScannerModal
        visible
        onClose={mockOnClose}
        onBarcodeDetected={mockOnBarcodeDetected}
        looking
        errorMessage="Kein Produkt gefunden"
      />,
    );

    expect(
      screen.getByText('Kamera-Berechtigung ist erforderlich, um Produkt-Barcodes zu scannen.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Suche Produktdaten...')).toBeOnTheScreen();
    expect(screen.getByText('Kein Produkt gefunden')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Kamera erlauben' }));
    expect(mockRequestCameraPermission).toHaveBeenCalledTimes(1);
  });

  it('liefert einen erkannten Code einmalig und erlaubt denselben Code nach erneutem Öffnen', async () => {
    mockCameraPermission = { granted: true };
    const view = await renderModal();

    expect(screen.getByTestId('barcode-camera')).toHaveProp('barcodeTypes', 'ean13,ean8,qr');

    await fireEvent.press(screen.getByTestId('scan-empty'));
    await fireEvent.press(screen.getByTestId('scan-value'));
    await fireEvent.press(screen.getByTestId('scan-duplicate'));

    expect(mockOnBarcodeDetected).toHaveBeenCalledTimes(1);
    expect(mockOnBarcodeDetected).toHaveBeenCalledWith('4006381333931');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');

    await view.rerender(
      <BarcodeScannerModal
        visible={false}
        onClose={mockOnClose}
        onBarcodeDetected={mockOnBarcodeDetected}
      />,
    );
    await view.rerender(
      <BarcodeScannerModal
        visible
        onClose={mockOnClose}
        onBarcodeDetected={mockOnBarcodeDetected}
      />,
    );
    await fireEvent.press(screen.getByTestId('scan-value'));

    expect(mockOnBarcodeDetected).toHaveBeenCalledTimes(2);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  });

  it('schließt über die Kopf- und Fußaktion', async () => {
    await renderModal();
    const closeButtons = screen.getAllByRole('button', { name: 'Schließen' });
    expect(closeButtons).toHaveLength(2);

    await fireEvent.press(closeButtons[0]);
    await fireEvent.press(closeButtons[1]);

    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
