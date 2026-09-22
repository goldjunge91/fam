/** Supabase receipt_assets currently accepts images up to 5 MiB. */
export const RECEIPT_MAX_ASSET_BYTES = 5 * 1024 * 1024;

/** Keep the picker lossless; the shared normalizer owns JPEG compression. */
export const RECEIPT_IMAGE_PICKER_QUALITY = 1;

/** Long-edge cap chosen for readable receipt text while bounding upload size. */
export const RECEIPT_MAX_IMAGE_LONG_EDGE = 2_400;

/** Initial JPEG quality for the shared OCR/upload working file. */
export const RECEIPT_IMAGE_NORMALIZATION_QUALITY = 0.82;

export const RECEIPT_ASSET_BUCKET = 'receipt-images';
