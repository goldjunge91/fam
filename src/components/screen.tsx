import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/gradient-background';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  AutoBackButton,
  BackButton,
  type BackTarget,
  MenuButton,
  ProfileButton,
} from '@/components/ui/buttons';
import type { GradientSpec } from '@/constants/theme';

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
    /** Optionale Hub-Aktion links neben dem Profil, z. B. ein Kalender. */
    trailing?: ReactNode;
  };
  /**
   * Verlauf statt der flachen Theme-Hintergrundfarbe fuer Hub-Screens.
   */
  backgroundGradient?: GradientSpec;
  scroll?: boolean;
  /** Deaktivieren, wenn ein eigener ScrollView den unteren Inhaltsabstand übernimmt. */
  applyBottomPadding?: boolean;
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
  /**
   * `'icon'` zeigt den runden Pfeil-Button im `MenuButton`-Look statt des
   * textbasierten "‹ Ziel"-Links — fuer alle von den Einstellungen aus
   * erreichbaren Screens (#??? , "richtiger Zurück-Button"). Andere Screens
   * bleiben unveraendert beim textbasierten Default.
   */
  backStyle?: 'text' | 'icon';
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
  applyBottomPadding = true,
  back,
  backStyle = 'text',
  chrome,
  backgroundGradient,
}: ScreenProps) {
  const body = <View className="gap-three">{children}</View>;

  return (
    <ThemedView className="flex-1">
      {backgroundGradient ? <GradientBackground {...backgroundGradient} /> : null}
      <SafeAreaView
        className={`screen-body ${chrome ? 'px-[21px]' : 'px-three'}`}
        edges={['top', 'left', 'right']}>
        {chrome ? null : back ? (
          back.href ? (
            <BackButton
              label={back.label}
              href={back.href}
              variant={backStyle === 'icon' ? 'arrow' : 'text'}
            />
          ) : (
            <AutoBackButton label={back.label} variant={backStyle === 'icon' ? 'arrow' : 'text'} />
          )
        ) : null}

        {chrome ? (
          <View className="flex-row items-center justify-between gap-two h-[94px] pt-[13px] pb-[23px]">
            <MenuButton onPress={chrome.onMenuPress} />

            <View className="flex-1 items-center gap-[2px]">
              {subtitle ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="text-center text-detail leading-[16px] font-normal">
                  {subtitle}
                </ThemedText>
              ) : null}
              <ThemedText
                type="subtitle"
                className="text-center text-[23px] leading-[28px] font-medium tracking-[-0.5px]">
                {title}
              </ThemedText>
            </View>

            <View className="flex-row items-center gap-one">
              {chrome.trailing}
              <ProfileButton initials={chrome.initials} onPress={chrome.onAvatarPress} />
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-between gap-three pt-three pb-four">
            <View className="shrink gap-half">
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
            contentContainerClassName={
              applyBottomPadding ? (chrome ? 'pb-action-area' : 'pb-six') : undefined
            }
            showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View
            className={`gap-three flex-1 ${
              applyBottomPadding ? (chrome ? 'pb-action-area' : 'pb-six') : ''
            }`.trim()}>
            {children}
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
