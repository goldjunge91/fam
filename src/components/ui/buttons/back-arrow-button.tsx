import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { FamIcon } from '@/components/fam-icon';

import { goBackTo } from './back-button';
import type { BackTarget } from './back-button';

/**
 * Runder Zurueck-Button im selben Look wie `MenuButton` (58×58, radius 18,
 * durchscheinender Hintergrund) — fuer alle Screens, die von den
 * Einstellungen aus erreichbar sind. Das Pfeil-Icon (`arrow.svg`) bringt die
 * eigene abgerundete Umrandung schon mit, deshalb bekommt die Pressable
 * selbst keinen zusaetzlichen Hintergrund.
 */
export function BackArrowButton({ label, href }: BackTarget) {
  return (
    <Pressable
      onPress={() => goBackTo(href)}
      accessibilityRole="button"
      accessibilityLabel={`Zurück zu ${label}`}
      style={styles.button}>
      <FamIcon name="arrow" size={54} />
    </Pressable>
  );
}

/** Rendert den Pfeil-Zurueckbutton nur, wenn der Navigator wirklich zurueck kann. */
export function AutoBackArrowButton({ label }: Pick<BackTarget, 'label'>) {
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

  return canGoBack ? <BackArrowButton label={label} /> : null;
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
