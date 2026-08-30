/** @type {import('expo/fingerprint').Config} */
const config = {
  // Package scripts do not alter native compatibility and must not invalidate locked builds.
  sourceSkips: ['PackageJsonScriptsAll'],
};

module.exports = config;
