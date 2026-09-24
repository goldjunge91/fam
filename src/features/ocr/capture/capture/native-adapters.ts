import type * as ExpoFileSystem from 'expo-file-system';
import type * as ExpoImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type {
  ReceiptCaptureFileAdapter,
  ReceiptImagePickerAdapter,
  ReceiptImagePickerOptions,
  ReceiptPickerAsset,
  ReceiptPickerResponse,
} from './contracts';
import { isLocalReceiptImageUri, RECEIPT_CANONICAL_IMAGE_MIME_TYPE } from './mime';
import {
  type ReceiptImageResizeAction,
  resizeActionForLongEdge,
  validateNormalizedReceiptImage,
} from './normalization';

type ExpoImageManipulatorResult = {
  uri: string;
  width: number;
  height: number;
};

type ExpoImageManipulatorModule = {
  manipulateAsync(
    uri: string,
    actions: readonly ReceiptImageResizeAction[],
    saveOptions: {
      base64: false;
      compress: number;
      format: 'jpeg';
    },
  ): Promise<ExpoImageManipulatorResult>;
};

type CodedError = Error & { code?: string };

function mapPickerAsset(asset: ExpoImagePicker.ImagePickerAsset): ReceiptPickerAsset {
  return {
    uri: asset.uri,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
    exif: asset.exif,
    type: asset.type,
  };
}

function mapPickerResponse(
  response: ExpoImagePicker.ImagePickerResult | ExpoImagePicker.ImagePickerErrorResult | null,
): ReceiptPickerResponse {
  if (response === null) return null;
  if ('canceled' in response) {
    return response.canceled
      ? { canceled: true, assets: null }
      : { canceled: false, assets: response.assets.map(mapPickerAsset) };
  }
  return { code: response.code, message: response.message };
}

function nativeOptions(options: ReceiptImagePickerOptions): ExpoImagePicker.ImagePickerOptions {
  return {
    mediaTypes: [...options.mediaTypes],
    allowsEditing: options.allowsEditing,
    allowsMultipleSelection: options.allowsMultipleSelection,
    quality: options.quality,
    base64: options.base64,
    exif: options.exif,
    orderedSelection: options.orderedSelection,
  };
}

/** Creates the Expo ImagePicker adapter only when a capture action actually needs it. */
export function createExpoImagePickerAdapter(): ReceiptImagePickerAdapter {
  const imagePicker = require('expo-image-picker') as typeof ExpoImagePicker;
  return {
    async getPendingResultAsync() {
      if (Platform.OS !== 'android') return null;
      return mapPickerResponse(await imagePicker.getPendingResultAsync());
    },
    async requestCameraPermissionsAsync() {
      return imagePicker.requestCameraPermissionsAsync();
    },
    async requestMediaLibraryPermissionsAsync() {
      return imagePicker.requestMediaLibraryPermissionsAsync(false);
    },
    async launchCameraAsync(options) {
      return mapPickerResponse(await imagePicker.launchCameraAsync(nativeOptions(options)));
    },
    async launchImageLibraryAsync(options) {
      return mapPickerResponse(await imagePicker.launchImageLibraryAsync(nativeOptions(options)));
    },
  };
}

function captureDirectorySegment(captureId: string): string {
  return encodeURIComponent(captureId);
}

function codedError(code: string, message: string): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  return error;
}

function loadImageManipulator(): ExpoImageManipulatorModule {
  try {
    const module = require('expo-image-manipulator') as Partial<ExpoImageManipulatorModule>;
    if (typeof module.manipulateAsync !== 'function') {
      throw new Error('The installed expo-image-manipulator module has no manipulateAsync API.');
    }
    return module as ExpoImageManipulatorModule;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('expo-image-manipulator')) {
      throw codedError(
        'image_manipulator_unavailable',
        'Receipt image normalization requires expo-image-manipulator from the SDK 57 dependency set.',
      );
    }
    throw error;
  }
}

function cacheUriPrefix(cacheUri: string): string {
  return cacheUri.endsWith('/') ? cacheUri : `${cacheUri}/`;
}

function isOwnedCacheUri(sourceUri: string, cacheUri: string): boolean {
  return sourceUri.startsWith(cacheUriPrefix(cacheUri));
}

/** Creates the Expo FileSystem adapter lazily so pure Jest tests never load native modules. */
export function createExpoFileSystemAdapter(): ReceiptCaptureFileAdapter {
  const fileSystem = require('expo-file-system') as typeof ExpoFileSystem;

  const deleteFileIfPresent = async (localUri: string): Promise<void> => {
    const file = new fileSystem.File(localUri);
    if (file.info().exists) file.delete();
  };

  return {
    async normalizeToPersistentStorage({
      sourceUri,
      captureId,
      localAssetId,
      maxBytes,
      maxLongEdge,
      jpegQuality,
    }) {
      const imageManipulator = loadImageManipulator();
      // SDK 57 applies the source EXIF orientation while loading the image. Keep the
      // transform native instead of manually rotating picker metadata a second time.
      const directory = new fileSystem.Directory(
        fileSystem.Paths.document,
        'receipt-captures',
        captureDirectorySegment(captureId),
      );
      directory.create({ intermediates: true, idempotent: true });

      const destination = new fileSystem.File(directory, `${localAssetId}.jpg`);
      const baseQuality = Math.min(Math.max(jpegQuality, 0.1), 1);
      const qualitySteps = [
        baseQuality,
        Math.min(baseQuality, 0.72),
        Math.min(baseQuality, 0.62),
        Math.min(baseQuality, 0.52),
      ];
      let sourceDimensions: { width: number; height: number } | null = null;
      let lastFailure: CodedError = codedError(
        'normalization_failed',
        'Receipt image normalization did not produce a usable JPEG.',
      );

      try {
        for (const [attempt, quality] of qualitySteps.entries()) {
          const targetLongEdge =
            attempt === 0
              ? null
              : attempt < 4
                ? maxLongEdge
                : Math.max(1, Math.floor(maxLongEdge * 0.85));
          const action =
            sourceDimensions && targetLongEdge
              ? resizeActionForLongEdge(
                  sourceDimensions.width,
                  sourceDimensions.height,
                  targetLongEdge,
                )
              : null;
          const result = await imageManipulator.manipulateAsync(sourceUri, action ? [action] : [], {
            base64: false,
            compress: quality,
            format: 'jpeg',
          });
          sourceDimensions ??= { width: result.width, height: result.height };

          if (!isLocalReceiptImageUri(result.uri)) {
            throw codedError(
              'non_local_asset',
              'The image manipulator must return a local JPEG file.',
            );
          }

          const tempFile = new fileSystem.File(result.uri);
          const tempInfo = tempFile.info();
          const tempImage = {
            localUri: result.uri,
            mimeType: RECEIPT_CANONICAL_IMAGE_MIME_TYPE,
            byteSize: tempInfo.exists && typeof tempInfo.size === 'number' ? tempInfo.size : 0,
            width: result.width,
            height: result.height,
          };
          const validationFailure = validateNormalizedReceiptImage(tempImage, {
            maxBytes,
            maxLongEdge,
          });

          if (!validationFailure) {
            await tempFile.copy(destination, { overwrite: true });
            const destinationInfo = destination.info();
            const stored = {
              localUri: destination.uri,
              mimeType: RECEIPT_CANONICAL_IMAGE_MIME_TYPE,
              byteSize:
                destinationInfo.exists && typeof destinationInfo.size === 'number'
                  ? destinationInfo.size
                  : 0,
              width: result.width,
              height: result.height,
            };
            const storedFailure = validateNormalizedReceiptImage(stored, {
              maxBytes,
              maxLongEdge,
            });
            if (!storedFailure) {
              await deleteFileIfPresent(result.uri);
              return stored;
            }
            lastFailure = codedError(storedFailure.code, storedFailure.message);
          } else {
            lastFailure = codedError(validationFailure.code, validationFailure.message);
            if (validationFailure.code === 'invalid_dimensions') {
              await deleteFileIfPresent(result.uri);
              throw lastFailure;
            }
          }

          await deleteFileIfPresent(result.uri);
        }

        throw lastFailure;
      } catch (error: unknown) {
        await deleteFileIfPresent(destination.uri);
        throw error;
      }
    },
    readBytes(localUri) {
      return new fileSystem.File(localUri).bytes();
    },
    async deleteLocalFile(localUri) {
      await deleteFileIfPresent(localUri);
    },
    async cleanupSourceUri(sourceUri) {
      if (!isOwnedCacheUri(sourceUri, fileSystem.Paths.cache.uri)) return;
      await deleteFileIfPresent(sourceUri);
    },
  };
}
