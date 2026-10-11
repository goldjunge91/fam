import * as Crypto from 'expo-crypto';
import { preferenceIdentityHashInput, uuidV5FromSha1Digest } from './preference-identity';
import { preferenceId } from './preference-identity.expo';
import { PREFERENCE_ID_TEST_VECTORS } from './preference-identity-test-vectors';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA1: 'SHA-1' },
  digest: jest.fn(),
}));

const mockDigest = jest.mocked(Crypto.digest);

describe('Expo preference identity adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the canonical hash bytes to Expo Crypto and formats its SHA-1 digest', async () => {
    const { input } = PREFERENCE_ID_TEST_VECTORS[0];
    const digest = Uint8Array.from({ length: 20 }, (_, index) => index).buffer;
    mockDigest.mockResolvedValue(digest);

    await expect(preferenceId(input)).resolves.toBe(uuidV5FromSha1Digest(digest));

    const [algorithm, data] = mockDigest.mock.calls[0] ?? [];
    expect(algorithm).toBe(Crypto.CryptoDigestAlgorithm.SHA1);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data).toEqual(new Uint8Array(preferenceIdentityHashInput(input)));
  });
});
