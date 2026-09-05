import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FamIcon, type FamIconName } from '@/components/icons/fam-icon';
import { radius, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { usePremium } from '@/features/premium/premium-provider';
import { useProfile } from '@/features/profile/api';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { getInitials } from '@/lib/initials';
import { useNavigationChrome } from './navigation-chrome-provider';

export function ProfileSheet() {
  const { isProfileOpen } = useNavigationChrome();
  const mounted = useDeferredMount(isProfileOpen);

  if (!mounted) return null;

  return <ProfileSheetContent />;
}

function ProfileSheetContent() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isProfileOpen, closeProfile } = useNavigationChrome();
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);
  const { hasPlus, hasAI } = usePremium();

  const displayName = profile?.display_name || 'Ohne Namen';
  const email = session?.user.email ?? '';
  const avatarUrl = profile?.avatar_url;

  function go(href: string) {
    closeProfile();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <Modal visible={isProfileOpen} transparent animationType="slide" onRequestClose={closeProfile}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={[styles.dim, { backgroundColor: withAlpha(colors.text, 0.3) }]}
          onPress={closeProfile}
          accessibilityRole="button"
          accessibilityLabel="Profil schließen"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.backgroundElement,
              bottom: Math.max(insets.bottom / 2, 16),
              boxShadow: `0 -8px 28px ${withAlpha(colors.text, 0.18)}`,
            },
          ]}>
          <Pressable
            onPress={closeProfile}
            accessibilityRole="button"
            accessibilityLabel="Profil schließen"
            hitSlop={12}
            style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </Pressable>

          <View style={[styles.profileCard, { borderBottomColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  accessibilityLabel="Profilbild im Profilmenü"
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
            title="Mein Profil"
            subtitle="Persönliche Daten und Einstellungen"
            onPress={() => go('/profile')}
            borderColor={colors.border}
          />
          <ProfileRow
            icon="household"
            title="Familie"
            subtitle="Haushalt verwalten"
            onPress={() => go('/household/members')}
            borderColor={colors.border}
          />
          <ProfileRow
            icon="premium"
            title="Plus & KI"
            subtitle={hasPlus || hasAI ? 'Aktiv für den Haushalt' : 'Jetzt freischalten'}
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
    <Pressable
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(31,26,33,0.3)',
  },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
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
    gap: 14,
    height: 82,
    paddingTop: 8,
    paddingBottom: 14,
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
    gap: 6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 61,
    paddingVertical: 8,
  },
  rowIcon: {
    width: 24,
    height: 24,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
});
