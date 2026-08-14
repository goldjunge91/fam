import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/gradient-background';
import { FontSize, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AutoBackButton,
  BackButton,
  type BackTarget,
  MenuButton,
  ProfileButton,
} from '@/components/ui/buttons';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export type { BackTarget } from '@/components/ui/buttons';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Aktion rechts neben dem Titel, z. B. ein Hinzufuegen-Button. */
  action?: ReactNode;
  /**
   * Hamburger + Avatar statt Zurueck-Knopf — fuer die Hub-Screens, die frueher
   * per Bottom-Tab erreichbar waren (#150, Figma "00 · Screens — Übersicht &
   * Navigation"). Mit `chrome` gesetzt wird `back`/`action` ignoriert: beide
   * Header-Varianten schliessen sich aus.
   */
  chrome?: {
    onMenuPress: () => void;
    onAvatarPress: () => void;
    initials: string;
  };
  /**
   * Verlauf statt der flachen Theme-Hintergrundfarbe — bislang nur die
   * Übersicht nutzt das (#150, Figma "00.01 · Übersicht — Normal").
   */
  backgroundGradient?: string[];
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

/**
 * Gemeinsames Geruest aller Screens: Safe Area, Titelzeile, begrenzte Breite.
 *
 * Seit #150 gibt es keine native Bottom-Tab-Leiste mehr (Hamburger-Drawer +
 * globaler Plus-Button statt `NativeTabs`) — der zusaetzliche Bodenabstand
 * ist nur noch fuer Hub-Screens (`chrome` gesetzt) noetig, damit der
 * schwebende Plus-Button den letzten Listeneintrag nicht verdeckt.
 */
export function Screen({
  title,
  subtitle,
  children,
  action,
  scroll = true,
  back,
  chrome,
  backgroundGradient,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = <View style={styles.body}>{children}</View>;

  // Nur Hub-Screens (chrome gesetzt) haben den schwebenden Plus-Button unten
  // im Weg — alle anderen Screens brauchen nur noch die normale Safe Area.
  const bottomPadding = insets.bottom + Spacing.four + (chrome ? Spacing.six : 0);

  return (
    <ThemedView style={styles.root}>
      {backgroundGradient ? <GradientBackground colors={backgroundGradient} /> : null}
      <SafeAreaView
        style={[styles.safeArea, chrome && styles.chromeSafeArea]}
        edges={['top', 'left', 'right']}>
        {chrome ? null : back ? (
          back.href ? (
            <BackButton label={back.label} href={back.href} />
          ) : (
            <AutoBackButton label={back.label} />
          )
        ) : null}

        {chrome ? (
          <View style={styles.chromeHeader}>
            <MenuButton onPress={chrome.onMenuPress} />

            <View style={styles.chromeTitleWrap}>
              {subtitle ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.chromeSubtitle}>
                  {subtitle}
                </ThemedText>
              ) : null}
              <ThemedText type="subtitle" style={styles.chromeTitle}>
                {title}
              </ThemedText>
            </View>

            <ProfileButton initials={chrome.initials} onPress={chrome.onAvatarPress} />
          </View>
        ) : (
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
        )}

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
  chromeSafeArea: {
    paddingHorizontal: 21,
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
  chromeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    height: 94,
    paddingTop: 13,
    paddingBottom: 23,
  },
  chromeTitleWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  chromeTitle: {
    textAlign: 'center',
    ...FontSize[23],
    lineHeight: 28,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  chromeSubtitle: {
    textAlign: 'center',
    ...FontSize[12],
    lineHeight: 16,
    fontWeight: '400',
  },
  body: {
    gap: Spacing.three,
  },
});
