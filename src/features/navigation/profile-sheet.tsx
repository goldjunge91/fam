import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamIcon, type FamIconName } from '@/components/fam-icon';
import { FontSize, ThemedText } from '@/components/themed-text';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { HouseholdSwitcherModal } from '@/features/household/household-switcher-modal';
import { usePremium } from '@/features/premium/premium-provider';
import { useTheme } from '@/hooks/use-theme';
import { getInitials } from '@/lib/initials';

import { useNavigationChrome } from './navigation-chrome-provider';

/**
 * Profil-Sheet unter dem Avatar (#150, Figma "00.03 · Profil — Avatar
 * geöffnet"). Buendelt, was vorher ueber den Einstellungen-Tab verstreut war:
 * eigenes Profil, aktiver Haushalt (mit Wechsel), Haushaltsverwaltung, Premium.
 */
export function ProfileSheet() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isProfileOpen, closeProfile } = useNavigationChrome();
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);
  const { activeHousehold, households } = useActiveHousehold();
  const { isPremium } = usePremium();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const displayName = profile?.display_name || 'Ohne Namen';
  const email = session?.user.email ?? '';

  function go(href: string) {
    closeProfile();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <>
      <Modal
        visible={isProfileOpen}
        transparent
        animationType="slide"
        onRequestClose={closeProfile}>
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            style={styles.dim}
            onPress={closeProfile}
            accessibilityRole="button"
            accessibilityLabel="Profil schließen"
          />
          <View
            style={[
              styles.sheet,
              {
                bottom: Math.max(insets.bottom / 2, 16),
              },
            ]}>
            <Pressable
              onPress={closeProfile}
              accessibilityRole="button"
              accessibilityLabel="Profil schließen"
              hitSlop={12}
              style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: theme.border }]} />
            </Pressable>

            <View style={[styles.profileCard, { borderBottomColor: theme.border }]}>
              <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                <ThemedText style={[styles.avatarText, { color: '#fff' }]}>
                  {getInitials(displayName)}
                </ThemedText>
              </View>
              <View style={styles.identity}>
                <ThemedText type="smallBold" style={styles.profileName}>
                  {displayName}
                </ThemedText>
                {email ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.profileEmail}>
                    {email}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            <ProfileRow
              icon="profile"
              title="Mein Profil"
              subtitle="Persönliche Daten und Ziele"
              onPress={() => go('/settings/profile')}
              borderColor={theme.border}
            />
            <ProfileRow
              icon="household"
              title={activeHousehold?.name ?? 'Haushalt'}
              subtitle={households.length > 1 ? 'Aktiver Haushalt · wechseln' : 'Aktiver Haushalt'}
              onPress={() => {
                if (households.length > 1) {
                  setSwitcherVisible(true);
                } else {
                  closeProfile();
                }
              }}
              borderColor={theme.border}
            />
            <ProfileRow
              icon="members"
              title="Haushalt verwalten"
              subtitle="Mitglieder, Kinder und Einladungen"
              onPress={() => go('/household/members')}
              borderColor={theme.border}
            />
            <ProfileRow
              icon="premium"
              title="Premium"
              subtitle={isPremium ? 'Aktiv für den Haushalt' : 'Jetzt freischalten'}
              onPress={() => go('/settings')}
              borderColor="transparent"
              isLast
            />
          </View>
        </View>
      </Modal>

      <HouseholdSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
        onSelectHousehold={() => {
          setSwitcherVisible(false);
          closeProfile();
        }}
      />
    </>
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
        <ThemedText type="smallBold" style={styles.rowTitle}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowSubtitle}>
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
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
    height: 390,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    boxShadow: '0 -8px 28px rgba(41, 28, 46, 0.18)',
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
    borderRadius: 3,
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
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...FontSize[14],
    lineHeight: 20,
    fontWeight: '500',
  },
  identity: {
    gap: 6,
  },
  profileName: {
    ...FontSize[17],
    lineHeight: 22,
    fontWeight: '500',
  },
  profileEmail: {
    ...FontSize[13],
    lineHeight: 18,
    fontWeight: '400',
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
  rowTitle: {
    ...FontSize[14],
    lineHeight: 20,
    fontWeight: '500',
  },
  rowSubtitle: {
    ...FontSize[12],
    lineHeight: 16,
    fontWeight: '400',
  },
});
