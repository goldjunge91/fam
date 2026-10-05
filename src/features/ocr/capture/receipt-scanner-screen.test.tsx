import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { borderWidth, radius, space } from '@/components/theme/index';
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
const mockCameraViewProps: { value: Record<string, unknown> } = { value: {} };

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      mockCameraViewProps.value = props;
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: (...args: unknown[]) => mockTakePictureAsync(...args),
      }));
      return React.createElement(View, { ...props, testID: 'live-camera-view' });
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

    await fireEvent.press(screen.getByRole('button', { name: 'Aus Galerie wählen' }));

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

describe('ReceiptScannerScreen — Schliessen', () => {
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

    await fireEvent.press(screen.getByLabelText('Schließen'));

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

    await fireEvent.press(screen.getByLabelText('Schließen'));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith('/shopping-list');
  });
});

describe('ReceiptScannerScreen — Live-Kamera', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockCameraGranted = true;
    mockTakePictureAsync.mockReset();
    mockCameraViewProps.value = {};
    mockCaptureReceipt.mockReset();
    mockPersistenceSave.mockReset();
    mockSetFlowVisible.mockClear();
    mockCaptureReceipt.mockResolvedValue({
      kind: 'captured',
      draft: { id: 'capture-live', status: 'pending', phase: 'normalized', pages: [{}] },
    });
  });

  it('sammelt mehrere Live-Aufnahmen und startet sie gemeinsam im Capture-Flow', async () => {
    mockTakePictureAsync
      .mockResolvedValueOnce({
        uri: 'file:///cache/expo-camera/page-1.jpg',
        width: 2_400,
        height: 1_800,
      })
      .mockResolvedValueOnce({
        uri: 'file:///cache/expo-camera/page-2.jpg',
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

    await fireEvent.press(screen.getByRole('button', { name: 'Foto aufnehmen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Foto aufnehmen' }));

    // Noch kein Flow: die Seiten werden erst gesammelt.
    expect(mockSetFlowVisible).not.toHaveBeenCalledWith(true);
    expect(mockTakePictureAsync).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Fertig (2)' }));

    expect(mockFlowProps.value?.initialCapture).toEqual({
      source: 'camera',
      sourceAssets: [
        expect.objectContaining({ uri: 'file:///cache/expo-camera/page-1.jpg' }),
        expect.objectContaining({ uri: 'file:///cache/expo-camera/page-2.jpg' }),
      ],
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

    await fireEvent.press(screen.getByRole('button', { name: 'Foto aufnehmen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot find native module ExpoCamera',
    );
    expect(mockSetFlowVisible).not.toHaveBeenCalledWith(true);
  });

  it('stellt den Schliessen-Button auf die Hoehe des Titels', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    const title = screen.getByText('Bon fotografieren');
    const headerRow = title.parent;
    expect(headerRow).not.toBeNull();
    if (!headerRow || typeof headerRow === 'string') throw new Error('Header-Zeile fehlt');

    expect(within(headerRow).getByLabelText('Schließen')).toBeOnTheScreen();
    expect(headerRow.props.style).toEqual(
      expect.objectContaining({ flexDirection: 'row', alignItems: 'center' }),
    );
  });

  it('wechselt mit dem Kamera-Button zwischen Rueck- und Frontkamera', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    expect(mockCameraViewProps.value.facing).toBe('back');

    await fireEvent.press(screen.getByRole('button', { name: 'Kamera wechseln' }));

    expect(mockCameraViewProps.value.facing).toBe('front');
  });

  it('schaltet den Blitz in der Reihenfolge aus, automatisch, an durch', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    expect(mockCameraViewProps.value.flash).toBe('off');

    await fireEvent.press(screen.getByRole('button', { name: 'Blitz: aus' }));
    expect(mockCameraViewProps.value.flash).toBe('auto');

    await fireEvent.press(screen.getByRole('button', { name: 'Blitz: automatisch' }));
    expect(mockCameraViewProps.value.flash).toBe('on');

    await fireEvent.press(screen.getByRole('button', { name: 'Blitz: an' }));
    expect(mockCameraViewProps.value.flash).toBe('off');
  });

  it('loest mit dem Fokus-Button einen einmaligen Fokus aus und laesst ihn danach zurueckfallen', async () => {
    jest.useFakeTimers();
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

      expect(mockCameraViewProps.value.autofocus).toBe('off');

      await fireEvent.press(screen.getByRole('button', { name: 'Fokussieren' }));

      expect(mockCameraViewProps.value.autofocus).toBe('on');

      await act(async () => {
        jest.advanceTimersByTime(1_000);
        await Promise.resolve();
      });

      expect(mockCameraViewProps.value.autofocus).toBe('off');
    } finally {
      jest.useRealTimers();
    }
  });

  it('haelt den Kopf unter der oberen Safe Area und damit erreichbar', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    const title = screen.getByText('Bon fotografieren');
    // Die gesamte Kopfzeile inklusive X muss unterhalb der Statusleiste liegen.
    // Ohne Safe-Area-Padding startet sie bei y=0 und ist auf dem Geraet nicht
    // erreichbar.
    let node = title.parent;
    let guarded = false;
    while (node && typeof node !== 'string') {
      if (node.props?.edges) {
        guarded = node.props.edges.top === 'additive';
        break;
      }
      node = node.parent;
    }
    expect(guarded).toBe(true);
  });

  it('verwendet fuer die Kamera-Steuerung die Standard-Buttons mit Glasflaeche', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    for (const name of ['Kamera wechseln', 'Fokussieren', 'Blitz: aus']) {
      const control = screen.getByRole('button', { name });
      expect(control).toHaveStyle({
        backgroundColor: '#FBF7F2',
        borderColor: '#E4DDE3',
        borderWidth: borderWidth.base,
        borderRadius: radius.sm,
      });
    }
  });

  it('setzt den gelben Scanrahmen deutlich innerhalb der Kameraflaeche ab', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <ReceiptScannerScreen />
      </SafeAreaProvider>,
    );

    const camera = screen.getByTestId('live-camera-view');
    const frame = camera.parent;
    expect(frame).not.toBeNull();
    if (!frame || typeof frame === 'string') throw new Error('Rahmen fehlt');

    const corners = within(frame)
      .getAllByTestId(/^scan-corner-/)
      .flatMap((corner) => {
        const style = Array.isArray(corner.props.style)
          ? Object.assign({}, ...corner.props.style.filter(Boolean))
          : (corner.props.style ?? {});
        return [{ id: corner.props.testID as string, style }];
      });

    expect(corners).toHaveLength(4);
    for (const { style } of corners) {
      // Die Ecken liegen nicht am Rand der Kameraflaeche, sondern mit Abstand
      // darin. Der Abstand muss groesser sein als die Eckgroesse selbst, sonst
      // wirkt der Rahmen wie ein Vollrahmen um die Ansicht.
      const inset = (style.top ?? style.bottom) as number;
      expect(typeof inset).toBe('number');
      expect(inset).toBeGreaterThanOrEqual(space.xxl);
      expect(style.width).toBeLessThan(inset);
      expect(style.borderColor).toBe('#A8713A');
    }
  });
});
