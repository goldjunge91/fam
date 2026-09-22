import type {
  ReceiptCaptureFileAdapter,
  ReceiptImagePickerAdapter,
  ReceiptPickerCanceled,
} from './contracts';
import { captureReceiptPages } from './image-picker';

const CANCELLED: ReceiptPickerCanceled = { canceled: true, assets: null };

function fileSystem(normalizeToPersistentStorage: jest.Mock): ReceiptCaptureFileAdapter {
  return {
    normalizeToPersistentStorage,
    readBytes: async () => new Uint8Array([1]),
    deleteLocalFile: async () => undefined,
    cleanupSourceUri: async () => undefined,
  };
}

describe('receipt capture cross-surface cancellation', () => {
  it.each(['camera', 'gallery'] as const)('returns a cancellation for %s', async (source) => {
    const launchCameraAsync = jest.fn(async () => CANCELLED);
    const launchImageLibraryAsync = jest.fn(async () => CANCELLED);
    const normalizeToPersistentStorage = jest.fn();
    const imagePicker: ReceiptImagePickerAdapter = {
      getPendingResultAsync: async () => null,
      requestCameraPermissionsAsync: async () => ({ granted: true }),
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
      launchCameraAsync,
      launchImageLibraryAsync,
    };

    const result = await captureReceiptPages(
      { captureId: `cancelled-${source}`, source, createdAt: '2026-09-21T10:00:00.000Z' },
      { imagePicker, fileSystem: fileSystem(normalizeToPersistentStorage) },
    );

    expect(result).toEqual({ kind: 'cancelled', source });
    expect(normalizeToPersistentStorage).not.toHaveBeenCalled();

    if (source === 'camera') {
      expect(launchCameraAsync).toHaveBeenCalledTimes(1);
      expect(launchImageLibraryAsync).not.toHaveBeenCalled();
    } else {
      expect(launchImageLibraryAsync).toHaveBeenCalledTimes(1);
      expect(launchCameraAsync).not.toHaveBeenCalled();
    }
  });
});
