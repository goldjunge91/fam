import * as Crypto from 'expo-crypto';

import {
  preferenceIdentityHashInput,
  type ShoppingCategoryPreferenceKey,
  uuidV5FromSha1Digest,
} from './preference-identity';

/** UUIDv5-Adapter für die Expo-App. */
export async function preferenceId(input: ShoppingCategoryPreferenceKey): Promise<string> {
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA1,
    preferenceIdentityHashInput(input),
  );
  return uuidV5FromSha1Digest(digest);
}
