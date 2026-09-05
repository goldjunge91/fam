import { useTheme as useFamTheme } from '@/components/theme/ThemeProvider';

/** Legacy adapter. New components should use the Fam theme context directly. */
export function useTheme() {
  return useFamTheme().colors;
}
