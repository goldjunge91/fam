const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const SOURCE_PATH = path.join(
  'targets',
  'siri-main-app',
  'main-app-shopping-list-intent.swift',
);
const SOURCE_FILE = path.basename(SOURCE_PATH);

module.exports = function withMainAppSiriIntent(config) {
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const source = path.join(config.modRequest.projectRoot, SOURCE_PATH);
      const appTargetName = config.modRequest.projectName;
      if (!appTargetName) {
        throw new Error('withMainAppSiriIntent: unable to resolve the iOS app target directory');
      }

      const destination = path.join(
        config.modRequest.platformProjectRoot,
        appTargetName,
        SOURCE_FILE,
      );
      fs.copyFileSync(source, destination);
      return config;
    },
  ]);

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const applicationTarget = project.getTarget('com.apple.product-type.application');
    if (!applicationTarget) {
      throw new Error('withMainAppSiriIntent: iOS application target not found');
    }

    const appTargetName = applicationTarget.target.name;
    const filePath = path.join(appTargetName, SOURCE_FILE);
    if (!project.hasFile(filePath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: appTargetName,
        project,
        targetUuid: applicationTarget.uuid,
      });
    }

    const configurationList = project.pbxXCConfigurationList()[
      applicationTarget.target.buildConfigurationList
    ];
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const configuration of configurationList?.buildConfigurations ?? []) {
      const buildConfiguration = configurations[configuration.value];
      if (!buildConfiguration?.buildSettings) continue;

      const rawFlags = buildConfiguration.buildSettings.OTHER_SWIFT_FLAGS;
      const flags = (Array.isArray(rawFlags) ? rawFlags.join(' ') : String(rawFlags ?? '$(inherited)'))
        .replace(/^"(.*)"$/u, '$1')
        .trim();
      if (!flags.includes('-Xcc -DSQLITE_HAS_CODEC')) {
        buildConfiguration.buildSettings.OTHER_SWIFT_FLAGS =
          `"${flags} -Xcc -DSQLITE_HAS_CODEC"`;
      }
    }

    return config;
  });
};
