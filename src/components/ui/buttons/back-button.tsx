import { type Href, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { FamIcon } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { ButtonSize } from '@/constants/layout';

const ARROW_BUTTON_SIZE = ButtonSize.backArrow;

export type BackTarget = {
  /** Das Ziel beim Namen, z. B. `Einstellungen`. Erscheint als `‹ Einstellungen` bzw. als Accessibility-Label. */
  label: string;
  /** Ausweichziel, falls keine Navigationshistorie vorhanden ist. */
  href?: Href;
};

export function goBackTo(href: Href | undefined) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (href) router.replace(href);
}

type BackButtonProps = BackTarget & {
  /**
   * 'text' (Default): "‹ Ziel"-Link fuer Screens ohne zentrierten Titel.
   * 'arrow': runder Pfeil-Button fuer Settings-Screens.
   * 'header': Pfeil-Button in der Standardgroesse fuer zentrierte PageHeader.
   */
  variant?: 'text' | 'arrow' | 'header';
  /** Eigene Rueck-Aktion, etwa um einen Entwurf vor dem Verlassen zu verwerfen. */
  onPress?: () => void;
};

/** Zentraler Zurueckbutton mit optionalem sicheren Ausweichziel. */
export function BackButton({ label, href, variant = 'text', onPress }: BackButtonProps) {
  const handlePress = onPress ?? (() => goBackTo(href));

  if (variant === 'arrow' || variant === 'header') {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={variant === 'header' ? label : `Zurück zu ${label}`}
        className="btn-back-arrow">
        <FamIcon name="arrow" size={ARROW_BUTTON_SIZE} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Zurück zu ${label}`}
      className="self-start pt-two pb-one pr-three">
      <ThemedText type="smallBold" themeColor="accent">
        {`‹ ${label}`}
      </ThemedText>
    </Pressable>
  );
}

/** Rendert den Zurueckbutton nur, wenn der Navigator wirklich zurueck kann. */
export function AutoBackButton({ label, variant }: Pick<BackButtonProps, 'label' | 'variant'>) {
  const navigation = useNavigation();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const update = () => setCanGoBack(navigation.canGoBack());
    update();

    const unsubscribeState = navigation.addListener('state', update);
    const unsubscribeFocus = navigation.addListener('focus', update);

    return () => {
      unsubscribeState();
      unsubscribeFocus();
    };
  }, [navigation]);

  return canGoBack ? <BackButton label={label} variant={variant} /> : null;
}
