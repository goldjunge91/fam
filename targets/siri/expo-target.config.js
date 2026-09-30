/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "app-intent",
  deploymentTarget: "17.0",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ??
      ["group.com.goldjunge91.fam1"],
    // Eigener Keychain-Scope fuer den SQLCipher-Schluessel. Die App Group
    // ist ein eigenes Entitlement und macht ihre ID nicht automatisch zur
    // Keychain-Access-Group. Das Provisioning-Profil deckt `SW8RP7PA3W.*` ab,
    // nicht `group.*` — deshalb der vollstaendige Name mit Team-ID.
    "keychain-access-groups": ["SW8RP7PA3W.com.goldjunge91.fam1"],
  },
});
