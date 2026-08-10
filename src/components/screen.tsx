import { type Href, router, useNavigation } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing, TabBarHeight } from '@/constants/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Aktion rechts neben dem Titel, z. B. ein Hinzufuegen-Button. */
  action?: ReactNode;
  scroll?: boolean;
  /**
   * Wohin diese Seite zurueckfuehrt. Ohne Angabe gibt es keinen Knopf.
   *
   * Jede Seite benennt ihr Ziel selbst, statt dass ein generisches
   * "← Zurück" aus `router.canGoBack()` erraten wird. Die Automatik war aus
   * zwei Gruenden falsch:
   *
   * 1. Der Wert wurde einmal beim Rendern gelesen und nie wieder. Aenderte
   *    sich die Navigation danach, zeigte der Screen einen Knopf, den es nicht
   *    mehr gab — `router.back()` lief dann in
   *    "The action 'GO_BACK' was not handled by any navigator".
   * 2. Tab-Wechsel landen bei `NativeTabs` in der Historie. Damit meldete
   *    `canGoBack()` auch auf der Uebersicht irgendwann `true`, obwohl es dort
   *    nichts gibt, wohin man zurueckkehren koennte.
   *
   * Die Position ist bewusst fuer alle Seiten dieselbe: oben links ueber dem
   * Titel. Individuell ist nur die Beschriftung — und die nennt das Ziel.
   */
  back?: BackTarget;
};

export type BackTarget = {
  /** Das Ziel beim Namen, z. B. `Einstellungen`. Erscheint als `‹ Einstellungen`. */
  label: string;
  /**
   * Ausweichziel, wenn es keine Historie gibt — etwa weil die Seite per
   * `Redirect` betreten wurde.
   *
   * Ohne `href` erscheint der Knopf nur, wenn es wirklich etwas zu verlassen
   * gibt. Das ist der richtige Modus fuer Seiten, die auch als Sackgasse
   * erreicht werden koennen: `/household/create` kommt per Redirect, wenn der
   * Nutzer noch in keinem Haushalt ist — ein Ausweg nach `/settings` wuerde
   * ihn dort nur wieder hierher zurueckwerfen.
   */
  href?: Href;
};

/**
 * Zurueck gehen, ohne je eine ungedeckte Aktion abzusetzen.
 *
 * Erst pruefen statt dem Zustand von vorhin zu vertrauen: Zwischen Rendern und
 * Antippen kann sich die Navigation geaendert haben, und ein ungedecktes
 * `GO_BACK` quittiert React Navigation mit einer Fehlermeldung. Gibt es keine
 * Historie, uebernimmt das Ausweichziel — so ist der Knopf nie ohne Wirkung.
 */
function goBackTo(href: Href | undefined) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (href) router.replace(href);
}

function BackButton({ label, href }: BackTarget) {
  return (
    <Pressable
      onPress={() => goBackTo(href)}
      accessibilityRole="button"
      accessibilityLabel={`Zurück zu ${label}`}
      style={styles.backButton}>
      <ThemedText type="smallBold" themeColor="accent">
        {`‹ ${label}`}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Zeigt den Knopf nur, wenn der zustaendige Navigator wirklich zurueck kann.
 *
 * Nur fuer Ziele ohne `href` noetig. Eigene Komponente, damit
 * `useNavigation()` ausschliesslich in diesem Fall laeuft — wuerde `Screen`
 * den Hook immer aufrufen, haenge jeder Screen an einem Navigations-Context,
 * auch die ohne Zurueck-Knopf.
 *
 * Mit Listener statt einmaligem Lesen: `canGoBack()` ist eine Momentaufnahme,
 * und React rendert nicht neu, wenn sich der Navigationszustand aendert.
 */
function AutoBackButton({ label }: { label: string }) {
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

/**
 * Gemeinsames Geruest aller Tab-Screens: Safe Area, Titelzeile, begrenzte
 * Breite und genug Abstand nach unten, damit die Tab-Leiste nichts verdeckt.
 *
 * `BottomTabInset` beruecksichtigt, dass die native Tab-Leiste auf iOS und
 * Android unterschiedlich hoch ist — ohne den Abstand liegt der letzte
 * Listeneintrag unter der Leiste und ist nicht antippbar.
 */
export function Screen({ title, subtitle, children, action, scroll = true, back }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = <View style={styles.body}>{children}</View>;

  // Die native Tab-Leiste liegt ueber dem Inhalt und wird nicht von der Safe Area
  // erfasst. Ohne diesen Abstand verschwindet der letzte Listeneintrag darunter
  // und ist weder lesbar noch antippbar — im Simulator gemessen: die Leiste
  // beginnt bei 90,5 % der Bildschirmhoehe, der Text lag bei 93,8 %.
  const bottomPadding = insets.bottom + TabBarHeight + Spacing.four;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {back ? (
          back.href ? (
            <BackButton label={back.label} href={back.href} />
          ) : (
            <AutoBackButton label={back.label} />
          )
        ) : null}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText type="subtitle">{title}</ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {action}
        </View>

        {scroll ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: bottomPadding }}
            showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.body, { flex: 1, paddingBottom: bottomPadding }]}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    paddingRight: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  body: {
    gap: Spacing.three,
  },
});
