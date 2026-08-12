const { withEntitlementsPlist } = require("expo/config-plugins");

// Personal Apple dev teams (free accounts) can't sign a profile that
// requests the Push Notifications capability. Strip aps-environment
// locally when EXPO_NO_PUSH_ENTITLEMENT=1 is set, so `expo run:ios
// --device` works without a paid Apple Developer membership.
module.exports = function withoutPushEntitlement(config) {
  if (process.env.EXPO_NO_PUSH_ENTITLEMENT !== "1") {
    return config;
  }

  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
};
