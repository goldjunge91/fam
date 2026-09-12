import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/layout/gradient-background';
import type { GradientSpec } from '@/components/theme/index';
import { CONTENT_MAX_WIDTH, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  AutoBackButton,
  BackButton,
  type BackTarget,
  MenuButton,
  ProfileButton,
} from '@/components/ui/buttons';
import { useSyncBannerVisible } from '@/components/ui/sync-status-banner';
import { IconButton, Row, Surface, Txt } from '@/constants/ui';

export type { BackTarget } from '@/components/ui/buttons';

const SCREEN_BOTTOM_CLEARANCE = 96;

const styles = StyleSheet.create({
  body: {
    gap: space.lg,
  },
  surface: {
    flex: 1,
  },
  chromeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    height: 94,
    paddingTop: 13,
    paddingBottom: 23,
  },
  chromeTitle: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  chromeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexShrink: 0,
    minWidth: 58,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.lg + space.sm,
  },
  titleBlock: {
    flexShrink: 1,
    gap: space.xs / 2,
  },
  fill: {
    flex: 1,
  },
});

/** Kompakter, wiederverwendbarer Header für Screens ohne Hub-Chrome. */
export function ScreenHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <Row justify="space-between" align="flex-start" style={{ marginBottom: space.lg }}>
      <Row gap={10} align="center" style={{ flex: 1 }}>
        {back ? (
          <IconButton
            icon="chevron-left"
            onPress={() => router.back()}
            size={40}
            bg={colors.surface}
            accessibilityLabel="Zurück"
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Txt variant="title">{title}</Txt>
          {subtitle ? (
            <Txt variant="label" style={{ marginTop: 2 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
      </Row>
      {right}
    </Row>
  );
}

export type ScreenProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Aktion rechts neben dem Titel, z. B. ein Hinzufuegen-Button. */
  action?: ReactNode;

  chrome?: {
    onMenuPress: () => void;
    onAvatarPress: () => void;
    initials: string;
    avatarUrl?: string | null;
    /** Optionale Hub-Aktion links neben dem Profil, z. B. ein Kalender. */
    trailing?: ReactNode;
  };
  /**
   * Verlauf statt der flachen Theme-Hintergrundfarbe fuer Hub-Screens.
   */
  backgroundGradient?: GradientSpec;
  scroll?: boolean;
  /** Deaktiviert die horizontale Inhaltsauffuellung fuer vollbreite Inhalte. */
  padded?: boolean;
  /** Pull-to-refresh-Zustand für Screens mit einem eigenen Daten-Reload. */
  refreshing?: boolean;
  /** Wird nur ausgeführt, wenn der Nutzer den ScrollView nach unten zieht. */
  onRefresh?: () => void;
  /** Letzter Style-Override für den Inhaltsbereich. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Deaktivieren, wenn ein eigener ScrollView den unteren Inhaltsabstand übernimmt. */
  applyBottomPadding?: boolean;

  back?: BackTarget;

  backStyle?: 'text' | 'icon';
};

export function Screen({
  title,
  subtitle,
  children,
  action,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  contentStyle,
  applyBottomPadding = true,
  back,
  backStyle = 'text',
  chrome,
  backgroundGradient,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View
      style={[
        styles.body,
        {
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        contentStyle,
      ]}>
      {children}
    </View>
  );
  // Der sichtbare Sync-Banner übernimmt die obere Safe Area selbst.
  const bannerVisible = useSyncBannerVisible();
  const edges = bannerVisible ? (['left', 'right'] as const) : (['top', 'left', 'right'] as const);
  const horizontalPadding = padded ? (chrome ? 21 : space.lg) : 0;
  const bottomPadding = applyBottomPadding ? insets.bottom + SCREEN_BOTTOM_CLEARANCE : 0;

  return (
    <Surface tone="page" style={styles.surface}>
      {backgroundGradient ? <GradientBackground {...backgroundGradient} /> : null}
      <SafeAreaView
        edges={edges}
        style={{
          flex: 1,
          width: '100%',
          backgroundColor: 'transparent',
        }}>
        <View
          style={{
            width: '100%',
            maxWidth: CONTENT_MAX_WIDTH,
            alignSelf: 'center',
            paddingHorizontal: horizontalPadding,
          }}>
          {chrome ? null : back ? (
            back.href ? (
              <BackButton
                label={back.label}
                href={back.href}
                variant={backStyle === 'icon' ? 'arrow' : 'text'}
              />
            ) : (
              <AutoBackButton
                label={back.label}
                variant={backStyle === 'icon' ? 'arrow' : 'text'}
              />
            )
          ) : null}

          {chrome ? (
            <View style={styles.chromeHeader}>
              <MenuButton onPress={chrome.onMenuPress} />

              <View style={styles.chromeTitle}>
                {subtitle ? (
                  <Txt variant="caption" tone="secondary" center>
                    {subtitle}
                  </Txt>
                ) : null}
                <Txt variant="title" center>
                  {title}
                </Txt>
              </View>

              <View style={styles.chromeActions}>
                {chrome.trailing}
                <ProfileButton
                  initials={chrome.initials}
                  avatarUrl={chrome.avatarUrl}
                  onPress={chrome.onAvatarPress}
                />
              </View>
            </View>
          ) : title ? (
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Txt variant="title" weight="600">
                  {title}
                </Txt>
                {subtitle ? (
                  <Txt variant="body" tone="secondary" weight="500">
                    {subtitle}
                  </Txt>
                ) : null}
              </View>
              {action}
            </View>
          ) : null}
        </View>

        {scroll ? (
          <ScrollView
            style={{ flex: 1, backgroundColor: 'transparent' }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: horizontalPadding,
              paddingBottom: bottomPadding,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            alwaysBounceVertical={Boolean(onRefresh)}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={Boolean(refreshing)}
                  onRefresh={onRefresh}
                  tintColor={colors.basil}
                  colors={[colors.basil]}
                  progressViewOffset={insets.top + 4}
                />
              ) : undefined
            }>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.fill, { paddingBottom: bottomPadding }]}>
            <View
              style={[
                styles.body,
                {
                  flex: 1,
                  width: '100%',
                  maxWidth: CONTENT_MAX_WIDTH,
                  alignSelf: 'center',
                  paddingHorizontal: horizontalPadding,
                },
                contentStyle,
              ]}>
              {children}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Surface>
  );
}
