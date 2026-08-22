import { canonicalPreferenceKey, uuidV5FromSha1Digest } from './preference-identity';
import { preferenceId } from './preference-identity.node';
import { PREFERENCE_ID_TEST_VECTORS } from './preference-identity-test-vectors';

describe('deterministische Preference-Identität', () => {
  it.each(PREFERENCE_ID_TEST_VECTORS)(
    'erzeugt den eingecheckten UUIDv5-Vektor %#',
    ({ input, canonicalKey, expectedId }) => {
      expect(canonicalPreferenceKey(input)).toBe(canonicalKey);
      expect(preferenceId(input)).toBe(expectedId);
    },
  );

  it('kanonisiert die Schreibweise der Household-UUID', () => {
    expect(preferenceId(PREFERENCE_ID_TEST_VECTORS[1].input)).toBe(
      preferenceId({
        ...PREFERENCE_ID_TEST_VECTORS[1].input,
        householdId: PREFERENCE_ID_TEST_VECTORS[1].input.householdId.toLowerCase(),
      }),
    );
  });

  it('verwendet UTF-8-Byte-Längen im kanonischen Schlüssel', () => {
    expect(canonicalPreferenceKey(PREFERENCE_ID_TEST_VECTORS[2].input)).toMatch(
      /\n15:crème fraîche$/,
    );
  });

  it('lehnt nicht normalisierte Schlüssel ab', () => {
    expect(() =>
      preferenceId({
        householdId: PREFERENCE_ID_TEST_VECTORS[0].input.householdId,
        keyType: 'name',
        normalizedKeyValue: ' HaferMilch ',
      }),
    ).toThrow(/normal/);
  });

  it('lehnt nicht kanonische Product-UUIDs vor der ID-Berechnung ab', () => {
    expect(() =>
      preferenceId({
        householdId: PREFERENCE_ID_TEST_VECTORS[0].input.householdId,
        keyType: 'product',
        normalizedKeyValue: '22222222-2222-4222-2222-222222222222',
      }),
    ).toThrow(/Product/);
  });

  it('lehnt einen Digest mit falscher Länge ab', () => {
    expect(() => uuidV5FromSha1Digest(new Uint8Array(16))).toThrow(/20-Byte/);
  });
});
