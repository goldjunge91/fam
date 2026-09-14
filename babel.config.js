module.exports = function (api) {
  // Babel runs in Node, so api.env('development') is the Babel equivalent of
  // the __DEV__ flag available inside the React Native application.
  const isDevelopment = api.env('development');

  return {
    presets: [
      'babel-preset-expo',
    ],
    plugins: [
      ['inline-import', { extensions: ['.sql'] }],
      ['react-native-unistyles/plugin', {
        // pass root folder of your application
        // all files under this folder will be processed by the Babel plugin
        // if you need to include more folders, or customize discovery process
        // check available babel options
        root: 'src',
        debug: isDevelopment,
      }],
      'react-native-worklets/plugin',
    ],
  };
};
