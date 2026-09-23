import { rmSync } from 'node:fs';
import { nativePlatformsForHost } from '../scripts/native-build/native-build-platform';
import { createNativeBuildFixture } from './native-build-fixture';

describe('native build artifact lock', () => {
  it('does not compile when no binary is registered, even without native projects', () => {
    const fixture = createNativeBuildFixture();
    try {
      expect(fixture.native('baseline', '--approve-rebuild').status).toBe(0);
      const target =
        nativePlatformsForHost()[0] === 'ios' ? 'ios-production' : 'android-production';
      const result = fixture.native('run', '--target', target);
      expect(result.status).toBe(1);
      expect(result.output).toContain(`Kein Artefakt für ${target} registriert`);
      expect(result.output).toContain('Kein automatischer Rebuild');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }, 60_000);
});
