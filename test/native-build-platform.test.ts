import {
  isNativePlatformSupportedOnHost,
  nativePlatformsForHost,
} from '../scripts/native-build-platform';

describe('native build host platform', () => {
  it('checks only Android on Windows', () => {
    expect(nativePlatformsForHost('win32')).toEqual(['android']);
    expect(isNativePlatformSupportedOnHost('ios', 'win32')).toBe(false);
    expect(isNativePlatformSupportedOnHost('android', 'win32')).toBe(true);
  });

  it('keeps iOS and Android checks on macOS and Linux', () => {
    expect(nativePlatformsForHost('darwin')).toEqual(['ios', 'android']);
    expect(nativePlatformsForHost('linux')).toEqual(['ios', 'android']);
    expect(isNativePlatformSupportedOnHost('ios', 'darwin')).toBe(true);
    expect(isNativePlatformSupportedOnHost('ios', 'linux')).toBe(true);
  });
});
