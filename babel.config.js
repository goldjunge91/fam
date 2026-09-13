module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
    ],
    plugins: [
      ['inline-import', { extensions: ['.sql'] }],
      'react-native-worklets/plugin',
      ['react-native-unistyles/plugin', { root: 'src' }],
    ],
  };
};
