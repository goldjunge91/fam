import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MenuButton, ProfileButton } from '@/components/ui/buttons';
import { Button, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  DEFAULT_FAB_POSITION,
  useFabPosition,
  useSetFabPosition,
} from '@/features/navigation/fab-position-settings';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useProfile } from '@/features/profile/api';
import { classifySupabaseTarget } from '@/features/settings/dev/dev-info';
import { PlusAndAiPromoCard } from '@/features/settings/plus-and-ai-promo-card';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { debugLogEvent } from '@/lib/debug-log';
import { env } from '@/lib/env';

export function SettingsScreen() {
  const { session } = useSession();
  const { colors } = useTheme();
  const { openDrawer } = useNavigationChrome();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const { data: profile } = useProfile(session?.user.id);
  const initials = useProfileInitials();
  const { activeHousehold } = useActiveHousehold();

  const { data: fabPosition = DEFAULT_FAB_POSITION } = useFabPosition();
  const setFabPosition = useSetFabPosition();

  async function handleSignOut() {
    if (signingOut) return;
    debugLogEvent('auth.sign-out.button-clicked');
    setSigningOut(true);

    const { error } = await signOutAndClearLocalData(queryClient);

    setSigningOut(false);

    if (error) {
      Alert.alert('Abmelden fehlgeschlagen', error.message);
    } else {
      router.replace('/onboarding');
    }
  }

  const hasHousehold = Boolean(activeHousehold);
  const displayName = profile?.display_name || 'Ohne Namen';
  const avatarUrl = profile?.avatar_url;

  // Entwicklungsziel direkt in der Übersicht anzeigen.
  const supabaseTarget = env.devTools
    ? classifySupabaseTarget(env.supabaseUrl)
    : { label: '', tone: 'accent' as const };

  const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber =
    Constants.nativeBuildVersion ??
    (Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode
        ? String(Constants.expoConfig.android.versionCode)
        : undefined);
  const versionLabel = buildNumber ? `fam v${version} (${buildNumber})` : `fam v${version}`;

  return (
    <HubScreen
      header={{
        title: 'Einstellungen',
        align: 'center',
        leading: <MenuButton onPress={openDrawer} />,
        trailing: (
          <ProfileButton
            initials={initials}
            avatarUrl={avatarUrl}
            onPress={() => router.push('/profile')}
          />
        ),
      }}>
      <ScrollView contentContainerClassName="screen-scroll" showsVerticalScrollIndicator={false}>
        {/* Schnellzugriff-Header (Eigenes Profil & Premium-Aktionskarte) */}
        <View className="gap-[10px]">
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            className="profile-row">
            <View
              className="profile-avatar overflow-hidden"
              style={{ backgroundColor: colors.basil }}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  accessibilityLabel="Profilbild in Einstellungen"
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <Txt variant="body" tone="inverse" weight="700">
                  {initials}
                </Txt>
              )}
            </View>
            <View className="row-text">
              <Txt variant="body" weight="700" numberOfLines={1}>
                {displayName}
              </Txt>
              <Txt variant="body" tone="secondary" numberOfLines={1}>
                {session?.user.email ?? '—'}
              </Txt>
            </View>
            <Txt variant="title" tone="secondary">
              ›
            </Txt>
          </Pressable>

          <PlusAndAiPromoCard />
        </View>

        {/* Einstellungs-Menügruppen */}
        <View className="gap-four">
          {/* Tracking & Ernährung (Ziele, Vitalwerte, Methoden) */}
          <SettingsGroup title="Tracking & Ernährung">
            <SettingsRow
              icon="🎯"
              label="Mein Tracking"
              hint="Methode, Ziele, Vitalwerte & Rhythmus"
              onPress={() => router.push('/profile/tracking')}
              last
            />
          </SettingsGroup>

          {/* Haushalt (Mitglieder, Lagerorte, Märkte) */}
          <SettingsGroup title="Haushalt">
            <SettingsRow
              icon="🏠"
              label="Mitglieder"
              value={activeHousehold?.name ?? 'Kein Haushalt'}
              hint={hasHousehold ? undefined : 'Haushalt wechseln oder beitreten'}
              onPress={() => router.push('/household/members')}
            />
            <SettingsRow
              icon="📦"
              label="Lagerorte"
              hint="Kühlschrank, Tiefkühler, Vorratskammer"
              onPress={hasHousehold ? () => router.push('/household/storage-locations') : undefined}
              disabled={!hasHousehold}
            />
            <SettingsRow
              icon="🏬"
              label="Märkte"
              hint="REWE, Aldi, Lidl, ..."
              onPress={hasHousehold ? () => router.push('/household/stores') : undefined}
              disabled={!hasHousehold}
            />
            <SettingsRow
              icon="🔎"
              label="Produktsuche"
              hint="Bevorzugten Markt für Treffer wählen"
              onPress={hasHousehold ? () => router.push('/settings/product-search') : undefined}
              disabled={!hasHousehold}
              last
            />
          </SettingsGroup>

          <SettingsGroup title="App">
            <SettingsRow
              icon="🔐"
              label="Berechtigungen"
              onPress={() => router.push('/settings/permissions')}
            />
            <SettingsRow
              icon="🔔"
              label="Benachrichtigungen"
              onPress={() => router.push('/settings/notifications')}
            />
            <SettingsRow
              icon="🧩"
              label="Module"
              hint="Vorrat, Einkauf, Tagebuch, Rezepte"
              onPress={() => router.push('/settings/modules')}
            />
            <SettingsRow
              icon="➕"
              label="Plus-Button"
              value={fabPosition === 'left' ? 'Links' : 'Rechts'}
              hint="Ecke, in der das + sitzt"
              onPress={() => setFabPosition(fabPosition === 'left' ? 'right' : 'left')}
            />
            <SettingsRow
              icon="💬"
              label="Feedback geben"
              onPress={() => router.push('/settings/feedback')}
              last
            />
          </SettingsGroup>

          {/* Datenverwaltung & Datenschutz (Export, DSGVO, Löschen) */}
          <SettingsGroup title="Daten">
            <SettingsRow icon="📤" label="Export" onPress={() => router.push('/settings/export')} />
            <SettingsRow
              icon="🔒"
              label="Datenschutz"
              onPress={() => router.push('/settings/privacy')}
            />
            <SettingsRow
              icon="🗑️"
              label="Konto löschen"
              onPress={() => router.push('/settings/delete-account')}
              last
            />
          </SettingsGroup>

          {}
          {env.devTools ? (
            <SettingsGroup title="Entwickler">
              <SettingsRow
                icon="🛠"
                label="Entwickler-Werkzeuge"
                hint="Umgebung, Session, lokale Datenbank"
                value={supabaseTarget.label}
                onPress={() => router.push('/settings/dev')}
                last
              />
            </SettingsGroup>
          ) : null}
        </View>

        {/* Abmelden-Aktion */}
        <View className="mt-two">
          <Button title="Abmelden" variant="danger" onPress={handleSignOut} loading={signingOut} />
        </View>

        {/* App-Versionsangabe & Build-Nummer */}
        <Txt variant="body" center style={{ opacity: 0.6 }}>
          {versionLabel}
        </Txt>
      </ScrollView>
    </HubScreen>
  );
}
