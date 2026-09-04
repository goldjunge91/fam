/**
 * Theme context for the mobile app. Reads the persisted `srf:settings-theme`
 * preference (system | light | dark) via the reactive KV store and resolves it
 * against the OS color scheme. Exposes the active palette + accent map through
 * useTheme(), and a useThemedStyles() helper so screens can build StyleSheets
 * that re-derive when the theme flips.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import type { MMKV } from 'react-native-mmkv';

import { getDeviceStorage } from '@/lib/storage/device-storage';

import { colorsDark, colorsLight, makeAccent, type Palette } from './index';

export const THEME_KEY = 'srf:settings-theme';
export const DEFAULT_THEME_PREF = 'system' as const;
export type ThemePref = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';
export type ThemeStorage = Pick<MMKV, 'getString' | 'set' | 'addOnValueChangedListener'>;

type Accent = ReturnType<typeof makeAccent>;

export interface ThemeValue {
  mode: ThemeMode;
  pref: ThemePref;
  colors: Palette;
  accent: Accent;
  setPref: (pref: ThemePref) => void;
}

function parseThemePref(raw: string | undefined): ThemePref {
  return raw === 'dark' || raw === 'light' || raw === 'system' ? raw : DEFAULT_THEME_PREF;
}

function getThemeStorage(): ThemeStorage | null {
  try {
    return getDeviceStorage();
  } catch {
    // Web and environments without a native dev client can still follow the
    // system theme; persistence becomes available as soon as MMKV is present.
    return null;
  }
}

function readThemePref(storage: ThemeStorage | null): ThemePref {
  try {
    return parseThemePref(storage?.getString(THEME_KEY));
  } catch {
    return DEFAULT_THEME_PREF;
  }
}

function resolve(
  pref: ThemePref,
  system: ThemeMode,
  setPref: (nextPref: ThemePref) => void,
): ThemeValue {
  const mode: ThemeMode = pref === 'system' ? system : pref;
  const colors = mode === 'dark' ? colorsDark : colorsLight;
  return { mode, pref, colors, accent: makeAccent(colors), setPref };
}

const noopSetPref = (_pref: ThemePref) => undefined;
const ThemeContext = createContext<ThemeValue>(resolve(DEFAULT_THEME_PREF, 'light', noopSetPref));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const storage = useMemo(getThemeStorage, []);
  const [pref, setPrefState] = useState<ThemePref>(() => readThemePref(storage));
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    if (!storage) return;

    const listener = storage.addOnValueChangedListener((changedKey) => {
      if (changedKey === THEME_KEY) {
        setPrefState(readThemePref(storage));
      }
    });

    return () => listener.remove();
  }, [storage]);

  const setPref = useCallback(
    (nextPref: ThemePref) => {
      setPrefState(nextPref);
      try {
        storage?.set(THEME_KEY, nextPref);
      } catch {
        // Keep the in-memory preference usable if native persistence is unavailable.
      }
    },
    [storage],
  );

  const value = useMemo(() => resolve(pref, system, setPref), [pref, system, setPref]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** Build a memoized StyleSheet/object from the active palette + accent map. */
export function useThemedStyles<T>(factory: (c: Palette, accent: Accent) => T): T {
  const { colors, accent } = useTheme();
  return useMemo(() => factory(colors, accent), [colors, accent, factory]);
}
