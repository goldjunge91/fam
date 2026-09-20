import { render, screen, userEvent } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { NaturalLanguageBetaConsentSetting } from './natural-language-beta-consent-setting';

const mockGetAutomaticApplicationConsent = jest.fn();
const mockSetAutomaticApplicationConsent = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('./natural-language-beta-consent', () => ({
  naturalLanguageBetaConsentPort: {
    getAutomaticApplicationConsent: (...args: unknown[]) =>
      mockGetAutomaticApplicationConsent(...args),
    setAutomaticApplicationConsent: (...args: unknown[]) =>
      mockSetAutomaticApplicationConsent(...args),
  },
}));

describe('NaturalLanguageBetaConsentSetting', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockGetAutomaticApplicationConsent.mockReset();
    mockSetAutomaticApplicationConsent.mockReset();
    mockSetAutomaticApplicationConsent.mockResolvedValue(undefined);
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
});
