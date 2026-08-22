import { createHash } from 'node:crypto';

import {
  preferenceIdentityHashInput,
  type ShoppingCategoryPreferenceKey,
  uuidV5FromSha1Digest,
} from './preference-identity';

/** UUIDv5-Adapter für Node-/Bun-Skripte und Tests. */
export function preferenceId(input: ShoppingCategoryPreferenceKey): string {
  const digest = createHash('sha1')
    .update(new Uint8Array(preferenceIdentityHashInput(input)))
    .digest();
  return uuidV5FromSha1Digest(digest);
}
