import type { ConfigContext, ExpoConfig } from 'expo/config';
import appConfig from '../../app.config';

describe('app link configuration', () => {
  it('preserves existing native settings without generating hosted recovery links', () => {
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

    expect(result.ios?.associatedDomains).toEqual(config.ios?.associatedDomains);
    expect(result.ios?.entitlements?.['com.apple.security.application-groups']).toContain(
      'group.example.test',
    );
    expect(result.android?.intentFilters).toEqual(config.android?.intentFilters);
  });

  it('does not generate recovery link configuration without existing native link settings', () => {
    const result = appConfig({ config: { name: 'fam', slug: 'fam' } } as ConfigContext);

    expect(result.ios?.associatedDomains).toBeUndefined();
    expect(result.android?.intentFilters).toBeUndefined();
  });
});
