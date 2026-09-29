import type { ConfigContext, ExpoConfig } from 'expo/config';

type UpdateChannel = 'development' | 'preview' | 'preview-testflight' | 'production';
const famAppGroup = 'group.com.goldjunge91.fam1';

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

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosMlKitOcrEnabled = process.env.FAM_IOS_MLKIT_OCR === '1';
  const existingAppGroups = config.ios?.entitlements?.['com.apple.security.application-groups'];
  const appGroups = [
    ...(Array.isArray(existingAppGroups)
      ? existingAppGroups.filter((group): group is string => typeof group === 'string')
      : []),
    famAppGroup,
  ];
  // expo-ai-kit provides Apple Vision; expo-mlkit-ocr provides the optional
  // Google ML Kit path. iosEngine only configures the latter package.
  const mlKitOcrPlugins: NonNullable<ExpoConfig['plugins']> =
    iosMlKitOcrEnabled
      ? [
          ['expo-ai-kit', { vision: true }],
          ['expo-mlkit-ocr', { iosEngine: 'mlkit' }],
          ['expo-build-properties', { ios: { useFrameworks: 'static', deploymentTarget: '17.0' } }],
        ]
      : [
          ['expo-ai-kit', { vision: true }],
          ['expo-mlkit-ocr', { iosEngine: 'vision' }],
        ];

  return {
    ...config,
    ios: {
      ...config.ios,
      entitlements: {
        ...config.ios?.entitlements,
        'com.apple.security.application-groups': [...new Set(appGroups)],
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      './plugins/withMainAppSiriIntent',
      './plugins/withSiriBuildNumber',
      '@bacons/apple-targets',
      './plugins/withIosSimulatorArm64',
      ...mlKitOcrPlugins,
    ],
    name: config.name ?? 'fam',
    slug: config.slug ?? 'fam',
    extra: {
      ...config.extra,
      iosMlKitOcrEnabled,
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
  };
};
