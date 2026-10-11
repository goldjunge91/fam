import { renderHook } from '@testing-library/react-native';

import { useAdsConsentStore } from '../ads-consent';
import { useInterstitialAd } from './use-interstitial-ad';
import { useInterstitialAd as useAndroidInterstitialAd } from './use-interstitial-ad.android';
import { useInterstitialAd as useWebInterstitialAd } from './use-interstitial-ad.web';

let mockHasPlus = false;
let mockHasAI = false;
let mockIsLoaded = false;
let mockIsOpened = false;
let mockIsClosed = false;
let mockAdError: Error | undefined;
const mockRawShow = jest.fn();
const mockRawLoad = jest.fn();

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({
    hasPlus: mockHasPlus,
    hasAI: mockHasAI,
    isForced: false,
    customerInfo: null,
    loading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('react-native-google-mobile-ads', () => ({
  TestIds: {
    INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  },
  useInterstitialAd: (adUnitId: string | null) => ({
    isLoaded: adUnitId ? mockIsLoaded : false,
    isOpened: mockIsOpened,
    isClosed: mockIsClosed,
    error: mockAdError,
    load: mockRawLoad,
    show: mockRawShow,
  }),
}));

describe('useInterstitialAd', () => {
  const originalAdsEnabled = process.env.EXPO_PUBLIC_ADS_ENABLED;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'true';
    mockHasPlus = false;
    mockHasAI = false;
    mockIsLoaded = false;
    mockIsOpened = false;
    mockIsClosed = false;
    mockAdError = undefined;
    useAdsConsentStore.getState().setReady(true);
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalAdsEnabled === undefined) {
      delete process.env.EXPO_PUBLIC_ADS_ENABLED;
    } else {
      process.env.EXPO_PUBLIC_ADS_ENABLED = originalAdsEnabled;
    }
  });

  it('laedt automatisch im Hintergrund fuer Free-Nutzer', async () => {
    mockHasPlus = false;
    mockHasAI = false;
    mockIsLoaded = false;

    await renderHook(() => useInterstitialAd());

    expect(mockRawLoad).toHaveBeenCalledTimes(1);
  });

  it('startet nach dem Schliessen nur einen neuen Preload', async () => {
    mockIsClosed = true;

    await renderHook(() => useInterstitialAd());

    expect(mockRawLoad).toHaveBeenCalledTimes(1);
  });

  it('erlaubt Anzeigen wenn geladen', async () => {
    mockHasPlus = false;
    mockHasAI = false;
    mockIsLoaded = true;

    const { result } = await renderHook(() => useInterstitialAd());

    expect(result.current.isLoaded).toBe(true);
    result.current.show();
    expect(mockRawShow).toHaveBeenCalledTimes(1);
  });

  it('deaktiviert Interstitials vollstaendig fuer Plus-Nutzer', async () => {
    mockHasPlus = true;
    mockIsLoaded = true;

    const { result } = await renderHook(() => useInterstitialAd());

    expect(result.current.isLoaded).toBe(false);
    expect(mockRawLoad).not.toHaveBeenCalled();
    result.current.show();
    expect(mockRawShow).not.toHaveBeenCalled();
  });

  it('deaktiviert Interstitials vollstaendig fuer AI-Nutzer', async () => {
    mockHasAI = true;
    mockIsLoaded = true;

    const { result } = await renderHook(() => useInterstitialAd());

    expect(result.current.isLoaded).toBe(false);
    expect(mockRawLoad).not.toHaveBeenCalled();
    result.current.show();
    expect(mockRawShow).not.toHaveBeenCalled();
  });

  it('deaktiviert Interstitials bei global deaktivierter Werbung', async () => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'false';
    mockIsLoaded = true;

    const { result } = await renderHook(() => useInterstitialAd());

    expect(result.current.isLoaded).toBe(false);
    expect(mockRawLoad).not.toHaveBeenCalled();
    result.current.show();
    expect(mockRawShow).not.toHaveBeenCalled();
  });

  it('lädt keine Interstitials vor abgeschlossenem Consent', async () => {
    useAdsConsentStore.getState().setReady(false);

    await renderHook(() => useInterstitialAd());

    expect(mockRawLoad).not.toHaveBeenCalled();
  });

  it('deckt den Android-Adapter mit Auto-Load, explizitem Laden und Anzeigen ab', async () => {
    const hook = await renderHook(() => useAndroidInterstitialAd({ autoLoad: false }));
    expect(mockRawLoad).not.toHaveBeenCalled();

    mockIsLoaded = true;
    await hook.rerender({});
    expect(hook.result.current.isLoaded).toBe(true);

    hook.result.current.load();
    hook.result.current.show();

    expect(mockRawLoad).toHaveBeenCalledTimes(1);
    expect(mockRawShow).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'Plus entitlement',
      () => {
        mockHasPlus = true;
      },
    ],
    [
      'AI entitlement',
      () => {
        mockHasAI = true;
      },
    ],
    [
      'global ads switch',
      () => {
        process.env.EXPO_PUBLIC_ADS_ENABLED = 'false';
      },
    ],
    [
      'unfinished consent',
      () => {
        useAdsConsentStore.getState().setReady(false);
      },
    ],
  ])('keeps Android interstitials disabled for %s', async (_case, disable) => {
    disable();
    const { result } = await renderHook(() => useAndroidInterstitialAd());

    expect(result.current.isLoaded).toBe(false);
    expect(mockRawLoad).not.toHaveBeenCalled();
    result.current.show();
    expect(mockRawShow).not.toHaveBeenCalled();
  });

  it('does not preload an Android interstitial while it is open and warns if show is early', async () => {
    mockIsOpened = true;
    mockAdError = new Error('not ready');
    const { result } = await renderHook(() => useAndroidInterstitialAd({ autoLoad: true }));

    expect(mockRawLoad).not.toHaveBeenCalled();
    result.current.show();
    expect(mockRawShow).not.toHaveBeenCalled();
  });

  it('provides a no-op web interstitial adapter', async () => {
    const { result } = await renderHook(() => useWebInterstitialAd());

    expect(result.current).toEqual({
      isLoaded: false,
      isOpened: false,
      isClosed: false,
      error: undefined,
      load: expect.any(Function),
      show: expect.any(Function),
    });
    result.current.load();
    result.current.show();
  });
});
