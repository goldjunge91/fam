import { render, screen, userEvent } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { NaturalLanguageBetaConsentSetting } from './natural-language-beta-consent-setting';

const mockGetAutomaticApplicationConsent = jest.fn();
const mockSetAutomaticApplicationConsent = jest.fn();
const mockGetQualityMetricsConsent = jest.fn();
const mockSetQualityMetricsConsent = jest.fn();
const mockGetContentDataConsent = jest.fn();
const mockSetContentDataConsent = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('./natural-language-beta-consent', () => ({
  naturalLanguageBetaConsentPort: {
    getAutomaticApplicationConsent: (...args: unknown[]) =>
      mockGetAutomaticApplicationConsent(...args),
    setAutomaticApplicationConsent: (...args: unknown[]) =>
      mockSetAutomaticApplicationConsent(...args),
    getQualityMetricsConsent: (...args: unknown[]) => mockGetQualityMetricsConsent(...args),
    setQualityMetricsConsent: (...args: unknown[]) => mockSetQualityMetricsConsent(...args),
    getContentDataConsent: (...args: unknown[]) => mockGetContentDataConsent(...args),
    setContentDataConsent: (...args: unknown[]) => mockSetContentDataConsent(...args),
  },
}));

describe('NaturalLanguageBetaConsentSetting', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockGetAutomaticApplicationConsent.mockReset();
    mockSetAutomaticApplicationConsent.mockReset();
    mockGetQualityMetricsConsent.mockReset();
    mockSetQualityMetricsConsent.mockReset();
    mockGetContentDataConsent.mockReset();
    mockSetContentDataConsent.mockReset();
    mockSetAutomaticApplicationConsent.mockResolvedValue(undefined);
    mockSetQualityMetricsConsent.mockResolvedValue(undefined);
    mockSetContentDataConsent.mockResolvedValue(undefined);
  });

  it('widerruft die automatische Anwendung aus der Settings-Zeile', async () => {
    mockGetAutomaticApplicationConsent.mockResolvedValue('granted');

    await render(<NaturalLanguageBetaConsentSetting />);
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', {
        name: 'Automatische Beta-Zuordnung: Erlaubt',
      }),
    );

    expect(mockSetAutomaticApplicationConsent).toHaveBeenCalledWith('user-1', 'revoked');
    expect(
      await screen.findByRole('button', {
        name: 'Automatische Beta-Zuordnung: Widerrufen',
      }),
    ).toBeOnTheScreen();
  });

  it('gibt die automatische Anwendung nach einem Widerruf wieder frei', async () => {
    mockGetAutomaticApplicationConsent.mockResolvedValue('revoked');

    await render(<NaturalLanguageBetaConsentSetting />);
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', {
        name: 'Automatische Beta-Zuordnung: Widerrufen',
      }),
    );

    expect(mockSetAutomaticApplicationConsent).toHaveBeenCalledWith('user-1', 'granted');
    expect(
      await screen.findByRole('button', {
        name: 'Automatische Beta-Zuordnung: Erlaubt',
      }),
    ).toBeOnTheScreen();
  });

  it('widerruft Qualitätsmetriken unabhängig von der Inhaltsfreigabe', async () => {
    mockGetQualityMetricsConsent.mockResolvedValue('granted');
    mockGetContentDataConsent.mockResolvedValue('revoked');

    await render(<NaturalLanguageBetaConsentSetting dimension="qualityMetrics" />);
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', {
        name: 'Beta-Qualitätsmetriken: Erlaubt',
      }),
    );

    expect(mockSetQualityMetricsConsent).toHaveBeenCalledWith('user-1', 'revoked');
    expect(mockSetContentDataConsent).not.toHaveBeenCalled();
  });

  it('widerruft Inhaltsdaten unabhängig von Qualitätsmetriken', async () => {
    mockGetContentDataConsent.mockResolvedValue('granted');
    mockGetQualityMetricsConsent.mockResolvedValue('revoked');

    await render(<NaturalLanguageBetaConsentSetting dimension="contentData" />);
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', {
        name: 'Beta-Inhaltsdaten: Erlaubt',
      }),
    );

    expect(mockSetContentDataConsent).toHaveBeenCalledWith('user-1', 'revoked');
    expect(mockSetQualityMetricsConsent).not.toHaveBeenCalled();
  });
});
