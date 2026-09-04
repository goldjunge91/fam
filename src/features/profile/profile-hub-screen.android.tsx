import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useProfile } from '@/features/profile/api';
import { SettingsGroup } from '@/features/settings/settings-menu';
import { getInitials } from '@/lib/initials';

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
        <View
          style={{ backgroundColor: colors.backgroundElement, borderColor: colors.border }}
          className="p-five rounded-3xl border items-center gap-three">
          <View
            style={{ backgroundColor: colors.accent }}
            className="w-24 h-24 rounded-full overflow-hidden items-center justify-center border-2 border-border shadow-sm">
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

          <View className="items-center">
            <Txt variant="subheading" weight="700">
              {displayName}
            </Txt>
            <Txt variant="body" tone="secondary" className="mt-half">
              {email}
            </Txt>
          </View>
        </View>

        {/* Zentrale Navigationsbereiche (Account, Tracking, Haushalt) */}
        <SettingsGroup title="Bereiche">
          <View className="p-three gap-three">
            {/* 1. Profil & Account-Daten (Profilbild, Name, E-Mail, Passwort) */}
            <Pressable
              onPress={() => router.push('/profile/edit')}
              accessibilityRole="button"
              accessibilityLabel="Profil und Account bearbeiten"
              style={{ backgroundColor: colors.backgroundElement, borderColor: colors.border }}
              className="p-four rounded-2xl border flex-row items-center justify-between">
              <View className="flex-row items-center gap-three flex-1 mr-two">
                <View
                  style={{ backgroundColor: colors.background, borderColor: colors.border }}
                  className="w-12 h-12 rounded-xl border border-border items-center justify-center">
                  <Txt variant="title">👤</Txt>
                </View>
                <View className="flex-1">
                  <Txt variant="bodyRelaxed" weight="700">
                    Profil & Account-Daten
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    Profilbild, Name, E-Mail und Passwort
                  </Txt>
                </View>
              </View>
              <Txt variant="controlAction" tone="secondary">
                ›
              </Txt>
            </Pressable>

            {/* 2. Mein Tracking (Methode, Tagesbedarf, Vitalwerte & Rhythmus) */}
            <Pressable
              onPress={() => router.push('/profile/tracking')}
              accessibilityRole="button"
              accessibilityLabel="Mein Tracking öffnen"
              style={{ backgroundColor: colors.backgroundElement, borderColor: colors.border }}
              className="p-four rounded-2xl border flex-row items-center justify-between">
              <View className="flex-row items-center gap-three flex-1 mr-two">
                <View
                  style={{ backgroundColor: colors.background, borderColor: colors.border }}
                  className="w-12 h-12 rounded-xl border border-border items-center justify-center">
                  <Txt variant="title">🎯</Txt>
                </View>
                <View className="flex-1">
                  <Txt variant="bodyRelaxed" weight="700">
                    Mein Tracking
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    Methode, Tagesbedarf, Vitalwerte & Rhythmus
                  </Txt>
                </View>
              </View>
              <Txt variant="controlAction" tone="secondary">
                ›
              </Txt>
            </Pressable>

            {/* 3. Familie & Haushalt */}
            <Pressable
              onPress={() => router.push('/household/members')}
              accessibilityRole="button"
              accessibilityLabel="Haushalt verwalten"
              style={{ backgroundColor: colors.backgroundElement, borderColor: colors.border }}
              className="p-four rounded-2xl border flex-row items-center justify-between">
              <View className="flex-row items-center gap-three flex-1 mr-two">
                <View
                  style={{ backgroundColor: colors.background, borderColor: colors.border }}
                  className="w-12 h-12 rounded-xl border border-border items-center justify-center">
                  <Txt variant="title">🏠</Txt>
                </View>
                <View className="flex-1">
                  <Txt variant="bodyRelaxed" weight="700">
                    Familie
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    Haushalt verwalten & Mitglieder
                  </Txt>
                </View>
              </View>
              <Txt variant="controlAction" tone="secondary">
                ›
              </Txt>
            </Pressable>
          </View>
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
