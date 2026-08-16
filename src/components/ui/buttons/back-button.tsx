import { type Href, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { FamIcon } from '@/components/fam-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

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
   * 'arrow': runder Pfeil-Button im `MenuButton`-Look, fuer alle von den
   * Einstellungen aus erreichbaren Screens (#122, zusammengefuehrt aus den
   * frueher separaten `BackArrowButton`/`BackIconButton`-Dateien — Letzterer
   * war ungenutzt).
   */
  variant?: 'text' | 'arrow';
};

/** Zurueckbutton mit optionalem sicheren Ausweichziel, in zwei Varianten. */
export function BackButton({ label, href, variant = 'text' }: BackButtonProps) {
  if (variant === 'arrow') {
    return (
      <Pressable
        onPress={() => goBackTo(href)}
        accessibilityRole="button"
        accessibilityLabel={`Zurück zu ${label}`}
        style={styles.arrowButton}>
        <FamIcon name="arrow" size={54} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => goBackTo(href)}
      accessibilityRole="button"
      accessibilityLabel={`Zurück zu ${label}`}
      style={styles.textButton}>
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

const styles = StyleSheet.create({
  textButton: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    paddingRight: Spacing.three,
  },
  arrowButton: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
