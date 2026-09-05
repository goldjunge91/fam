import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { radius, shadow, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card, Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';
import { SettingsGroup } from '@/features/settings/settings-menu';
import { getInitials } from '@/lib/initials';

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    gap: space.lg,
    padding: space.xxl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  profileCopy: {
    alignItems: 'center',
  },
  email: {
    marginTop: space.xs,
  },
  settingsList: {
    padding: space.lg,
    gap: space.lg,
  },
  pressContainer: {
    alignSelf: 'stretch',
  },
  pressSurface: {
    alignSelf: 'stretch',
  },
  actionCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
    borderRadius: radius.md,
  },
  actionLead: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: space.lg,
    marginRight: space.sm,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
  },
} as const);

export function ProfileHubScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);

  const displayName = profile?.display_name || 'Ohne Namen';
  const email = session?.user.email ?? '—';
  const initials = getInitials(displayName);
  const avatarUrl = profile?.avatar_url;

  return (
    <Screen
      title="Mein Profil"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <ScrollView contentContainerClassName="screen-scroll" showsVerticalScrollIndicator={false}>
        {/* Großer Profil-Header (Avatar, Display-Name, E-Mail) */}
        <Card padded={false} elevation="none" style={styles.profileHeader}>
          <View
            style={[
              styles.avatar,
              shadow.sm,
              { backgroundColor: colors.accent, borderColor: colors.border, shadowColor: colors.shadowCard },
            ]}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                accessibilityLabel="Profilbild im Profil"
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <Txt variant="title" tone="inverse" weight="700">
                {initials}
              </Txt>
            )}
          </View>

          <View style={styles.profileCopy}>
            <Txt variant="subheading" weight="700">
              {displayName}
            </Txt>
            <Txt variant="body" tone="secondary" style={styles.email}>
              {email}
            </Txt>
          </View>
        </Card>

        {/* Zentrale Navigationsbereiche (Account, Tracking, Haushalt) */}
        <SettingsGroup title="Bereiche">
          <View style={styles.settingsList}>
            {/* 1. Profil & Account-Daten (Profilbild, Name, E-Mail, Passwort) */}
            <Press
              onPress={() => router.push('/profile/edit')}
              accessibilityRole="button"
              accessibilityLabel="Profil und Account bearbeiten"
              containerStyle={styles.pressContainer}
              style={styles.pressSurface}>
              <Card padded={false} elevation="none" style={styles.actionCard}>
                <View style={styles.actionLead}>
                  <View
                    style={[styles.iconTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Txt variant="title">👤</Txt>
                  </View>
                  <View style={styles.actionCopy}>
                    <Txt variant="body" weight="700">
                      Profil & Account-Daten
                    </Txt>
                    <Txt variant="caption" tone="secondary">
                      Profilbild, Name, E-Mail und Passwort
                    </Txt>
                  </View>
                </View>
                <Txt variant="subheading" tone="secondary">
                  ›
                </Txt>
              </Card>
            </Press>

            {/* 2. Mein Tracking (Methode, Tagesbedarf, Vitalwerte & Rhythmus) */}
            <Press
              onPress={() => router.push('/profile/tracking')}
              accessibilityRole="button"
              accessibilityLabel="Mein Tracking öffnen"
              containerStyle={styles.pressContainer}
              style={styles.pressSurface}>
              <Card padded={false} elevation="none" style={styles.actionCard}>
                <View style={styles.actionLead}>
                  <View
                    style={[styles.iconTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Txt variant="title">🎯</Txt>
                  </View>
                  <View style={styles.actionCopy}>
                    <Txt variant="body" weight="700">
                      Mein Tracking
                    </Txt>
                    <Txt variant="caption" tone="secondary">
                      Methode, Tagesbedarf, Vitalwerte & Rhythmus
                    </Txt>
                  </View>
                </View>
                <Txt variant="subheading" tone="secondary">
                  ›
                </Txt>
              </Card>
            </Press>

            {/* 3. Familie & Haushalt */}
            <Press
              onPress={() => router.push('/household/members')}
              accessibilityRole="button"
              accessibilityLabel="Haushalt verwalten"
              containerStyle={styles.pressContainer}
              style={styles.pressSurface}>
              <Card padded={false} elevation="none" style={styles.actionCard}>
                <View style={styles.actionLead}>
                  <View
                    style={[styles.iconTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Txt variant="title">🏠</Txt>
                  </View>
                  <View style={styles.actionCopy}>
                    <Txt variant="body" weight="700">
                      Familie
                    </Txt>
                    <Txt variant="caption" tone="secondary">
                      Haushalt verwalten & Mitglieder
                    </Txt>
                  </View>
                </View>
                <Txt variant="subheading" tone="secondary">
                  ›
                </Txt>
              </Card>
            </Press>
          </View>
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
