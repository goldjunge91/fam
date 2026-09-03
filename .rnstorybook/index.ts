import AsyncStorage from '@react-native-async-storage/async-storage';

import { view } from './storybook.requires';

/**
 * This file is user-editable.
 *
 * Use it as your React Native Storybook entrypoint and wrap `StorybookUIRoot`
 * with application decorators/providers (theme, i18n, state, navigation, etc).
 *
 * Wird als Route unter `src/app/(storybook)/index.tsx` eingehängt, nicht als
 * eigener App-Root — dadurch bleiben Expo Router und AppProviders (Session,
 * QueryClient, Theme etc.) aktiv, siehe root-navigator.tsx.
 */
const StorybookUIRoot = view.getStorybookUI({
  shouldPersistSelection: true,
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
  enableWebsockets: true,
});

export default StorybookUIRoot;
