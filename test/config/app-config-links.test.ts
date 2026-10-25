import type { ConfigContext, ExpoConfig } from 'expo/config';
import appConfig from '../../app.config';

describe('app link configuration', () => {
  const originalDomain = process.env.EXPO_PUBLIC_ACCOUNT_DOMAIN;

  afterEach(() => {
    if (originalDomain === undefined) delete process.env.EXPO_PUBLIC_ACCOUNT_DOMAIN;
    else process.env.EXPO_PUBLIC_ACCOUNT_DOMAIN = originalDomain;
  });

  it('adds the recovery host while preserving existing native settings', () => {
    process.env.EXPO_PUBLIC_ACCOUNT_DOMAIN = 'account.deine-domain.de';
    const config: ExpoConfig = {
      name: 'fam',
      slug: 'fam',
      ios: {
        associatedDomains: ['applinks:existing.example.test'],
        entitlements: { 'com.apple.security.application-groups': ['group.example.test'] },
      },
      android: {
        package: 'com.goldjunge91.fam',
        intentFilters: [
          {
            action: 'VIEW',
            autoVerify: false,
            data: [{ scheme: 'fam', host: '*' }],
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ],
      },
    };

    const result = appConfig({ config } as ConfigContext);

    expect(result.ios?.associatedDomains).toEqual([
      'applinks:existing.example.test',
      'applinks:account.deine-domain.de',
    ]);
    expect(result.ios?.entitlements?.['com.apple.security.application-groups']).toContain(
      'group.example.test',
    );
    expect(result.android?.intentFilters).toEqual([
      ...config.android?.intentFilters ?? [],
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'account.deine-domain.de', path: '/password-recovery' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ]);
  });

  it('does not add a hosted link when no domain is configured', () => {
    delete process.env.EXPO_PUBLIC_ACCOUNT_DOMAIN;

    const result = appConfig({ config: { name: 'fam', slug: 'fam' } } as ConfigContext);

    expect(result.ios?.associatedDomains).toBeUndefined();
    expect(result.android?.intentFilters).toBeUndefined();
  });

  it('rejects an invalid host before native configuration is generated', () => {
    process.env.EXPO_PUBLIC_ACCOUNT_DOMAIN = 'https://account.deine-domain.de';

    expect(() => appConfig({ config: { name: 'fam', slug: 'fam' } } as ConfigContext)).toThrow(
      'EXPO_PUBLIC_ACCOUNT_DOMAIN must be a DNS hostname without a URL path.',
    );
  });
});
