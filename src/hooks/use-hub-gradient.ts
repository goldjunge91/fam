import { Gradients, normalizeThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useHubGradient() {
  return Gradients.hub[normalizeThemeMode(useColorScheme())];
}
