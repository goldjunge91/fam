import { type Href, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export type BackTarget = {
  /** Das Ziel beim Namen, z. B. `Einstellungen`. Erscheint als `‹ Einstellungen`. */
  label: string;
  /** Ausweichziel, falls keine Navigationshistorie vorhanden ist. */
  href?: Href;
};

function goBackTo(href: Href | undefined) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (href) router.replace(href);
}

/** Beschrifteter Zurueckbutton mit optionalem sicheren Ausweichziel. */
export function BackButton({ label, href }: BackTarget) {
  return (
    <Pressable
      onPress={() => goBackTo(href)}
      accessibilityRole="button"
      accessibilityLabel={`Zurück zu ${label}`}
      style={styles.button}>
      <ThemedText type="smallBold" themeColor="accent">
        {`‹ ${label}`}
      </ThemedText>
    </Pressable>
  );
}

/** Rendert den Zurueckbutton nur, wenn der Navigator wirklich zurueck kann. */
export function AutoBackButton({ label }: Pick<BackTarget, 'label'>) {
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

  return canGoBack ? <BackButton label={label} /> : null;
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    paddingRight: Spacing.three,
  },
});
