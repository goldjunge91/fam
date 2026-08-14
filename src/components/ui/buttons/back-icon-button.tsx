import { type Href, router } from 'expo-router';

import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons/header-icon-button';

type BackIconButtonProps = {
  /** Ausweichziel, falls keine Navigationshistorie vorhanden ist. */
  href?: Href;
  onPress?: () => void;
};

/**
 * Runder Zurueck-Button fuer Detail-Screens mit zentriertem Titel (`PageHeader`
 * mit `align="center"`) — Gegenstueck zum textbasierten `BackButton` fuer
 * Screens ohne zentrierten Titel.
 */
export function BackIconButton({ href, onPress }: BackIconButtonProps) {
  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (href) router.replace(href);
  }

  return (
    <HeaderIconButton label="Zurück" onPress={handlePress}>
      <ThemedText themeColor="accent" style={FontSize[19]}>
        ‹
      </ThemedText>
    </HeaderIconButton>
  );
}
