const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPushEntitlement(config) {
  if (process.env.EXPO_NO_PUSH_ENTITLEMENT !== "1") {
    return config;
  }

  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
};
