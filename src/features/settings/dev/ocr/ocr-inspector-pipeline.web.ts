import type { ReceiptCaptureFileAdapter } from '@/features/ocr/capture/capture/contracts';
import { ReceiptOcrError } from '@/features/ocr/processing/native';
import type {
  InspectorImageSettings,
  PreparedInspectorImage,
} from './ocr-inspector-pipeline.shared';

export * from './ocr-inspector-pipeline.shared';

/** Web cannot load the native Nitro Image preprocessing module. */
export async function prepareInspectorImage(
  sourceUri: string,
  settings: InspectorImageSettings,
  _fileSystem: Pick<ReceiptCaptureFileAdapter, 'readBytes'>,
): Promise<PreparedInspectorImage> {
  const hasImageChanges =
    settings.resize !== 'source' ||
    settings.crop !== 'none' ||
    settings.colorMode !== 'color' ||
    settings.contrast !== 'none' ||
    settings.sharpen !== 'off' ||
    settings.quality !== 'source';

  if (hasImageChanges) {
    // Silently ignoring a selected filter would make the diagnostic result
    // misleading, so report the platform boundary to the inspector instead.
    throw new ReceiptOcrError(
      'UNSUPPORTED_PLATFORM',
      'Die OCR-Bildvorverarbeitung ist im Web-Inspector nicht verfügbar.',
    );
  }

  return { localUri: sourceUri, width: 0, height: 0, byteSize: 0, ownsFile: false };
}
