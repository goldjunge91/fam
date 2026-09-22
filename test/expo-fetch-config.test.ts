import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..');

describe('Expo fetch transport configuration', () => {
  it('pins React Native fetch in the versioned example environment', () => {
    const contents = readFileSync(resolve(projectRoot, '.env.example'), 'utf8');
    expect(contents).toMatch(/^EXPO_PUBLIC_USE_RN_FETCH=1$/m);
  });

  it('pins React Native fetch in every EAS build profile after resolving extends', () => {
    const eas = JSON.parse(readFileSync(resolve(projectRoot, 'eas.json'), 'utf8')) as {
      build: Record<string, { extends?: string; env?: Record<string, string> }>;
    };

    function effectiveEnv(profileName: string, trail: readonly string[] = []): Record<string, string> {
      if (trail.includes(profileName)) {
        throw new Error(`Circular EAS profile inheritance: ${[...trail, profileName].join(' -> ')}`);
      }
      const profile = eas.build[profileName];
      if (!profile) throw new Error(`Unknown EAS build profile: ${profileName}`);
      const inherited = profile.extends
        ? effectiveEnv(profile.extends, [...trail, profileName])
        : {};
      return { ...inherited, ...profile.env };
    }

    for (const profile of Object.keys(eas.build)) {
      expect(effectiveEnv(profile).EXPO_PUBLIC_USE_RN_FETCH).toBe('1');
    }
  });

  it('syncs the transport flag to EAS environments', () => {
    const syncScript = readFileSync(resolve(projectRoot, 'scripts/sync-eas-env.sh'), 'utf8');
    expect(syncScript).toContain("name: 'EXPO_PUBLIC_USE_RN_FETCH'");
    expect(syncScript).toContain("defaultValue: '1'");
  });
});
