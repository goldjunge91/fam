import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/layout/gradient-background';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import {
  AutoBackButton,
  BackButton,
  type BackTarget,
  MenuButton,
  ProfileButton,
} from '@/components/ui/buttons';
import { useSyncBannerVisible } from '@/components/ui/sync-status-banner';
import type { GradientSpec } from '@/constants/theme';

export type { BackTarget } from '@/components/ui/buttons';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  /** Mit `chrome` werden `back` und `action` ignoriert. */
  chrome?: {
    onMenuPress: () => void;
    onAvatarPress: () => void;
    initials: string;
    trailing?: ReactNode;
  };
  backgroundGradient?: GradientSpec;
  scroll?: boolean;
  applyBottomPadding?: boolean;
  // Explizite Ziele vermeiden falsche Ruecknavigation aus Tab-Historien.
  back?: BackTarget;
  backStyle?: 'text' | 'icon';
};

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
  // Das sichtbare Sync-Banner konsumiert die obere Safe Area bereits.
  const bannerVisible = useSyncBannerVisible();
  const edges = bannerVisible ? (['left', 'right'] as const) : (['top', 'left', 'right'] as const);

  return (
    <ThemedView className="flex-1">
      {backgroundGradient ? <GradientBackground {...backgroundGradient} /> : null}
      <SafeAreaView className={`screen-body ${chrome ? 'px-[21px]' : 'px-three'}`} edges={edges}>
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
                  className="text-center"
                  style={{ fontSize: 12, lineHeight: 16, fontWeight: '400' }}>
                  {subtitle}
                </ThemedText>
              ) : null}
              <ThemedText
                type="subtitle"
                className="text-center"
                style={{ fontSize: 23, lineHeight: 28, fontWeight: '500', letterSpacing: -0.5 }}>
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
