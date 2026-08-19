import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { SettingsGroup } from '@/features/settings/settings-menu';
import { useTheme } from '@/hooks/use-theme';
import { getInitials } from '@/lib/initials';

export function ProfileHubScreen() {
  const theme = useTheme();
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
        {/* Grosser Profil-Header */}
        <View
          style={{ backgroundColor: theme.backgroundElement, borderColor: theme.border }}
          className="p-five rounded-3xl border items-center gap-three">
          <View
            style={{ backgroundColor: theme.accent }}
            className="w-24 h-24 rounded-full overflow-hidden items-center justify-center border-2 border-border shadow-sm">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="w-full h-full" contentFit="cover" />
            ) : (
              <ThemedText type="title" themeColor="onAccent" className="text-3xl font-bold">
                {initials}
              </ThemedText>
            )}
          </View>

          <View className="items-center">
            <ThemedText type="title" className="text-xl font-bold">
              {displayName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" className="mt-half">
              {email}
            </ThemedText>
          </View>
        </View>

        {/* Zentrale Navigationsbereiche */}
        <SettingsGroup title="Bereiche">
          <View className="p-three gap-three">
            {/* 1. Profil & Account-Daten */}
            <Pressable
              onPress={() => router.push('/profile/edit')}
              accessibilityRole="button"
              accessibilityLabel="Profil und Account bearbeiten"
              style={{ backgroundColor: theme.backgroundElement, borderColor: theme.border }}
              className="p-four rounded-2xl border flex-row items-center justify-between">
              <View className="flex-row items-center gap-three flex-1 mr-two">
                <View
                  style={{ backgroundColor: theme.background }}
                  className="w-12 h-12 rounded-xl border border-border items-center justify-center">
                  <ThemedText type="title">👤</ThemedText>
                </View>
                <View className="flex-1">
                  <ThemedText type="smallBold" className="text-base">
                    Profil & Account-Daten
                  </ThemedText>
                  <ThemedText type="captionCompact" themeColor="textSecondary">
                    Profilbild, Name, E-Mail und Passwort
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="bodyLarge" themeColor="textSecondary">
                ›
              </ThemedText>
            </Pressable>

            {/* 2. Mein Tracking */}
            <Pressable
              onPress={() => router.push('/profile/tracking')}
              accessibilityRole="button"
              accessibilityLabel="Mein Tracking öffnen"
              style={{ backgroundColor: theme.backgroundElement, borderColor: theme.border }}
              className="p-four rounded-2xl border flex-row items-center justify-between">
              <View className="flex-row items-center gap-three flex-1 mr-two">
                <View
                  style={{ backgroundColor: theme.background }}
                  className="w-12 h-12 rounded-xl border border-border items-center justify-center">
                  <ThemedText type="title">🎯</ThemedText>
                </View>
                <View className="flex-1">
                  <ThemedText type="smallBold" className="text-base">
                    Mein Tracking
                  </ThemedText>
                  <ThemedText type="captionCompact" themeColor="textSecondary">
                    Methode, Tagesbedarf, Vitalwerte & Rhythmus
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="bodyLarge" themeColor="textSecondary">
                ›
              </ThemedText>
            </Pressable>

            {/* 3. Familie & Haushalt */}
            <Pressable
              onPress={() => router.push('/household/members')}
              accessibilityRole="button"
              accessibilityLabel="Haushalt verwalten"
              style={{ backgroundColor: theme.backgroundElement, borderColor: theme.border }}
              className="p-four rounded-2xl border flex-row items-center justify-between">
              <View className="flex-row items-center gap-three flex-1 mr-two">
                <View
                  style={{ backgroundColor: theme.background }}
                  className="w-12 h-12 rounded-xl border border-border items-center justify-center">
                  <ThemedText type="title">🏠</ThemedText>
                </View>
                <View className="flex-1">
                  <ThemedText type="smallBold" className="text-base">
                    Familie
                  </ThemedText>
                  <ThemedText type="captionCompact" themeColor="textSecondary">
                    Haushalt verwalten & Mitglieder
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="bodyLarge" themeColor="textSecondary">
                ›
              </ThemedText>
            </Pressable>
          </View>
        </SettingsGroup>
      </ScrollView>
    </Screen>
  );
}
