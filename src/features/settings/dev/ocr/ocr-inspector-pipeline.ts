import type { ReceiptCaptureFileAdapter } from '@/features/ocr/capture/capture/contracts';
import type {
  InspectorImageSettings,
  PreparedInspectorImage,
} from './ocr-inspector-pipeline.shared';

export * from './ocr-inspector-pipeline.shared';

/** Fallback for tooling that does not select a platform-specific module. */
export async function prepareInspectorImage(
  sourceUri: string,
  _settings: InspectorImageSettings,
  _fileSystem: Pick<ReceiptCaptureFileAdapter, 'readBytes'>,
): Promise<PreparedInspectorImage> {
  // Metro and Jest normally select .native.ts or .web.ts; this keeps direct
  // TypeScript/tooling imports type-safe without pulling in a native module.
  return { localUri: sourceUri, width: 0, height: 0, byteSize: 0, ownsFile: false };
}
