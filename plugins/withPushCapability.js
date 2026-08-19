const { withXcodeProject } = require('expo/config-plugins');

/**
 * Expo Config Plugin to ensure Xcode project's TargetAttributes explicitly declare
 * the Push Notifications capability (com.apple.Push) and development team.
 *
 * This prevents Xcode from failing with:
 * "Provisioning Profile ... does not support the Push Notifications capability"
 * during local archive / signing steps.
 */
module.exports = function withPushCapability(config) {
  return withXcodeProject(config, (config) => {
    const pbxProject = config.modResults;
    const target = pbxProject.getFirstTarget();
    if (!target) return config;

    const targetUuid = target.uuid;
    const projectSection = pbxProject.pbxProjectSection();

    for (const key of Object.keys(projectSection)) {
      const projectObj = projectSection[key];
      if (projectObj && projectObj.attributes && projectObj.attributes.TargetAttributes) {
        if (!projectObj.attributes.TargetAttributes[targetUuid]) {
          projectObj.attributes.TargetAttributes[targetUuid] = {};
        }
        const targetAttrs = projectObj.attributes.TargetAttributes[targetUuid];
        if (!targetAttrs.SystemCapabilities) {
          targetAttrs.SystemCapabilities = {};
        }
        targetAttrs.SystemCapabilities['com.apple.Push'] = {
          enabled: '1',
        };
      }
    }

    return config;
  });
};
