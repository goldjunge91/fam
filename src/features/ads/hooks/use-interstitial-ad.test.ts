import { renderHook } from '@testing-library/react-native';

import { useAdsConsentStore } from '../ads-consent';
import { useInterstitialAd } from './use-interstitial-ad';

let mockHasPlus = false;
let mockHasAI = false;
let mockIsLoaded = false;
let mockIsClosed = false;
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
    isOpened: false,
    isClosed: mockIsClosed,
    error: undefined,
    load: mockRawLoad,
    show: mockRawShow,
  }),
}));

describe('useInterstitialAd', () => {
  const originalAdsEnabled = process.env.EXPO_PUBLIC_ADS_ENABLED;

  beforeEach(() => {
    mockHasPlus = false;
    mockHasAI = false;
    mockIsLoaded = false;
    mockIsClosed = false;
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
});
