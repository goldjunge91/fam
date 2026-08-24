import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { CategoryFeedbackPlatform } from './feedback';

export type CategoryFeedbackMetadata = {
  platform: CategoryFeedbackPlatform;
  appVersion: string;
  buildChannel: string;
  clientCreatedAt: string;
};

function publicBuildChannel(): string | null {
  const environmentChannel = process.env.EXPO_PUBLIC_BUILD_CHANNEL?.trim();
  if (environmentChannel) return environmentChannel;

  const configuredChannel = Constants.expoConfig?.extra?.buildChannel;
  return typeof configuredChannel === 'string' && configuredChannel.trim()
    ? configuredChannel.trim()
    : null;
}

/** Stable SDK-57 metadata shared by Add/Edit feedback payloads. */
export function categoryFeedbackMetadata(now = new Date()): CategoryFeedbackMetadata {
  const platform: CategoryFeedbackPlatform =
    Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

  return {
    platform,
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? 'development',
    buildChannel: publicBuildChannel() ?? (__DEV__ ? 'development' : 'production'),
    clientCreatedAt: now.toISOString(),
  };
}
