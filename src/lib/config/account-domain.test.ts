import { getPasswordRecoveryUrl, normalizeAccountDomain } from './account-domain';

describe('account recovery domain', () => {
  it('normalizes a host and derives the HTTPS app-opening URL', () => {
    const domain = normalizeAccountDomain(' Account.Deine-Domain.de ');

    expect(domain).toBe('account.deine-domain.de');
    expect(getPasswordRecoveryUrl(domain ?? '')).toBe(
      'https://account.deine-domain.de/password-recovery',
    );
  });

  it('leaves local deep linking available when the host is missing', () => {
    expect(normalizeAccountDomain(undefined)).toBeUndefined();
    expect(normalizeAccountDomain('   ')).toBeUndefined();
  });

  it.each([
    'https://account.deine-domain.de',
    'account.deine-domain.de/path',
    'account.deine-domain.de:443',
    '127.0.0.1',
  ])('rejects values that are not one public hostname: %s', (value) => {
    expect(() => normalizeAccountDomain(value)).toThrow(
      'EXPO_PUBLIC_ACCOUNT_DOMAIN must be a DNS hostname without a URL path.',
    );
  });
});
