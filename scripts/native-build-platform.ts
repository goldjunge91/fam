export type NativePlatform = 'ios' | 'android';

/**
 * Jeder Host pflegt nur die native Plattform, die er auch bauen kann: macOS
 * iOS, alle anderen Android. Fremde Baseline-Eintraege bleiben unangetastet.
 */
export function nativePlatformsForHost(
  hostPlatform: NodeJS.Platform = process.platform,
): readonly NativePlatform[] {
  return hostPlatform === 'darwin' ? ['ios'] : ['android'];
}

export function isNativePlatformSupportedOnHost(
  platform: NativePlatform,
  hostPlatform: NodeJS.Platform = process.platform,
): boolean {
  return hostPlatform !== 'win32' || platform === 'android';
}
