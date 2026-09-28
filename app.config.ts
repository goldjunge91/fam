import type { ConfigContext, ExpoConfig } from 'expo/config';

type UpdateChannel = 'development' | 'preview' | 'preview-testflight' | 'production';

function getUpdateChannel(): UpdateChannel {
  const channel = process.env.FAM_UPDATE_CHANNEL;

  switch (channel) {
    case undefined:
      return 'preview-testflight';
    case 'development':
    case 'preview':
    case 'preview-testflight':
    case 'production':
      return channel;
    default:
      throw new Error(`Unknown FAM_UPDATE_CHANNEL: ${channel}`);
  }
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'fam',
  slug: config.slug ?? 'fam',
  extra: {
    ...config.extra,
    showUpdateExperience: process.env.FAM_SHOW_UPDATE_EXPERIENCE === '1',
    dummyUpdateExperience: process.env.FAM_DUMMY_UPDATE_EXPERIENCE === '1',
  },
  updates: {
    ...config.updates,
    requestHeaders: {
      ...config.updates?.requestHeaders,
      'expo-channel-name': getUpdateChannel(),
    },
  },
});
