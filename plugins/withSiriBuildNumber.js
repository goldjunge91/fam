const { withMod } = require('expo/config-plugins');

module.exports = function withSiriBuildNumber(config) {
  return withMod(config, {
    platform: 'ios',
    mod: 'xcodeProjectBeta2',
    action: (config) => {
      const siriTarget = config.modResults.rootObject.props.targets.find(
        (target) => target.props.name === 'siri',
      );
      if (!siriTarget) {
        throw new Error('withSiriBuildNumber: Siri App Intents target not found');
      }

      siriTarget.setBuildSetting(
        'CURRENT_PROJECT_VERSION',
        String(config.ios?.buildNumber ?? '1'),
      );
      return config;
    },
  });
};
