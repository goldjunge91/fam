import { act, render, screen } from '@testing-library/react-native';

import { useAdsConsentStore } from '../ads-consent';
import { AdBanner } from './ad-banner';
import { AdBanner as AndroidAdBanner } from './ad-banner.android';

let mockHasPlus = false;
let mockHasAI = false;

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

describe('AdBanner', () => {
  const originalAdsEnabled = process.env.EXPO_PUBLIC_ADS_ENABLED;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'true';
    mockHasPlus = false;
    mockHasAI = false;
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

  it('rendert Banner fuer Free-Nutzer', async () => {
    mockHasPlus = false;
    mockHasAI = false;
    await render(<AdBanner />);

    expect(screen.getByTestId('admob-banner-container')).toBeOnTheScreen();
    expect(screen.getByTestId('admob-banner-ad')).toBeOnTheScreen();
  });

  it('blendet Banner fuer Plus-Nutzer vollstaendig aus', async () => {
    mockHasPlus = true;
    await render(<AdBanner />);

    expect(screen.queryByTestId('admob-banner-container')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('admob-banner-ad')).not.toBeOnTheScreen();
  });

  it('blendet Banner fuer AI-Nutzer vollstaendig aus', async () => {
    mockHasAI = true;
    await render(<AdBanner />);

    expect(screen.queryByTestId('admob-banner-container')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('admob-banner-ad')).not.toBeOnTheScreen();
  });

  it('blendet Banner bei global deaktivierter Werbung vollstaendig aus', async () => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'false';

    await render(<AdBanner />);

    expect(screen.queryByTestId('admob-banner-container')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('admob-banner-ad')).not.toBeOnTheScreen();
  });

  it('blendet Banner aus, solange der Consent noch nicht abgeschlossen ist', async () => {
    useAdsConsentStore.getState().setReady(false);

    await render(<AdBanner />);

    expect(screen.queryByTestId('admob-banner-container')).not.toBeOnTheScreen();
  });

  it('faellt bei einem Ladefehler still zusammen (rendert null)', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockHasPlus = false;
    mockHasAI = false;
    const onFailed = jest.fn();

    await render(<AdBanner onAdFailedToLoad={onFailed} />);

    const bannerElement = screen.getByTestId('admob-banner-ad');
    expect(bannerElement).toBeOnTheScreen();

    // Trigger onAdFailedToLoad callback from BannerAd
    await act(async () => {
      bannerElement.props.onAdFailedToLoad(new Error('No fill'));
    });

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('admob-banner-container')).not.toBeOnTheScreen();
  });

  it('rendert den Android-Banner und reicht Erfolgs-, Paid- und Fehler-Callbacks weiter', async () => {
    const onLoaded = jest.fn();
    const onFailed = jest.fn();
    await render(<AndroidAdBanner onAdLoaded={onLoaded} onAdFailedToLoad={onFailed} />);

    const banner = screen.getByTestId('admob-banner-ad');
    expect(screen.getByTestId('admob-banner-container')).toBeOnTheScreen();
    expect(banner.props.unitId).toBe('ca-app-pub-3940256099942544/6300978111');
    banner.props.onAdLoaded({ width: 320, height: 50 });
    banner.props.onPaid({ currency: 'EUR', precision: 3, value: 0.05 });
    expect(onLoaded).toHaveBeenCalledWith({ width: 320, height: 50 });

    await act(async () => {
      banner.props.onAdFailedToLoad(new Error('No fill'));
    });
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('admob-banner-container')).not.toBeOnTheScreen();
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
  ])('hides the Android banner for %s', async (_case, disable) => {
    disable();
    await render(<AndroidAdBanner />);

    expect(screen.queryByTestId('admob-banner-container')).not.toBeOnTheScreen();
  });
});
