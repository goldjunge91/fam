import { Gradients, normalizeThemeMode } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';

/** Farbschema-abhängiger Hub-Verlauf aus derselben Quelle wie die Theme-Farben. */
export function useHubGradient() {
  const { mode } = useTheme();
  return Gradients.hub[normalizeThemeMode(mode)];
}
