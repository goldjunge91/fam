import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { FamIcon, type FamIconName } from '@/components/icons/fam-icon';
import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { usePremium } from '@/features/premium/premium-provider';
import { useProfile } from '@/features/profile/api';
import { AvatarImage } from '@/features/profile/avatar-image';
import { getInitials } from '@/features/profile/domain/initials';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { useNavigationChrome } from './navigation-chrome-provider';

export function ProfileSheet() {
  const { isProfileOpen } = useNavigationChrome();
  const mounted = useDeferredMount(isProfileOpen);

  if (!mounted) return null;

  return <ProfileSheetContent />;
}

function ProfileSheetContent() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isProfileOpen, closeProfile } = useNavigationChrome();
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);
  const { hasPlus, hasAI } = usePremium();

  const displayName = profile?.display_name || t('navigation.profile.fallbackName');
  const email = session?.user.email ?? '';
  const avatarUrl = profile?.avatar_url;

  function go(href: string) {
    closeProfile();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <Modal visible={isProfileOpen} transparent animationType="slide" onRequestClose={closeProfile}>
      <View style={StyleSheet.absoluteFill}>
        <Press
          haptic="none"
          scaleTo={1}
          containerStyle={StyleSheet.absoluteFill}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          onPress={closeProfile}
          accessibilityRole="button"
          accessibilityLabel={t('navigation.profile.close')}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.backgroundElement,
              bottom: Math.max(insets.bottom / 2, 16),
            },
          ]}>
          <Press
            onPress={closeProfile}
            accessibilityRole="button"
            accessibilityLabel={t('navigation.profile.close')}
            hitSlop={12}
            style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </Press>

          <View style={[styles.profileCard, { borderBottomColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              {avatarUrl ? (
                <AvatarImage
                  reference={avatarUrl}
                  accessibilityLabel={t('common.profile.imageInMenu')}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Txt variant="body" tone="onAccent" weight="500">
                  {getInitials(displayName)}
                </Txt>
              )}
            </View>
            <View style={styles.identity}>
              <Txt variant="body" weight="500">
                {displayName}
              </Txt>
              {email ? (
                <Txt variant="label" tone="secondary" weight="400">
                  {email}
                </Txt>
              ) : null}
            </View>
          </View>

          <ProfileRow
            icon="profile"
            title={t('navigation.profile.myProfile')}
            subtitle={t('navigation.profile.myProfileSubtitle')}
            onPress={() => go('/profile/edit')}
            borderColor={colors.border}
          />
          <ProfileRow
            icon="household"
            title={t('navigation.profile.family')}
            subtitle={t('navigation.profile.familySubtitle')}
            onPress={() => go('/household/members')}
            borderColor={colors.border}
          />
          <ProfileRow
            icon="premium"
            title={t('navigation.profile.plusAi')}
            subtitle={
              hasPlus || hasAI
                ? t('navigation.profile.activeForHousehold')
                : t('navigation.profile.unlock')
            }
            onPress={() => go('/settings/plus-and-ai')}
            borderColor="transparent"
            isLast
          />
        </View>
      </View>
    </Modal>
  );
}

function ProfileRow({
  icon,
  title,
  subtitle,
  onPress,
  borderColor,
  isLast,
}: {
  icon: FamIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  borderColor: string;
  isLast?: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.profileRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
      ]}>
      <View style={styles.rowIcon}>
        <FamIcon name={icon} size={24} />
      </View>
      <View style={styles.rowCopy}>
        <Txt variant="body" weight="500">
          {title}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {subtitle}
        </Txt>
      </View>
      <Txt variant="subheading" tone="secondary">
        ›
      </Txt>
    </Press>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderCurve: 'continuous',
  },
  handleArea: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: radius.sm,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 82,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  identity: {
    gap: space.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 61,
    paddingVertical: space.sm,
  },
  rowIcon: {
    width: 24,
    height: 24,
  },
  rowCopy: {
    flex: 1,
    gap: space.xs,
  },
});
