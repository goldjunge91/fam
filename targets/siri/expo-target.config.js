/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "app-intent",
  deploymentTarget: "17.0",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ??
      ["group.com.goldjunge91.fam1"],
    // "keychain-access-groups": ["group.com.goldjunge91.fam1"],
  },
});
