import { Gradients, normalizeThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Farbschema-abhängiger Hub-Verlauf aus derselben Quelle wie die Theme-Farben. */
export function useHubGradient() {
  return Gradients.hub[normalizeThemeMode(useColorScheme())];
}
