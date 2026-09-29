import type {
  RecognizeTextResult,
  VisionFeatureAvailability,
  VisionUnavailableReason,
} from 'expo-ai-kit';
import { isGoogleMlKitAvailable, recognizeWithGoogleMlKit } from './mlkit';

export type ReceiptOcrProvider = 'apple-vision' | 'google-mlkit';

export type ReceiptOcrOptions = {
  languages?: readonly string[];
  provider?: ReceiptOcrProvider;
};

export type ReceiptOcrPrepareOptions = ReceiptOcrOptions & {
  onProgress?: (progress: number) => void;
};

type ReceiptOcrNativeModule = {
  recognize: (uri: string, options: ReceiptOcrOptions) => Promise<unknown>;
};

export type ReceiptOcrErrorCode =
  | 'INVALID_URI'
  | 'UNSUPPORTED_URI_SCHEME'
  | 'IMAGE_NOT_FOUND'
  | 'IMAGE_DECODE_FAILED'
  | 'UNSUPPORTED_LANGUAGE'
  | 'NO_TEXT'
  | 'NATIVE_OCR_FAILED'
  | 'UNSUPPORTED_PLATFORM'
  | 'NATIVE_MODULE_UNAVAILABLE'
  | 'DEVICE_NOT_SUPPORTED'
  | 'VISION_NOT_ENABLED'
  | 'MODEL_NOT_DOWNLOADED'
  | 'DOWNLOAD_FAILED'
  | 'DOWNLOAD_CANCELLED'
  | 'LANGUAGE_NOT_SUPPORTED'
  | 'VISION_FAILED';

const RECEIPT_OCR_ERROR_CODES = new Set<ReceiptOcrErrorCode>([
  'INVALID_URI',
  'UNSUPPORTED_URI_SCHEME',
  'IMAGE_NOT_FOUND',
  'IMAGE_DECODE_FAILED',
  'UNSUPPORTED_LANGUAGE',
  'NO_TEXT',
  'NATIVE_OCR_FAILED',
  'UNSUPPORTED_PLATFORM',
  'NATIVE_MODULE_UNAVAILABLE',
  'DEVICE_NOT_SUPPORTED',
  'VISION_NOT_ENABLED',
  'MODEL_NOT_DOWNLOADED',
  'DOWNLOAD_FAILED',
  'DOWNLOAD_CANCELLED',
  'LANGUAGE_NOT_SUPPORTED',
  'VISION_FAILED',
]);

const RETRYABLE_RECEIPT_OCR_ERROR_CODES = new Set<ReceiptOcrErrorCode>([
  'NO_TEXT',
  'NATIVE_OCR_FAILED',
  'MODEL_NOT_DOWNLOADED',
  'DOWNLOAD_FAILED',
  'DOWNLOAD_CANCELLED',
  'VISION_FAILED',
]);

const VISION_UNAVAILABLE_REASONS: readonly VisionUnavailableReason[] = [
  'platform',
  'os-version',
  'device',
  'not-enabled',
];

export type ReceiptOcrBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ReceiptOcrLine = {
  text: string;
  confidence: number | null;
  boundingBox: ReceiptOcrBoundingBox;
};

export type ReceiptOcrResult = {
  lines: readonly ReceiptOcrLine[];
  imageSize: {
    width: number;
    height: number;
  };
};

export type ReceiptOcrModelAvailability = VisionFeatureAvailability;

type ExpoAiKitApi = Pick<
  typeof import('expo-ai-kit'),
  'getVisionAvailability' | 'prepareVision' | 'recognizeText'
>;
type ExpoImageApi = Pick<typeof import('expo-image'), 'Image'>;
type ExpoLocalizationApi = Pick<typeof import('expo-localization'), 'getLocales'>;

let expoAiKitApi: ExpoAiKitApi | null | undefined;

// 022. Lazily loads and caches the optional expo-ai-kit API, including absence.
function loadExpoAiKit(): ExpoAiKitApi | null {
  if (expoAiKitApi !== undefined) {
    return expoAiKitApi;
  }

  try {
    expoAiKitApi = require('expo-ai-kit') as ExpoAiKitApi;
  } catch {
    expoAiKitApi = null;
  }

  return expoAiKitApi;
}

// 023. Uses explicit languages first, then the device locale, and otherwise no override.
function receiptOcrOptions(options: ReceiptOcrOptions | undefined): string[] {
  if (options?.languages !== undefined && options.languages.length > 0) {
    return [...options.languages];
  }

  let getLocales: ExpoLocalizationApi['getLocales'];
  try {
    ({ getLocales } = require('expo-localization') as ExpoLocalizationApi);
  } catch {
    return [];
  }

  const [preferredLocale] = getLocales();
  const deviceLanguage = preferredLocale?.languageTag ?? preferredLocale?.languageCode;
  // Never substitute an app language here. An empty list lets the native OCR
  // package use its platform default when the OS does not expose a locale.
  return deviceLanguage === undefined || deviceLanguage.trim().length === 0 ? [] : [deviceLanguage];
}

// 024. Keeps only finite confidence values returned by the provider.
function normalizeProviderConfidence(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// 025. Loads expo-image or reports that local image dimensions are unavailable.
function loadExpoImage(): ExpoImageApi {
  try {
    return require('expo-image') as ExpoImageApi;
  } catch (error) {
    throw new ReceiptOcrError(
      'NATIVE_MODULE_UNAVAILABLE',
      'Receipt image dimensions are unavailable in this native build',
      error,
    );
  }
}

// 026. Converts a logical image dimension and scale into validated pixel units.
function imagePixelDimension(value: unknown, scale: unknown, field: string): number {
  const logicalDimension = finiteNumber(value, field);
  const imageScale = finiteNumber(scale, 'image scale');
  const pixelDimension = logicalDimension * imageScale;
  if (!Number.isSafeInteger(pixelDimension) || pixelDimension <= 0) {
    throw new ReceiptOcrError('IMAGE_DECODE_FAILED', 'Native image returned invalid dimensions');
  }
  return pixelDimension;
}

// 027. Reads pixel dimensions from the local normalized receipt image.
async function readReceiptImageSize(uri: string): Promise<{ width: number; height: number }> {
  try {
    const { Image } = loadExpoImage();
    const image = await Image.loadAsync({ uri });
    return {
      width: imagePixelDimension(image.width, image.scale, 'image width'),
      height: imagePixelDimension(image.height, image.scale, 'image height'),
    };
  } catch (error) {
    if (error instanceof ReceiptOcrError) {
      throw error;
    }
    throw new ReceiptOcrError(
      'IMAGE_DECODE_FAILED',
      'The normalized receipt image could not be decoded',
      error,
    );
  }
}

// 028. Adapts expo-ai-kit recognition and bounds to the shared native OCR interface.
function createExpoAiKitAdapter(api: ExpoAiKitApi): ReceiptOcrNativeModule {
  return {
    // 029. Runs accurate recognition and maps each provider line with page geometry.
    recognize: async (uri, options) => {
      const languages = receiptOcrOptions(options);
      const imageSize = await readReceiptImageSize(uri);

      const result: RecognizeTextResult = await api.recognizeText(
        { uri },
        {
          languages,
          recognitionLevel: 'accurate',
          usesLanguageCorrection: true,
        },
      );

      return {
        // expo-ai-kit returns normalized image-space bounds. Dimensions come
        // from the same local normalized JPEG, so page geometry stays real.
        imageSize,
        lines: result.blocks.flatMap((block) =>
          block.lines.map((line) => ({
            text: line.text,
            confidence: normalizeProviderConfidence(line.confidence),
            boundingBox: line.bounds,
          })),
        ),
      };
    },
  };
}

export class ReceiptOcrError extends Error {
  readonly code: ReceiptOcrErrorCode;
  readonly cause: unknown;
  readonly retryable: boolean;

  // 030. Stores the stable error code, original cause, and retry policy.
  constructor(code: ReceiptOcrErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ReceiptOcrError';
    this.code = code;
    this.cause = cause;
    this.retryable = RETRYABLE_RECEIPT_OCR_ERROR_CODES.has(code);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// 031. Narrows unknown provider values to non-null objects.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// 032. Checks an unknown code against the supported OCR error set.
function isReceiptOcrErrorCode(value: unknown): value is ReceiptOcrErrorCode {
  return typeof value === 'string' && RECEIPT_OCR_ERROR_CODES.has(value as ReceiptOcrErrorCode);
}

// 033. Extracts a useful message from native or JavaScript errors.
function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return 'Receipt OCR failed';
}

// 034. Preserves typed OCR errors and maps unknown failures to a stable code.
export function mapReceiptOcrError(error: unknown): ReceiptOcrError {
  if (error instanceof ReceiptOcrError) {
    return error;
  }

  const code =
    isRecord(error) && isReceiptOcrErrorCode(error.code) ? error.code : 'NATIVE_OCR_FAILED';
  return new ReceiptOcrError(code, errorMessage(error), error);
}

// 035. Validates and narrows the native OCR model-readiness response.
function normalizeReceiptOcrAvailability(value: unknown): ReceiptOcrModelAvailability {
  if (!isRecord(value)) {
    throw new ReceiptOcrError('NATIVE_OCR_FAILED', 'Native OCR returned no model readiness status');
  }

  if (value.status === 'available') {
    return { status: 'available' };
  }
  if (value.status === 'downloadable' || value.status === 'downloading') {
    return { status: value.status };
  }

  if (
    value.status === 'unavailable' &&
    typeof value.reason === 'string' &&
    VISION_UNAVAILABLE_REASONS.includes(value.reason as VisionUnavailableReason)
  ) {
    return {
      status: 'unavailable',
      reason: value.reason as VisionUnavailableReason,
    };
  }

  throw new ReceiptOcrError(
    'NATIVE_OCR_FAILED',
    'Native OCR returned an invalid model readiness status',
  );
}

// 036. Converts an unavailable model reason into its corresponding OCR error.
function availabilityError(
  availability: Extract<ReceiptOcrModelAvailability, { status: 'unavailable' }>,
): ReceiptOcrError {
  const code =
    availability.reason === 'not-enabled' ? 'VISION_NOT_ENABLED' : 'DEVICE_NOT_SUPPORTED';
  return new ReceiptOcrError(code, `Receipt OCR is unavailable: ${availability.reason}`);
}

// 037. Returns the loaded provider API or throws a typed unavailable-module error.
function requireExpoAiKit(): ExpoAiKitApi {
  const api = loadExpoAiKit();
  if (api === null) {
    throw new ReceiptOcrError(
      'NATIVE_MODULE_UNAVAILABLE',
      'Receipt OCR is unavailable in this native build',
    );
  }
  return api;
}

// 038. Queries and normalizes current native text-recognition readiness.
export async function getReceiptOcrAvailability(): Promise<ReceiptOcrModelAvailability> {
  const api = requireExpoAiKit();

  try {
    const availability = await api.getVisionAvailability();
    return normalizeReceiptOcrAvailability(availability.textRecognition);
  } catch (error) {
    throw mapReceiptOcrError(error);
  }
}

// 039. Prepares the native text-recognition model and confirms it is usable.
export async function prepareReceiptOcr(
  options: ReceiptOcrPrepareOptions = {},
): Promise<ReceiptOcrModelAvailability> {
  const api = requireExpoAiKit();
  const languages = receiptOcrOptions(options);

  try {
    const current = await getReceiptOcrAvailability();
    if (current.status === 'available') {
      return current;
    }
    if (current.status === 'unavailable') {
      throw availabilityError(current);
    }

    await api.prepareVision({
      features: ['text-recognition'],
      languages,
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });

    const prepared = await getReceiptOcrAvailability();
    if (prepared.status === 'unavailable') {
      throw availabilityError(prepared);
    }
    return prepared;
  } catch (error) {
    throw mapReceiptOcrError(error);
  }
}

// 040. Accepts only non-empty local file URIs for on-device OCR.
export function validateReceiptOcrUri(uri: string): string {
  if (typeof uri !== 'string') {
    throw new ReceiptOcrError('INVALID_URI', 'Receipt OCR requires a local file URI');
  }

  const normalizedUri = uri.trim();
  if (normalizedUri.length === 0) {
    throw new ReceiptOcrError('INVALID_URI', 'Receipt OCR requires a local file URI');
  }

  const schemeSeparator = normalizedUri.indexOf('://');
  const scheme =
    schemeSeparator === -1 ? '' : normalizedUri.slice(0, schemeSeparator).toLowerCase();
  if (scheme !== 'file') {
    throw new ReceiptOcrError(
      'UNSUPPORTED_URI_SCHEME',
      'Receipt OCR only accepts local file:// URIs',
    );
  }

  if (normalizedUri.slice('file://'.length).length === 0) {
    throw new ReceiptOcrError('INVALID_URI', 'Receipt OCR requires a file path');
  }

  return normalizedUri;
}

// 041. Validates a provider value as a finite number.
function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ReceiptOcrError('NATIVE_OCR_FAILED', `Native OCR returned an invalid ${field}`);
  }
  return value;
}

// 042. Clamps a numeric value to the supplied inclusive range.
function bounded(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// 043. Clamps a coordinate and rounds it to six decimal places.
function normalized(value: number, minimum: number, maximum: number): number {
  return Number(bounded(value, minimum, maximum).toFixed(6));
}

// 044. Converts pixel or normalized provider bounds into a clamped normalized box.
function normalizeBoundingBox(
  value: unknown,
  imageSize: ReceiptOcrResult['imageSize'],
): ReceiptOcrBoundingBox {
  if (!isRecord(value)) {
    throw new ReceiptOcrError('NATIVE_OCR_FAILED', 'Native OCR returned no bounding box');
  }

  const rawX = finiteNumber(value.x, 'bounding-box x');
  const rawY = finiteNumber(value.y, 'bounding-box y');
  const rawWidth = finiteNumber(value.width, 'bounding-box width');
  const rawHeight = finiteNumber(value.height, 'bounding-box height');

  if (rawWidth < 0 || rawHeight < 0) {
    throw new ReceiptOcrError('NATIVE_OCR_FAILED', 'Native OCR returned a negative bounding box');
  }

  // Older compiled clients can still return pixel-space boxes; convert them before clamping.
  // Clamping first would collapse those coordinates at the image's lower-right edge.
  const isPixelSpace = [rawX, rawY, rawWidth, rawHeight].some((part) => part > 1);
  const xValue = isPixelSpace ? rawX / imageSize.width : rawX;
  const yValue = isPixelSpace ? rawY / imageSize.height : rawY;
  const widthValue = isPixelSpace ? rawWidth / imageSize.width : rawWidth;
  const heightValue = isPixelSpace ? rawHeight / imageSize.height : rawHeight;
  const x = normalized(xValue, 0, 1);
  const y = normalized(yValue, 0, 1);

  return {
    x,
    y,
    width: normalized(widthValue, 0, 1 - x),
    height: normalized(heightValue, 0, 1 - y),
  };
}

// 045. Validates one provider line, trims text, and normalizes confidence and bounds.
function normalizeLine(
  value: unknown,
  imageSize: ReceiptOcrResult['imageSize'],
): ReceiptOcrLine | null {
  if (!isRecord(value) || typeof value.text !== 'string') {
    throw new ReceiptOcrError('NATIVE_OCR_FAILED', 'Native OCR returned an invalid text line');
  }

  const text = value.text.trim();
  if (text.length === 0) {
    return null;
  }

  const confidence =
    value.confidence === null || value.confidence === undefined
      ? null
      : bounded(finiteNumber(value.confidence, 'confidence'), 0, 1);
  return {
    text,
    confidence,
    boundingBox: normalizeBoundingBox(value.boundingBox, imageSize),
  };
}

// 046. Validates provider output, removes empty lines, and orders lines by their boxes.
export function normalizeReceiptOcrResult(value: unknown): ReceiptOcrResult {
  if (!isRecord(value) || !isRecord(value.imageSize) || !Array.isArray(value.lines)) {
    throw new ReceiptOcrError('NATIVE_OCR_FAILED', 'Native OCR returned an invalid result');
  }

  const width = finiteNumber(value.imageSize.width, 'image width');
  const height = finiteNumber(value.imageSize.height, 'image height');
  if (width <= 0 || height <= 0) {
    throw new ReceiptOcrError('NATIVE_OCR_FAILED', 'Native OCR returned an invalid image size');
  }

  const lines = value.lines.flatMap((line) => {
    const normalizedLine = normalizeLine(line, { width, height });
    return normalizedLine ? [normalizedLine] : [];
  });

  if (lines.length === 0) {
    throw new ReceiptOcrError('NO_TEXT', 'No text was recognized in the receipt image');
  }

  return {
    imageSize: { width, height },
    lines: lines
      .map((line, index) => ({ line, index }))
      .sort((left, right) => {
        const yDifference = left.line.boundingBox.y - right.line.boundingBox.y;
        if (Math.abs(yDifference) > 0.0001) {
          return yDifference;
        }

        const xDifference = left.line.boundingBox.x - right.line.boundingBox.x;
        return xDifference === 0 ? left.index - right.index : xDifference;
      })
      .map(({ line }) => line),
  };
}

// 047. Validates OCR language options and selects a supported provider.
function normalizeOptions(options: ReceiptOcrOptions | undefined): ReceiptOcrOptions {
  if (options === undefined) {
    return {};
  }

  if (
    options.languages !== undefined &&
    (!Array.isArray(options.languages) ||
      options.languages.some(
        (language) => typeof language !== 'string' || language.trim().length === 0,
      ))
  ) {
    throw new ReceiptOcrError(
      'UNSUPPORTED_LANGUAGE',
      'Receipt OCR languages must be non-empty strings',
    );
  }

  return {
    ...(options.languages === undefined
      ? {}
      : { languages: options.languages.map((language) => language.trim()) }),
    provider: options.provider === 'google-mlkit' ? 'google-mlkit' : 'apple-vision',
  };
}

export { isGoogleMlKitAvailable };

// 048. Reports whether the expo-ai-kit module can be loaded in this build.
export function isReceiptOcrAvailable(): boolean {
  return loadExpoAiKit() !== null;
}

// 050. Validates the image, selects a provider, and normalizes its OCR result.
export async function recognizeReceiptOcr(
  uri: string,
  options?: ReceiptOcrOptions,
): Promise<ReceiptOcrResult> {
  const localUri = validateReceiptOcrUri(uri);
  const normalizedOptions = normalizeOptions(options);
  if (normalizedOptions.provider === 'google-mlkit') {
    if (!isGoogleMlKitAvailable()) {
      throw new ReceiptOcrError(
        'DEVICE_NOT_SUPPORTED',
        'Google ML Kit is not available in this iOS build or on this device.',
      );
    }
    try {
      const imageSize = await readReceiptImageSize(localUri);
      const result = await recognizeWithGoogleMlKit(localUri);
      return normalizeReceiptOcrResult({
        imageSize,
        lines: result.blocks.flatMap((block) =>
          block.lines.map((line) => ({
            text: line.text,
            confidence: null,
            boundingBox: line.boundingBox,
          })),
        ),
      });
    } catch (error) {
      throw mapReceiptOcrError(error);
    }
  }

  const api = loadExpoAiKit();

  if (api === null) {
    throw new ReceiptOcrError(
      'NATIVE_MODULE_UNAVAILABLE',
      'Receipt OCR is unavailable in this native build',
    );
  }

  try {
    const readiness = await prepareReceiptOcr(normalizedOptions);
    if (readiness.status !== 'available') {
      throw new ReceiptOcrError('MODEL_NOT_DOWNLOADED', 'Receipt OCR is not ready on this device');
    }

    const nativeResult = await createExpoAiKitAdapter(api).recognize(localUri, normalizedOptions);
    return normalizeReceiptOcrResult(nativeResult);
  } catch (error) {
    throw mapReceiptOcrError(error);
  }
}
