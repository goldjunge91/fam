/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "watch",
  icon: '../../assets/splash/fam-splash-icon.png',
  colors: { $accent: "darkcyan", },
  deploymentTarget: "9.4",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ??
      ["group.com.goldjunge91.fam1"],
  },
});
