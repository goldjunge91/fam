import type { StorybookConfig } from '@storybook/react-native';

const main: StorybookConfig = {
  stories: [
    './stories/**/*.stories.?(ts|tsx|js|jsx)',
    '../src/components/**/*.stories.?(ts|tsx|js|jsx)',
    '../src/features/**/*.stories.?(ts|tsx|js|jsx)',
  ],

  // addon-ondevice-actions faellt raus: das npm-Release 10.5.4 liefert keine
  // preview.js mit, wodurch Metro beim Bundling scheitert (Upstream-Bug).
  deviceAddons: ['@storybook/addon-ondevice-controls'],

  addons: ['@storybook/addon-mcp']
};

export default main;
