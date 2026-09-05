import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import * as ReactNative from 'react-native';
import type { MMKV } from 'react-native-mmkv';

import { Colors } from '@/components/theme/index';
import { getDeviceStorage } from '@/lib/storage/device-storage';

import {
  BUTTON_DEPTH,
  colorsDark,
  colorsLight,
  font,
  makeAccent,
  makeCategoryTone,
  radius,
  shadow,
  space,
} from './index';
import {
  DEFAULT_THEME_PREF,
  THEME_KEY,
  ThemeProvider,
  type ThemeStorage,
  useTheme,
} from './ThemeProvider';

jest.mock('@/lib/storage/device-storage', () => ({
  getDeviceStorage: jest.fn(),
}));

function createThemeStorage(initialValue?: string): ThemeStorage {
  let value = initialValue;
  const listeners = new Set<(key: string) => void>();

  return {
    getString: jest.fn((key) => (key === THEME_KEY ? value : undefined)),
    set: jest.fn((key, nextValue) => {
      if (key !== THEME_KEY || typeof nextValue !== 'string') return;
      value = nextValue;
      listeners.forEach((listener) => {
        listener(key);
      });
    }),
    addOnValueChangedListener: jest.fn((listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }),
  };
}

function ThemeWrapper({ children }: { children: ReactNode }) {
  return createElement(ThemeProvider, null, children);
}

describe('fam theme tokens', () => {
  it('maps canonical tokens and legacy aliases to the existing Fam palette', () => {
    expect(colorsLight.background).toBe(Colors.light.background);
    expect(colorsLight.backgroundElement).toBe(Colors.light.backgroundElement);
    expect(colorsLight.backgroundSoft).toBe(Colors.light.backgroundSoft);
    expect(colorsLight.accent).toBe(Colors.light.accent);
    expect(colorsLight.success).toBe(Colors.light.success);
    expect(colorsLight.warning).toBe(Colors.light.warning);
    expect(colorsLight.danger).toBe(Colors.light.danger);
    expect(colorsLight.shadowCard).toBe(Colors.light.shadowCard);
    expect(colorsLight.shadowSheet).toBe(Colors.light.shadowSheet);

    expect(colorsLight.bg).toBe(Colors.light.background);
    expect(colorsLight.surface).toBe(Colors.light.backgroundElement);
    expect(colorsLight.textMuted).toBe(Colors.light.textSecondary);
    expect(colorsLight.border).toBe(Colors.light.border);
    expect(colorsLight.basil).toBe(Colors.light.accent);

    expect(colorsDark.bg).toBe(Colors.dark.background);
    expect(colorsDark.surface).toBe(Colors.dark.backgroundElement);
    expect(colorsDark.textMuted).toBe(Colors.dark.textSecondary);
    expect(colorsDark.border).toBe(Colors.dark.border);
    expect(colorsDark.basil).toBe(Colors.dark.accent);

    expect(Object.keys(colorsDark).sort()).toEqual(Object.keys(colorsLight).sort());
  });

  it('keeps the existing primitive token surface available', () => {
    expect(makeAccent(colorsLight).pantry.main).toBe(colorsLight.basil);
    expect(makeCategoryTone(colorsLight).vegetable.tint).toBe(colorsLight.basilTint);
    expect(radius.md).toBe(16);
    expect(space.md).toBeGreaterThan(0);
    expect(font.sizes.base).toBeGreaterThan(0);
    expect(shadow.sm.elevation).toBe(2);
    expect(BUTTON_DEPTH).toBe(4);
  });
});

describe('Fam theme provider', () => {
  let storage: ThemeStorage;
  let colorSchemeMock: jest.SpyInstance;

  beforeEach(() => {
    storage = createThemeStorage();
    jest.mocked(getDeviceStorage).mockReturnValue(storage as MMKV);
    colorSchemeMock = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses system as the deterministic default and follows the OS mode', async () => {
    colorSchemeMock.mockReturnValue('dark');

    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeWrapper });

    expect(result.current.pref).toBe(DEFAULT_THEME_PREF);
    expect(result.current.mode).toBe('dark');
    expect(result.current.colors).toBe(require('./index').colorsDark);
  });

  it.each([
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
  ] as const)(
    'honors an explicit %s preference over %s system mode',
    async (pref, system, mode) => {
      storage = createThemeStorage(pref);
      jest.mocked(getDeviceStorage).mockReturnValue(storage as MMKV);
      colorSchemeMock.mockReturnValue(system);

      const { result } = await renderHook(() => useTheme(), { wrapper: ThemeWrapper });

      expect(result.current.pref).toBe(pref);
      expect(result.current.mode).toBe(mode);
    },
  );

  it('persists preference changes and reacts to later MMKV changes', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeWrapper });

    await act(async () => {
      result.current.setPref('dark');
    });

    expect(storage.set).toHaveBeenCalledWith(THEME_KEY, 'dark');
    expect(result.current.pref).toBe('dark');

    await act(async () => {
      storage.set(THEME_KEY, 'light');
    });

    expect(result.current.pref).toBe('light');
    expect(result.current.mode).toBe('light');
  });

  it('falls back to system for invalid stored values', async () => {
    storage = createThemeStorage('not-a-theme');
    jest.mocked(getDeviceStorage).mockReturnValue(storage as MMKV);
    colorSchemeMock.mockReturnValue('dark');

    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeWrapper });

    expect(result.current.pref).toBe('system');
    expect(result.current.mode).toBe('dark');
  });
});
