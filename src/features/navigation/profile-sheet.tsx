import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamIcon, type FamIconName } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { withAlpha } from '@/constants/theme';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { HouseholdSwitcherModal } from '@/features/household/household-switcher-modal';
import { usePremium } from '@/features/premium/premium-provider';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { useTheme } from '@/hooks/use-theme';
import { getInitials } from '@/lib/initials';
import { useNavigationChrome } from './navigation-chrome-provider';

export function ProfileSheet() {
  const { isProfileOpen } = useNavigationChrome();
  const mounted = useDeferredMount(isProfileOpen);

  if (!mounted) return null;

  return <ProfileSheetContent />;
}

function ProfileSheetContent() {
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
            className="sheet-dim"
            onPress={closeProfile}
            accessibilityRole="button"
            accessibilityLabel="Profil schließen"
          />
          <View
            className="profile-sheet"
            // bottom (Safe-Area-Insets) und boxShadow (dynamische Opazitaet)
            // sind echte Laufzeitwerte.
            style={{
              bottom: Math.max(insets.bottom / 2, 16),
              boxShadow: `0 -8px 28px ${withAlpha(theme.shadowSheet, 0.18)}`,
            }}>
            <Pressable
              onPress={closeProfile}
              accessibilityRole="button"
              accessibilityLabel="Profil schließen"
              hitSlop={12}
              className="profile-sheet-handle-area">
              <View className="profile-sheet-handle" />
            </Pressable>

            <View className="profile-sheet-card">
              <View className="profile-sheet-avatar">
                <ThemedText
                  type="bodySmall"
                  themeColor="onAccent"
                  className="profile-sheet-avatar-text">
                  {getInitials(displayName)}
                </ThemedText>
              </View>
              <View className="profile-sheet-identity">
                <ThemedText type="smallBold" className="profile-sheet-name">
                  {displayName}
                </ThemedText>
                {email ? (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    className="profile-sheet-email">
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
            />
            <ProfileRow
              icon="members"
              title="Haushalt verwalten"
              subtitle="Mitglieder, Kinder und Einladungen"
              onPress={() => go('/household/members')}
            />
            <ProfileRow
              icon="premium"
              title="Premium"
              subtitle={isPremium ? 'Aktiv für den Haushalt' : 'Jetzt freischalten'}
              onPress={() => go('/settings')}
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
  isLast,
}: {
  icon: FamIconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`profile-sheet-row ${!isLast ? 'profile-sheet-row-bordered' : ''}`}>
      <View className="profile-sheet-row-icon">
        <FamIcon name={icon} size={24} />
      </View>
      <View className="profile-sheet-row-copy">
        <ThemedText type="smallBold" className="profile-sheet-row-title">
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" className="profile-sheet-row-subtitle">
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}
