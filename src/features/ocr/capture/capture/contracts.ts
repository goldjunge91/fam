import type {
  ReceiptCaptureFailure,
  ReceiptCaptureLocalAsset,
  ReceiptCaptureSource,
} from '../domain/types';
import type { ReceiptImageMimeType } from './mime';

export type ReceiptPickerAsset = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number;
  width?: number;
  height?: number;
  exif?: Record<string, unknown> | null;
  type?: 'image' | 'video' | 'livePhoto' | 'pairedVideo' | null;
};

export type ReceiptPickerSuccess = {
  canceled: false;
  assets: readonly ReceiptPickerAsset[];
};

export type ReceiptPickerCanceled = {
  canceled: true;
  assets: null;
};

export type ReceiptPickerError = {
  code: string;
  message: string;
};

export type ReceiptPickerResult = ReceiptPickerSuccess | ReceiptPickerCanceled;

export type ReceiptPickerResponse = ReceiptPickerResult | ReceiptPickerError | null;

export type ReceiptImagePickerOptions = {
  mediaTypes: readonly ['images'];
  allowsEditing: false;
  allowsMultipleSelection: boolean;
  quality: number;
  base64: false;
  exif: boolean;
  orderedSelection: true;
};

export type ReceiptPermissionResponse = {
  granted: boolean;
};

export interface ReceiptImagePickerAdapter {
  getPendingResultAsync(): Promise<ReceiptPickerResponse>;
  requestCameraPermissionsAsync(): Promise<ReceiptPermissionResponse>;
  requestMediaLibraryPermissionsAsync(): Promise<ReceiptPermissionResponse>;
  launchCameraAsync(options: ReceiptImagePickerOptions): Promise<ReceiptPickerResponse>;
  launchImageLibraryAsync(options: ReceiptImagePickerOptions): Promise<ReceiptPickerResponse>;
}

export type ReceiptCaptureFileInput = {
  sourceUri: string;
  captureId: string;
  pageIndex: number;
  localAssetId: string;
  mimeType: ReceiptImageMimeType;
  maxBytes: number;
  maxLongEdge: number;
  jpegQuality: number;
};

export type ReceiptStoredFile = Pick<ReceiptCaptureLocalAsset, 'localUri' | 'mimeType'> & {
  byteSize: number;
  width: number;
  height: number;
};

export interface ReceiptCaptureFileAdapter {
  normalizeToPersistentStorage(input: ReceiptCaptureFileInput): Promise<ReceiptStoredFile>;
  readBytes(localUri: string): Promise<Uint8Array>;
  deleteLocalFile(localUri: string): Promise<void>;
  cleanupSourceUri(sourceUri: string): Promise<void>;
}

export type ReceiptAssetUploadInput = {
  householdId: string;
  receiptId: string;
  createdBy: string;
  localAssetId: string;
  assetId: string;
  storagePath: string;
  mimeType: string;
  byteSize: number;
  sortOrder: number;
  bytes: Uint8Array;
};

export type ReceiptAssetUploadResult = {
  assetId: string;
  storagePath: string;
};

export interface ReceiptAssetUploadAdapter {
  upload(input: ReceiptAssetUploadInput): Promise<ReceiptAssetUploadResult>;
}

export type ReceiptCaptureClock = () => Date;

export type ReceiptCaptureDependencies = {
  imagePicker: ReceiptImagePickerAdapter;
  fileSystem: ReceiptCaptureFileAdapter;
  now?: ReceiptCaptureClock;
};

export type ReceiptCaptureFailureResult = {
  kind: 'failed';
  source: ReceiptCaptureSource;
  failure: ReceiptCaptureFailure;
};
