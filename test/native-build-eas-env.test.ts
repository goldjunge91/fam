import { createEasLocalBuildEnvironment } from '../scripts/native-build/native-build-eas-env';

describe('EAS local build diagnostics environment', () => {
  it('prefers an explicit working directory and preserves diagnostics', () => {
    expect(
      createEasLocalBuildEnvironment({
        configuredWorkingDir: '/tmp/custom-eas-build',
        ccacheDir: '/tmp/ccache',
        projectRoot: '/workspace/fam',
      }),
    ).toEqual({
      workingDir: '/tmp/custom-eas-build',
      environment: {
        EAS_LOCAL_BUILD_WORKINGDIR: '/tmp/custom-eas-build',
        EAS_LOCAL_BUILD_SKIP_CLEANUP: '1',
      },
    });
  });

  it('uses the ccache parent when no explicit directory is configured', () => {
    expect(
      createEasLocalBuildEnvironment({
        ccacheDir: '/Users/marco/.cache/ccache',
        projectRoot: '/workspace/fam',
      }).workingDir,
    ).toBe('/Users/marco/.cache/eas-build-local-workingdir');
  });

  it('still provides an explicit diagnostic path without ccache', () => {
    expect(
      createEasLocalBuildEnvironment({
        projectRoot: '/workspace/fam',
        temporaryRoot: '/tmp',
      }),
    ).toEqual({
      workingDir: '/tmp/fam-eas-build-local-workingdir',
      environment: {
        EAS_LOCAL_BUILD_WORKINGDIR: '/tmp/fam-eas-build-local-workingdir',
        EAS_LOCAL_BUILD_SKIP_CLEANUP: '1',
      },
    });
  });
});
