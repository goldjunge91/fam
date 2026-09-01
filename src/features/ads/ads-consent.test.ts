import { PermissionStatus } from 'expo-tracking-transparency';

import {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';

import { gatherAdsConsent, showAdsPrivacyOptions, useAdsConsentStore } from './ads-consent';

const mockGatherConsent = AdsConsent.gatherConsent as jest.Mock;
const mockGetConsentInfo = AdsConsent.getConsentInfo as jest.Mock;
const mockGetGdprApplies = AdsConsent.getGdprApplies as jest.Mock;
const mockGetPurposeConsents = AdsConsent.getPurposeConsents as jest.Mock;
const mockShowPrivacyOptionsForm = AdsConsent.showPrivacyOptionsForm as jest.Mock;
const mockGetTrackingPermissions = jest.fn();
const mockRequestTrackingPermissions = jest.fn();

jest.mock('react-native-google-mobile-ads', () => ({
  AdsConsent: {
    gatherConsent: jest.fn(),
    getConsentInfo: jest.fn(),
    getGdprApplies: jest.fn(),
    getPurposeConsents: jest.fn(),
    showPrivacyOptionsForm: jest.fn(),
  },
  AdsConsentPrivacyOptionsRequirementStatus: {
    UNKNOWN: 'UNKNOWN',
    REQUIRED: 'REQUIRED',
    NOT_REQUIRED: 'NOT_REQUIRED',
  },
}));

jest.mock('expo-tracking-transparency', () => ({
  PermissionStatus: {
    UNDETERMINED: 'undetermined',
    GRANTED: 'granted',
    DENIED: 'denied',
  },
  getTrackingPermissionsAsync: (...args: unknown[]) => mockGetTrackingPermissions(...args),
  requestTrackingPermissionsAsync: (...args: unknown[]) => mockRequestTrackingPermissions(...args),
}));

describe('ads consent', () => {
  const originalAdsEnabled = process.env.EXPO_PUBLIC_ADS_ENABLED;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'true';
    useAdsConsentStore.getState().setReady(false);
    mockGatherConsent.mockReset();
    mockGetConsentInfo.mockReset();
    mockGetGdprApplies.mockReset();
    mockGetPurposeConsents.mockReset();
    mockShowPrivacyOptionsForm.mockReset();
    mockGetTrackingPermissions.mockReset().mockResolvedValue({ status: PermissionStatus.DENIED });
    mockRequestTrackingPermissions.mockReset();
  });

  afterAll(() => {
    if (originalAdsEnabled === undefined) {
      delete process.env.EXPO_PUBLIC_ADS_ENABLED;
    } else {
      process.env.EXPO_PUBLIC_ADS_ENABLED = originalAdsEnabled;
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gibt Werbung erst nach erfolgreichem UMP-Consent frei', async () => {
    mockGatherConsent.mockResolvedValue({ canRequestAds: true });
    mockGetGdprApplies.mockResolvedValue(false);

    await expect(gatherAdsConsent()).resolves.toBe(true);
    expect(useAdsConsentStore.getState().ready).toBe(true);
  });

  it('blockiert Werbung, wenn UMP noch keine Anzeigen erlaubt', async () => {
    mockGatherConsent.mockResolvedValue({ canRequestAds: false });

    await expect(gatherAdsConsent()).resolves.toBe(false);
    expect(useAdsConsentStore.getState().ready).toBe(false);
  });

  it('fordert iOS-ATT nach erteiltem EEA-Purpose-1-Consent an', async () => {
    mockGatherConsent.mockResolvedValue({ canRequestAds: true });
    mockGetGdprApplies.mockResolvedValue(true);
    mockGetPurposeConsents.mockResolvedValue('1000000000');
    mockGetTrackingPermissions.mockResolvedValue({ status: PermissionStatus.UNDETERMINED });
    mockRequestTrackingPermissions.mockResolvedValue({ status: PermissionStatus.GRANTED });

    await expect(gatherAdsConsent()).resolves.toBe(true);
    expect(mockRequestTrackingPermissions).toHaveBeenCalledTimes(1);
  });

  it('öffnet die Privacy-Optionen nur bei erforderlichem Status', async () => {
    mockGetConsentInfo.mockResolvedValue({
      canRequestAds: true,
      privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    });
    mockShowPrivacyOptionsForm.mockResolvedValue({ canRequestAds: false });

    await expect(showAdsPrivacyOptions()).resolves.toBe(false);
    expect(mockShowPrivacyOptionsForm).toHaveBeenCalledTimes(1);
    expect(useAdsConsentStore.getState().ready).toBe(false);
  });
});
