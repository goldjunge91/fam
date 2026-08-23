export const PREFERENCE_NAMESPACE_UUID = 'bd168b04-a426-4fe0-a30d-ea926d0b2700';

export type ShoppingCategoryPreferenceKey = {
  householdId: string;
  keyType: 'product' | 'name';
  normalizedKeyValue: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CANONICAL_PRODUCT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const textEncoder = new TextEncoder();

function uuidToBytes(uuid: string): Uint8Array {
  if (!UUID_PATTERN.test(uuid)) {
    throw new Error(`Ungültige UUID: ${uuid}`);
  }

  const hex = uuid.replaceAll('-', '').toLowerCase();
  return Uint8Array.from({ length: 16 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Bytegenaue, versionierte natürliche Identität. Die Länge bezieht sich
 * bewusst auf UTF-8-Bytes, damit auch Namen mit Umlauten eindeutig bleiben.
 */
export function canonicalPreferenceKey(input: ShoppingCategoryPreferenceKey): string {
  const householdId = input.householdId.toLowerCase();
  if (!UUID_PATTERN.test(householdId)) {
    throw new Error(`Ungültige householdId: ${input.householdId}`);
  }
  if (
    input.normalizedKeyValue.length === 0 ||
    input.normalizedKeyValue.length > 500 ||
    input.normalizedKeyValue !== input.normalizedKeyValue.trim().toLowerCase()
  ) {
    throw new Error(
      'normalizedKeyValue muss 1 bis 500 Zeichen lang, getrimmt und kleingeschrieben sein',
    );
  }
  if (
    input.keyType === 'product' &&
    !CANONICAL_PRODUCT_UUID_PATTERN.test(input.normalizedKeyValue)
  ) {
    throw new Error('Product-Preferences benötigen eine UUID als normalizedKeyValue');
  }

  const valueByteLength = textEncoder.encode(input.normalizedKeyValue).byteLength;
  return [
    'shopping-category-preference/v1',
    householdId,
    input.keyType,
    `${valueByteLength}:${input.normalizedKeyValue}`,
  ].join('\n');
}

export function preferenceIdentityHashInput(input: ShoppingCategoryPreferenceKey): ArrayBuffer {
  const namespace = uuidToBytes(PREFERENCE_NAMESPACE_UUID);
  const name = textEncoder.encode(canonicalPreferenceKey(input));
  const hashInput = new Uint8Array(new ArrayBuffer(namespace.byteLength + name.byteLength));
  hashInput.set(namespace);
  hashInput.set(name, namespace.byteLength);
  return hashInput.buffer;
}

export function uuidV5FromSha1Digest(digest: ArrayBuffer | Uint8Array): string {
  const digestBytes = digest instanceof Uint8Array ? digest : new Uint8Array(digest);
  if (digestBytes.byteLength !== 20) {
    throw new Error(
      `UUIDv5 benötigt einen 20-Byte-SHA-1-Digest, erhalten: ${digestBytes.byteLength}`,
    );
  }

  const uuidBytes = digestBytes.slice(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  return bytesToUuid(uuidBytes);
}
