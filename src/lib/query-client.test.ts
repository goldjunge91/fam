import AsyncStorage from '@react-native-async-storage/async-storage';

import { removeLegacyPersistedQueryCache } from '@/lib/query-client';
import { Sentry } from '@/lib/sentry';

jest.mock('@/lib/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}));

describe('removeLegacyPersistedQueryCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('entfernt den unverschluesselten Query-Cache alter App-Versionen', async () => {
    await removeLegacyPersistedQueryCache();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@fam/react-query-cache');
  });

  it('laesst einen fehlgeschlagenen Cleanup nicht als unbehandelte Promise entkommen', async () => {
    const error = new Error('storage unavailable');
    jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(error);

    await expect(removeLegacyPersistedQueryCache()).resolves.toBeUndefined();
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { source: 'legacy-query-cache-cleanup' },
    });
  });
});
