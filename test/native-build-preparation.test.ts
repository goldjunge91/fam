import { determineNativeBuildPreparation } from '../scripts/native-build/native-build';

describe('native build preparation', () => {
  it('reuses the native project and Pods when the fingerprint is unchanged', () => {
    expect(
      determineNativeBuildPreparation({
        platform: 'ios',
        nativeProjectExists: true,
        baselineFingerprint: 'same',
        currentFingerprint: 'same',
        podsAreSynchronized: true,
      }),
    ).toEqual({ needsPrebuild: false, needsPodInstall: false });
  });

  it('regenerates native inputs when the fingerprint changed', () => {
    expect(
      determineNativeBuildPreparation({
        platform: 'ios',
        nativeProjectExists: true,
        baselineFingerprint: 'before',
        currentFingerprint: 'after',
        podsAreSynchronized: true,
      }),
    ).toEqual({ needsPrebuild: true, needsPodInstall: false });
  });

  it('installs missing Pods without regenerating an unchanged native project', () => {
    expect(
      determineNativeBuildPreparation({
        platform: 'ios',
        nativeProjectExists: true,
        baselineFingerprint: 'same',
        currentFingerprint: 'same',
        podsAreSynchronized: false,
      }),
    ).toEqual({ needsPrebuild: false, needsPodInstall: true });
  });

  it('does not run CocoaPods for Android', () => {
    expect(
      determineNativeBuildPreparation({
        platform: 'android',
        nativeProjectExists: true,
        baselineFingerprint: 'before',
        currentFingerprint: 'after',
        podsAreSynchronized: false,
      }),
    ).toEqual({ needsPrebuild: true, needsPodInstall: false });
  });
});
