import { Gradients } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Farbschema-abhängiger Hub-Verlauf aus derselben Quelle wie die Theme-Farben. */
export function useHubGradient() {
  const scheme = useColorScheme();

  return Gradients.hub[scheme === 'dark' ? 'dark' : 'light'];
}
