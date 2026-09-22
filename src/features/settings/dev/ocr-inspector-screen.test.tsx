import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { captureReceipt, createExpoFileSystemAdapter } from '@/features/ocr/capture/api';
import {
  getReceiptOcrAvailability,
  prepareReceiptOcr,
  recognizeReceiptOcr,
} from '@/features/ocr/processing/native';
import { OcrInspectorScreen } from './ocr-inspector-screen';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Image: NativeImage } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Image: (props: React.ComponentProps<typeof NativeImage>) =>
      React.createElement(NativeImage, props),
  };
});

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

const mockCaptureReceipt = jest.mocked(captureReceipt);
const mockCreateExpoFileSystemAdapter = jest.mocked(createExpoFileSystemAdapter);
const mockGetReceiptOcrAvailability = jest.mocked(getReceiptOcrAvailability);
const mockPrepareReceiptOcr = jest.mocked(prepareReceiptOcr);
const mockRecognizeReceiptOcr = jest.mocked(recognizeReceiptOcr);
const mockDeleteLocalFile = jest.fn(async () => undefined);

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

  it('renders the recognized text and normalized segments after selecting an image', async () => {
    await renderScreen();
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Bild für OCR auswählen' }));

    expect(await screen.findByDisplayValue('EDEKA\nMilch 1,99')).toBeOnTheScreen();
    expect(screen.getByLabelText('OCR-Segment 1: EDEKA')).toBeOnTheScreen();
    expect(screen.getByLabelText('OCR-Segment 2: Milch 1,99')).toBeOnTheScreen();
    expect(screen.getAllByText('Erkannte Segmente')).toHaveLength(2);
    expect(mockRecognizeReceiptOcr).toHaveBeenCalledWith(
      'file:///documents/dev-ocr-1.jpg',
      undefined,
    );
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
