/** @type {import('expo/fingerprint').Config} */
const config = {
  fileHookTransform(source, chunk) {
    // Dev-only seed commands cannot change the native binary.
    if (
      source.type !== 'contents' ||
      source.id !== 'packageJson:scripts' ||
      typeof chunk !== 'string'
    ) {
      return chunk;
    }

    const scripts = JSON.parse(chunk);
    for (const name of Object.keys(scripts)) {
      if (name.startsWith('seed:')) delete scripts[name];
    }
    return JSON.stringify(scripts);
  },
};

module.exports = config;
