import { renderHook } from '@testing-library/react-native';

import { useInterstitialAd } from './use-interstitial-ad';

let mockIsPremium = false;
let mockIsLoaded = false;
let mockIsClosed = false;
const mockRawShow = jest.fn();
const mockRawLoad = jest.fn();

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({
    isPremium: mockIsPremium,
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
  beforeEach(() => {
    mockIsPremium = false;
    mockIsLoaded = false;
    mockIsClosed = false;
    jest.clearAllMocks();
  });

  it('laedt automatisch im Hintergrund fuer Free-Nutzer', async () => {
    mockIsPremium = false;
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
    mockIsPremium = false;
    mockIsLoaded = true;

    const { result } = await renderHook(() => useInterstitialAd());

    expect(result.current.isLoaded).toBe(true);
    result.current.show();
    expect(mockRawShow).toHaveBeenCalledTimes(1);
  });

  it('deaktiviert Interstitials vollstaendig fuer Premium-Nutzer', async () => {
    mockIsPremium = true;
    mockIsLoaded = true;

    const { result } = await renderHook(() => useInterstitialAd());

    expect(result.current.isLoaded).toBe(false);
    expect(mockRawLoad).not.toHaveBeenCalled();
    result.current.show();
    expect(mockRawShow).not.toHaveBeenCalled();
  });
});
