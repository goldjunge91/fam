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

  it('checks only iOS on macOS', () => {
    expect(nativePlatformsForHost('darwin')).toEqual(['ios']);
    expect(isNativePlatformSupportedOnHost('ios', 'darwin')).toBe(true);
  });

  it('checks only Android on Linux', () => {
    expect(nativePlatformsForHost('linux')).toEqual(['android']);
    expect(isNativePlatformSupportedOnHost('ios', 'linux')).toBe(true);
  });
});
