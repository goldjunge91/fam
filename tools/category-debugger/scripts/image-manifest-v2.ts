import path from 'node:path';

export const IMAGE_KINDS = ['front', 'ingredients', 'nutrition', 'packaging'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export type ManifestImage = {
  kind: ImageKind;
  language: string;
  imgid: string;
  selectedUrl: string;
  awsUrl: string;
  localPath: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function scalarString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return stringValue(value);
}

function barcodeFolder(value: string): string {
  const code = value.length < 13 ? value.padStart(13, '0') : value;
  return code.length > 8
    ? `${code.slice(0, 3)}/${code.slice(3, 6)}/${code.slice(6, 9)}/${code.slice(9)}`
    : code;
}

function preferredLanguage(availableLanguages: readonly string[], product: JsonRecord): string | null {
  const available = [...availableLanguages].sort();
  const productLanguages = [stringValue(product.lc), stringValue(product.lang)]
    .filter((language): language is string => Boolean(language && /^[a-z]{2,3}$/i.test(language)))
    .map((language) => language.toLowerCase());
  for (const language of ['de', ...productLanguages, 'en']) {
    if (available.includes(language)) return language;
  }
  return available[0] ?? null;
}

function selectedImageUrl(selected: JsonRecord, product: JsonRecord): { language: string; url: string } | null {
  for (const size of ['display', 'small', 'thumb']) {
    const urls = asRecord(selected[size]);
    if (!urls) continue;
    const language = preferredLanguage(Object.keys(urls).filter((candidate) => typeof urls[candidate] === 'string'), product);
    const url = language ? stringValue(urls[language]) : null;
    if (language && url) return { language, url };
  }
  return null;
}

/**
 * Liest die Bild-Metadaten (rev/imgid/sizes) fuer ein kind+language-Paar aus
 * `images` — unterstuetzt zwei OFF-Exportformen nebeneinander, weil beide im
 * aktuellen Dump gleichzeitig vorkommen (aeltere, zuletzt lange nicht mehr
 * bearbeitete Produkte tragen noch das alte Format):
 * - aktuell: verschachtelt unter `images.selected.<kind>.<language>`
 * - veraltet: flach unter `images.<kind>_<language>`
 * Stichprobe gegen den echten Dump (2026-08): ~97% der Produkte mit Bildern
 * nutzen das verschachtelte, ~3% noch das flache Format.
 */
function selectedMetadata(images: JsonRecord, kind: ImageKind, language: string): JsonRecord | null {
  const nested = asRecord(asRecord(images.selected)?.[kind]);
  const fromNested = asRecord(nested?.[language]);
  if (fromNested) return fromNested;
  return asRecord(images[`${kind}_${language}`]);
}

function availableSelectedLanguages(images: JsonRecord, kind: ImageKind): string[] {
  const nested = asRecord(asRecord(images.selected)?.[kind]);
  const nestedLanguages = nested ? Object.keys(nested).filter((language) => asRecord(nested[language])) : [];
  const prefix = `${kind}_`;
  const flatLanguages = Object.keys(images)
    .filter((key) => key.startsWith(prefix) && asRecord(images[key]))
    .map((key) => key.slice(prefix.length))
    .filter(Boolean);
  return [...new Set([...nestedLanguages, ...flatLanguages])];
}

function metadataImageUrl(code: string, kind: ImageKind, product: JsonRecord, images: JsonRecord): { language: string; url: string } | null {
  const language = preferredLanguage(availableSelectedLanguages(images, kind), product);
  if (!language) return null;
  const metadata = selectedMetadata(images, kind, language);
  const revision = scalarString(metadata?.rev);
  const sizes = asRecord(metadata?.sizes);
  if (!metadata || !revision || !sizes) return null;
  const size = ['400', '200', '100', 'full'].find((candidate) => asRecord(sizes[candidate]));
  if (!size) return null;
  const filename = `${kind}_${language}.${revision}.${size}.jpg`;
  return {
    language,
    url: `https://images.openfoodfacts.org/images/products/${barcodeFolder(code)}/${filename}`,
  };
}

function safeSelectedUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const isOpenFoodFactsHost = url.hostname === 'openfoodfacts.org' || url.hostname.endsWith('.openfoodfacts.org');
    if (url.protocol !== 'https:' || !isOpenFoodFactsHost) return null;
    return url;
  } catch {
    return null;
  }
}

function manifestImage(code: string, kind: ImageKind, language: string, selectedUrl: string, images: JsonRecord): ManifestImage | null {
  const parsedUrl = safeSelectedUrl(selectedUrl);
  if (!parsedUrl) return null;
  const filename = path.posix.basename(parsedUrl.pathname);
  if (!filename.toLowerCase().endsWith('.jpg')) return null;
  const metadata = selectedMetadata(images, kind, language);
  const imgid = stringValue(metadata?.imgid) ?? `selected:${stringValue(metadata?.rev) ?? 'unknown'}`;
  return {
    kind,
    language,
    imgid,
    selectedUrl,
    awsUrl: selectedUrl,
    localPath: path.posix.join('selected-400', barcodeFolder(code), filename),
  };
}

export function extractManifestImages(input: unknown): { code: string; images: ManifestImage[] } | null {
  const outer = asRecord(input);
  if (!outer) return null;
  const product = asRecord(outer.product) ?? outer;
  const code = stringValue(product.code) ?? stringValue(product._id);
  if (!code || !/^\d{6,32}$/.test(code)) return null;
  const selectedImages = asRecord(product.selected_images) ?? {};
  const images = asRecord(product.images) ?? {};
  const result: ManifestImage[] = [];
  for (const kind of IMAGE_KINDS) {
    const selected = asRecord(selectedImages[kind]);
    const choice = selected
      ? selectedImageUrl(selected, product)
      : metadataImageUrl(code, kind, product, images);
    if (!choice) continue;
    const image = manifestImage(code, kind, choice.language, choice.url, images);
    if (image) result.push(image);
  }
  return { code, images: result };
}
