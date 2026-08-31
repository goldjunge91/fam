export type NativePlatform = 'ios' | 'android';

export function nativePlatformsForHost(
  hostPlatform: NodeJS.Platform = process.platform,
): readonly NativePlatform[] {
  return hostPlatform === 'win32' ? ['android'] : ['ios', 'android'];
}

export function isNativePlatformSupportedOnHost(
  platform: NativePlatform,
  hostPlatform: NodeJS.Platform = process.platform,
): boolean {
  return hostPlatform !== 'win32' || platform === 'android';
}
