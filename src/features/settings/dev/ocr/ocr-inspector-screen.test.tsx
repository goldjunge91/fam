import { render, screen, userEvent } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { captureReceipt, createExpoFileSystemAdapter } from '@/features/ocr/capture/api';
import {
  getReceiptOcrAvailability,
  prepareReceiptOcr,
  recognizeReceiptOcr,
} from '@/features/ocr/processing/native';
import { OcrInspectorScreen } from './ocr-inspector-screen';

const mockHasDevToolsAccess = jest.fn(() => true);
const mockPrepareInspectorImage = jest.fn();
const mockRecognizeInspector = jest.fn();
const mockDetectGeometry = jest.fn();

jest.mock('@expo/ui/community/picker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Picker = Object.assign(
    ({
      children,
      onValueChange,
    }: {
      children: ReactNode;
      onValueChange: (value: string) => void;
    }) =>
      React.createElement(
        View,
        null,
        React.Children.toArray(children).map((child) => {
          const option = child as ReactElement<{ label: string; value: string }>;
          return React.createElement(
            Pressable,
            {
              key: option.props.value,
              accessibilityRole: 'button',
              accessibilityLabel: option.props.label,
              onPress: () => onValueChange(option.props.value),
            },
            React.createElement(Text, null, option.props.label),
          );
        }),
      ),
    { Item: () => null },
  );

  return { __esModule: true, default: Picker, Picker };
});

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Image: NativeImage } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Image: (props: React.ComponentProps<typeof NativeImage>) =>
      React.createElement(NativeImage, props),
  };
});

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockHasDevToolsAccess(),
}));

jest.mock('@/features/ocr/capture/api', () => ({
  captureReceipt: jest.fn(),
  createExpoFileSystemAdapter: jest.fn(),
}));

jest.mock('@/features/ocr/processing/native', () => ({
  getReceiptOcrAvailability: jest.fn(),
  mapReceiptOcrError: jest.fn((error: unknown) => ({
    code: error instanceof Error ? 'NATIVE_OCR_FAILED' : 'UNKNOWN',
    message: error instanceof Error ? error.message : 'OCR fehlgeschlagen',
  })),
  prepareReceiptOcr: jest.fn(),
  recognizeReceiptOcr: jest.fn(),
}));

jest.mock('./ocr-inspector-geometry', () => ({
  detectInspectorReceiptGeometry: (...args: unknown[]) => mockDetectGeometry(...args),
}));

jest.mock('./ocr-inspector-pipeline', () => ({
  isGoogleMlKitAvailable: () => true,
  parseInspectorCustomWords: (value: string) => [
    ...new Set(
      value
        .split(/[\n,;]/u)
        .map((word) => word.trim())
        .filter(Boolean),
    ),
  ],
  prepareInspectorImage: (...args: unknown[]) => mockPrepareInspectorImage(...args),
  recognizeReceiptOcrForInspector: (...args: unknown[]) => mockRecognizeInspector(...args),
}));

const mockCaptureReceipt = jest.mocked(captureReceipt);
const mockCreateExpoFileSystemAdapter = jest.mocked(createExpoFileSystemAdapter);
const mockGetReceiptOcrAvailability = jest.mocked(getReceiptOcrAvailability);
const mockPrepareReceiptOcr = jest.mocked(prepareReceiptOcr);
const mockRecognizeReceiptOcr = jest.mocked(recognizeReceiptOcr);
const mockDeleteLocalFile = jest.fn(async () => undefined);
const initialExpoOs = process.env.EXPO_OS;

describe('OcrInspectorScreen', () => {
  async function renderScreen() {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}>
        <OcrInspectorScreen />
      </SafeAreaProvider>,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockHasDevToolsAccess.mockReturnValue(true);
    mockPrepareInspectorImage.mockResolvedValue({
      localUri: 'file:///documents/dev-ocr-1.jpg',
      width: 0,
      height: 0,
      byteSize: 0,
      ownsFile: false,
    });
    mockRecognizeInspector.mockResolvedValue({
      imageSize: { width: 1_000, height: 2_000 },
      lines: [],
    });
    mockDetectGeometry.mockResolvedValue(null);
    mockGetReceiptOcrAvailability.mockResolvedValue({ status: 'available' });
    mockPrepareReceiptOcr.mockResolvedValue({ status: 'available' });
    mockRecognizeReceiptOcr.mockResolvedValue({
      imageSize: { width: 1_000, height: 2_000 },
      lines: [
        {
          text: 'EDEKA',
          confidence: 0.96,
          boundingBox: { x: 0.1, y: 0.08, width: 0.8, height: 0.04 },
        },
        {
          text: 'Milch 1,99',
          confidence: null,
          boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.04 },
        },
      ],
    });
    mockCaptureReceipt.mockResolvedValue({
      kind: 'captured',
      draft: {
        id: 'dev-ocr-1',
        source: 'gallery',
        pages: [
          {
            id: 'dev-ocr-1:page:0',
            localUri: 'file:///documents/dev-ocr-1.jpg',
            mimeType: 'image/jpeg',
            byteSize: 120_000,
          },
        ],
        status: 'pending',
        phase: 'captured',
        uploadedAssets: [],
        failure: null,
        createdAt: '2026-09-21T10:00:00.000Z',
        updatedAt: '2026-09-21T10:00:00.000Z',
      },
    });
    mockCreateExpoFileSystemAdapter.mockReturnValue({
      deleteLocalFile: mockDeleteLocalFile,
    } as unknown as ReturnType<typeof createExpoFileSystemAdapter>);
  });

  afterEach(() => {
    if (initialExpoOs === undefined) {
      delete process.env.EXPO_OS;
      return;
    }
    process.env.EXPO_OS = initialExpoOs;
  });

  it('starts with image selection and a diagnostic empty state', async () => {
    await renderScreen();

    expect(screen.getByRole('button', { name: 'Bild für OCR auswählen' })).toBeOnTheScreen();
    expect(screen.getByText('Noch kein Prüfbild')).toBeOnTheScreen();
    expect(screen.getByText('OCR-Modell')).toBeOnTheScreen();
  });

  it('shows dev-only controls for image preparation and native OCR options', async () => {
    await renderScreen();

    expect(screen.getByText('Lauf-Konfiguration')).toBeOnTheScreen();
    expect(screen.getByText('Bildvorverarbeitung')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Genau' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Schnell' })).toBeOnTheScreen();
    expect(screen.getByText('OCR-Sprache')).toBeOnTheScreen();
    expect(screen.getByLabelText('Eigene OCR-Wörter')).toBeOnTheScreen();
  });

  it.each([
    [{ status: 'available' }, 'bereit'],
    [{ status: 'downloadable' }, 'Download erforderlich'],
    [{ status: 'downloading' }, 'wird geladen'],
    [{ status: 'unavailable', reason: 'not-enabled' }, 'nicht verfügbar (not-enabled)'],
  ] as const)('describes the model state %s', async (availability, label) => {
    mockGetReceiptOcrAvailability.mockResolvedValue(availability);
    await renderScreen();

    expect(await screen.findByText(label)).toBeOnTheScreen();
  });

  it('keeps the checking state visible while model availability is pending', async () => {
    mockGetReceiptOcrAvailability.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    expect(screen.getByText('wird geprüft')).toBeOnTheScreen();
  });

  it('refreshes model availability and reports refresh failures', async () => {
    const user = userEvent.setup();
    await renderScreen();
    mockGetReceiptOcrAvailability.mockResolvedValueOnce({ status: 'downloadable' });
    await user.press(screen.getByRole('button', { name: 'Modellstatus aktualisieren' }));
    expect(await screen.findByText('Download erforderlich')).toBeOnTheScreen();

    mockGetReceiptOcrAvailability.mockRejectedValueOnce(new Error('offline'));
    await user.press(screen.getByRole('button', { name: 'Modellstatus aktualisieren' }));
    expect(await screen.findByText('NATIVE_OCR_FAILED: offline')).toBeOnTheScreen();
  });

  it('uses custom native options only on the next OCR run', async () => {
    process.env.EXPO_OS = 'ios';
    mockRecognizeInspector.mockResolvedValueOnce({
      imageSize: { width: 1_000, height: 2_000 },
      lines: [
        {
          text: 'Inspector result',
          confidence: 0.8,
          boundingBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.1 },
        },
      ],
    });
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Auflösung Quelle behalten ändern' }));
    await user.press(screen.getByRole('button', { name: '1600 px · kleiner' }));
    await user.press(screen.getByRole('button', { name: 'Übernehmen' }));
    await user.press(screen.getByRole('button', { name: 'Zuschnitt Kein Zuschnitt ändern' }));
    await user.press(screen.getByRole('button', { name: 'Ränder 2 % entfernen' }));
    await user.press(screen.getByRole('button', { name: 'Übernehmen' }));
    await user.press(screen.getByRole('button', { name: 'JPEG-Qualität Quelle behalten ändern' }));
    await user.press(screen.getByRole('button', { name: 'JPEG 55 · stark komprimiert' }));
    await user.press(screen.getByRole('button', { name: 'Übernehmen' }));
    await user.press(screen.getByRole('button', { name: 'OCR-Sprache Auto / Gerät ändern' }));
    await user.press(screen.getByRole('button', { name: 'Deutsch · de-DE' }));
    await user.press(screen.getByRole('button', { name: 'Übernehmen' }));
    await user.press(screen.getByRole('radio', { name: 'Graustufen' }));
    await user.press(screen.getByRole('radio', { name: '+45 %' }));
    await user.press(screen.getByRole('radio', { name: 'Mittel' }));
    await user.press(screen.getByRole('radio', { name: '+15 %' }));
    await user.press(screen.getByRole('radio', { name: 'Auto' }));
    await user.press(screen.getByRole('radio', { name: 'Schnell' }));
    const correctionOptions = screen.getAllByRole('radio', { name: 'Aus' });
    const correctionOff = correctionOptions.at(-1);
    if (!correctionOff) throw new Error('Sprachkorrektur-Auswahl fehlt.');
    await user.press(correctionOff);
    await user.type(screen.getByLabelText('Eigene OCR-Wörter'), 'Milch, EDEKA');

    expect(mockRecognizeInspector).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));
    await screen.findByDisplayValue('Inspector result');

    expect(mockPrepareReceiptOcr).toHaveBeenCalledWith(
      expect.objectContaining({ languages: ['de-DE'] }),
    );
    expect(mockPrepareInspectorImage).toHaveBeenCalledWith(
      'file:///documents/dev-ocr-1.jpg',
      expect.objectContaining({
        resize: '1600',
        crop: 'edges-2',
        quality: 'low',
        colorMode: 'grayscale',
        contrast: 'high',
        sharpen: 'medium',
        brightness: 'high',
        threshold: 'auto',
        language: 'de-DE',
        recognitionLevel: 'fast',
        usesLanguageCorrection: false,
      }),
      expect.anything(),
    );
    expect(mockRecognizeInspector).toHaveBeenCalledWith(
      'file:///documents/dev-ocr-1.jpg',
      expect.objectContaining({
        languages: ['de-DE'],
        recognitionLevel: 'fast',
        usesLanguageCorrection: false,
        customWords: ['Milch', 'EDEKA'],
      }),
    );
  });

  it.each([
    ['cancelled', { kind: 'cancelled', source: 'gallery' }, 'Kein Bild ausgewählt'],
    [
      'permission_denied',
      { kind: 'permission_denied', source: 'gallery' },
      'Fehler bei der Verarbeitung',
    ],
    [
      'failed',
      {
        kind: 'failed',
        source: 'gallery',
        failure: { code: 'IMAGE_NOT_FOUND', message: 'missing' },
      },
      'Fehler bei der Verarbeitung',
    ],
  ] as const)(
    'handles a %s image selection result',
    async (_name, captureResult, expectedPhase) => {
      const user = userEvent.setup();
      mockCaptureReceipt.mockResolvedValueOnce(captureResult);
      await renderScreen();
      await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));

      expect(await screen.findByText(expectedPhase)).toBeOnTheScreen();
      if (captureResult.kind === 'permission_denied') {
        expect(screen.getByText(/MEDIA_PERMISSION_DENIED/)).toBeOnTheScreen();
      }
      if (captureResult.kind === 'failed') {
        expect(screen.getByText('IMAGE_NOT_FOUND: missing')).toBeOnTheScreen();
      }
    },
  );

  it('maps picker rejection into the diagnostic error state', async () => {
    const user = userEvent.setup();
    mockCaptureReceipt.mockRejectedValueOnce(new Error('picker crashed'));
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));

    expect(await screen.findByText('NATIVE_OCR_FAILED: picker crashed')).toBeOnTheScreen();
  });

  it('removes a selected image and clears its diagnostic output', async () => {
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));
    await screen.findByDisplayValue('EDEKA\nMilch 1,99');

    await user.press(screen.getByRole('button', { name: 'Bild entfernen' }));

    expect(await screen.findByText('Noch kein Prüfbild')).toBeOnTheScreen();
    expect(mockDeleteLocalFile).toHaveBeenCalledWith('file:///documents/dev-ocr-1.jpg');
  });

  it('renders the recognized text and normalized segments after selecting an image', async () => {
    mockRecognizeReceiptOcr.mockResolvedValueOnce({
      imageSize: { width: 1_000, height: 2_000 },
      lines: [
        {
          text: 'EDEKA',
          confidence: 0.96,
          boundingBox: { x: 0.1, y: 0.08, width: 0.8, height: 0.04 },
        },
        {
          text: 'Milch 1,99',
          confidence: null,
          boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.04 },
        },
        {
          text: 'Backwaren',
          confidence: 0.7,
          boundingBox: { x: 0.1, y: 0.3, width: 0.8, height: 0.04 },
        },
        {
          text: 'Pfand',
          confidence: 0.2,
          boundingBox: { x: 0.1, y: 0.4, width: 0.8, height: 0.04 },
        },
      ],
    });
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));

    expect(
      await screen.findByDisplayValue('EDEKA\nMilch 1,99\nBackwaren\nPfand'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('OCR-Segment 1: EDEKA')).toBeOnTheScreen();
    expect(screen.getByLabelText('OCR-Segment 2: Milch 1,99')).toBeOnTheScreen();
    expect(screen.getByLabelText('OCR-Segment 3: Backwaren')).toBeOnTheScreen();
    expect(screen.getByLabelText('OCR-Segment 4: Pfand')).toBeOnTheScreen();
    expect(screen.getAllByText('Erkannte Segmente')).toHaveLength(2);
    expect(mockRecognizeReceiptOcr).toHaveBeenCalledWith(
      'file:///documents/dev-ocr-1.jpg',
      undefined,
    );
  });

  it('copies OCR text or JSON with geometry only after the respective action', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));
    await screen.findByDisplayValue('EDEKA\nMilch 1,99');
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'JSON kopieren' }));
    const json = jest.mocked(Clipboard.setStringAsync).mock.calls[0]?.[0];
    expect(JSON.parse(json ?? '')).toEqual({
      provider: 'apple-vision',
      imageSettings: {
        resize: 'source',
        crop: 'none',
        colorMode: 'color',
        contrast: 'none',
        sharpen: 'off',
        quality: 'source',
        brightness: 'none',
        threshold: 'off',
      },
      imageSize: { width: 1_000, height: 2_000 },
      receiptGeometry: null,
      lines: [
        {
          text: 'EDEKA',
          confidence: 0.96,
          boundingBox: { x: 0.1, y: 0.08, width: 0.8, height: 0.04 },
        },
        {
          text: 'Milch 1,99',
          confidence: null,
          boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.04 },
        },
      ],
      manualLabels: {
        article: { lineIndexes: [], text: '' },
        quantity: { lineIndexes: [], text: '' },
        unitPrice: { lineIndexes: [], text: '' },
        price: { lineIndexes: [], text: '' },
      },
    });
    await user.press(screen.getByRole('button', { name: 'Kopieren' }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('EDEKA\nMilch 1,99');
  });

  it('exports the settings of the completed run after a new filter is selected', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));
    await screen.findByDisplayValue('EDEKA\nMilch 1,99');
    await user.press(screen.getByRole('radio', { name: '+45 %' }));
    await user.press(screen.getByRole('button', { name: 'JSON kopieren' }));

    const json = jest.mocked(Clipboard.setStringAsync).mock.calls[0]?.[0];
    expect(JSON.parse(json ?? '')).toMatchObject({
      provider: 'apple-vision',
      imageSettings: { contrast: 'none' },
      lines: [{ text: 'EDEKA' }, { text: 'Milch 1,99' }],
    });
    expect(screen.getByRole('button', { name: 'Mit Einstellungen ausführen' })).toBeOnTheScreen();
  });

  it('combines manually assigned OCR labels into the JSON export', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));
    await screen.findByDisplayValue('EDEKA\nMilch 1,99');
    await user.press(screen.getByRole('button', { name: 'Auswählen für Artikel: EDEKA' }));
    await user.press(screen.getByRole('radio', { name: 'Menge' }));
    await user.press(screen.getByRole('button', { name: 'Auswählen für Menge: Milch 1,99' }));
    await user.press(screen.getByRole('button', { name: 'JSON kopieren' }));

    const json = jest.mocked(Clipboard.setStringAsync).mock.calls[0]?.[0];
    expect(JSON.parse(json ?? '')).toMatchObject({
      manualLabels: {
        article: { lineIndexes: [0], text: 'EDEKA' },
        quantity: { lineIndexes: [1], text: 'Milch 1,99' },
      },
    });
  });

  it('shows and hides the same JSON that the copy button provides', async () => {
    await renderScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));
    await screen.findByDisplayValue('EDEKA\nMilch 1,99');

    expect(screen.queryByLabelText('OCR-Ergebnis als JSON')).toBeNull();
    await user.press(screen.getByRole('button', { name: 'JSON anzeigen' }));
    const json = screen.getByLabelText('OCR-Ergebnis als JSON').props.value;
    expect(JSON.parse(json)).toMatchObject({
      imageSize: { width: 1_000, height: 2_000 },
      lines: [{ text: 'EDEKA' }, { text: 'Milch 1,99' }],
    });
    await user.press(screen.getByRole('button', { name: 'JSON ausblenden' }));
    expect(screen.queryByLabelText('OCR-Ergebnis als JSON')).toBeNull();
  });

  it('cleans up the normalized working image when the screen unmounts', async () => {
    const rendered = await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));
    await screen.findByDisplayValue('EDEKA\nMilch 1,99');
    await rendered.unmount();

    expect(mockDeleteLocalFile).toHaveBeenCalledWith('file:///documents/dev-ocr-1.jpg');
  });
});
