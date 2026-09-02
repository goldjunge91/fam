import { act, render, screen } from '@testing-library/react-native';

import { useAdsConsentStore } from '../ads-consent';
import { AdBanner } from './ad-banner';

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
});
