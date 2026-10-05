import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '@/i18n';
import { ReceiptScannerScreen } from './receipt-scanner-screen';

const mockSetFlowVisible = jest.fn();
const mockFlowProps: { value: null | { initialCapture?: unknown } } = { value: null };
const mockRouterBack = jest.fn();
const mockRouterCanGoBack = jest.fn(() => true);

const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockRouterBack(...args),
    canGoBack: () => mockRouterCanGoBack(),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));

jest.mock('@/features/ocr/processing/review/receipt-capture-review-flow', () => ({
  ReceiptCaptureReviewFlow: ({
    visible,
    initialCapture,
  }: {
    visible: boolean;
    initialCapture?: unknown;
  }) => {
    mockSetFlowVisible(visible);
    mockFlowProps.value = { initialCapture };
    return null;
  },
}));

const mockResumableDraft: { value: null | { draftId: string; phase: string; pageCount: number } } =
  { value: null };

const mockCaptureReceipt = jest.fn();
const mockPersistenceSave = jest.fn();

jest.mock('@/features/ocr/capture/api', () => ({
  useResumableReceiptDraft: () => ({ data: mockResumableDraft.value }),
  captureReceipt: (...args: unknown[]) => mockCaptureReceipt(...args),
  createReceiptCapturePersistence: () => ({
    save: (...args: unknown[]) => mockPersistenceSave(...args),
  }),
}));

const mockTakePictureAsync = jest.fn();
let mockCameraGranted = true;

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: React.forwardRef((_props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: (...args: unknown[]) => mockTakePictureAsync(...args),
      }));
      return React.createElement(View, { testID: 'live-camera-view' });
    }),
    useCameraPermissions: () => [
      { granted: mockCameraGranted },
      async () => ({ granted: mockCameraGranted }),
    ],
  };
});

describe('ReceiptScannerScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('opens the existing receipt capture flow from the scanner actions', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'Beleg aus Galerie auswählen', hidden: true }),
    );

    expect(mockSetFlowVisible).toHaveBeenLastCalledWith(true);
    expect(mockFlowProps.value?.initialCapture).toEqual({ source: 'gallery' });
  });
});

describe('ReceiptScannerScreen — Wiederaufnahme', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('bietet einen sichtbaren Wiedereinstieg fuer einen persistierten Entwurf an', async () => {
    mockResumableDraft.value = { draftId: 'capture-1', phase: 'needs_review', pageCount: 1 };
    try {
      await render(
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}>
          <ReceiptScannerScreen />
        </SafeAreaProvider>,
      );

      await fireEvent.press(screen.getByRole('button', { name: 'Entwurf fortsetzen' }));

      expect(mockSetFlowVisible).toHaveBeenLastCalledWith(true);
    } finally {
      mockResumableDraft.value = null;
    }
  });

  it('zeigt ohne Entwurf keinen Wiedereinstieg an', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Entwurf fortsetzen' })).not.toBeOnTheScreen();
  });
});

describe('ReceiptScannerScreen — Zurueck', () => {
  beforeEach(() => {
    mockRouterBack.mockClear();
    mockRouterReplace.mockClear();
    mockRouterCanGoBack.mockReturnValue(true);
  });

  it('fuehrt mit dem Kopf-Zurueck in der Navigationshistorie zurueck', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByLabelText('Zurück'));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('faellt ohne Historie auf den Haushaltseinstieg zurueck, statt den Nutzer festzuhalten', async () => {
    mockRouterCanGoBack.mockReturnValue(false);
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByLabelText('Zurück'));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith('/shopping-list');
  });
});

describe('ReceiptScannerScreen — Live-Kamera', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockCameraGranted = true;
    mockTakePictureAsync.mockReset();
    mockCaptureReceipt.mockReset();
    mockPersistenceSave.mockReset();
    mockSetFlowVisible.mockClear();
    mockCaptureReceipt.mockResolvedValue({
      kind: 'captured',
      draft: { id: 'capture-live', status: 'pending', phase: 'normalized', pages: [{}] },
    });
  });

  it('loest den Schuss in der Live-Vorschau aus und speist ihn in den Capture-Flow ein', async () => {
    mockTakePictureAsync.mockResolvedValue({
      uri: 'file:///cache/expo-camera/shot.jpg',
      width: 2_400,
      height: 1_800,
    });

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Beleg aufnehmen' }));

    expect(mockTakePictureAsync).toHaveBeenCalledTimes(1);
    expect(mockFlowProps.value?.initialCapture).toEqual({
      source: 'camera',
      sourceAsset: {
        uri: 'file:///cache/expo-camera/shot.jpg',
        mimeType: 'image/jpeg',
        width: 2_400,
        height: 1_800,
      },
    });
    expect(mockSetFlowVisible).toHaveBeenLastCalledWith(true);
  });

  it('zeigt ohne Kameraberechtigung keine Live-Vorschau, sondern fragt sie an', async () => {
    mockCameraGranted = false;

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    expect(screen.queryByTestId('live-camera-view')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kamera erlauben' })).toBeOnTheScreen();
  });

  it('meldet einen fehlgeschlagenen Schuss sichtbar und laesst den Flow zu', async () => {
    mockTakePictureAsync.mockRejectedValue(new Error('Cannot find native module ExpoCamera'));

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Beleg aufnehmen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot find native module ExpoCamera',
    );
    expect(mockSetFlowVisible).not.toHaveBeenCalledWith(true);
  });
});
