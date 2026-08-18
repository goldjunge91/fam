import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button, MenuButton, ProfileButton } from '@/components/ui/buttons';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { classifySupabaseTarget } from '@/features/settings/dev/dev-info';
import { PremiumPromoCard } from '@/features/settings/premium-promo-card';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { env } from '@/lib/env';

/**
 * Einstellungen als Verzeichnis, nicht als Sammelseite (siehe `settings-menu.tsx`).
 *
 * Kopfzeile, Verlaufshintergrund und Profil-/Premium-Karten folgen jetzt dem
 * fam-Redesign (Figma "00.05 · Einstellungen") — dasselbe Grundgeruest wie
 * `diary-screen.tsx`. Premium selbst ist ein eigener Screen
 * (`/settings/premium`), diese Uebersicht navigiert nur noch dorthin, statt
 * die Paywall direkt zu praesentieren.
 */
export function SettingsScreen() {
  const { session } = useSession();
  const { openDrawer } = useNavigationChrome();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const { data: profile } = useProfile(session?.user.id);
  const initials = useProfileInitials();
  const { activeHousehold } = useActiveHousehold();

  async function handleSignOut() {
    if (signingOut) return;
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

  // Schon in der Uebersicht sichtbar, nicht erst eine Ebene tiefer: Ob dieser
  // Build gegen die echten Daten laeuft, ist die Information, die man beim
  // Ausprobieren nicht suchen wollen sollte.
  const supabaseTarget = env.devTools
    ? classifySupabaseTarget(env.supabaseUrl)
    : { label: '', tone: 'accent' as const };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <HubScreen
      header={{
        title: 'Einstellungen',
        align: 'center',
        leading: <MenuButton onPress={openDrawer} />,
        trailing: (
          <ProfileButton initials={initials} onPress={() => router.push('/settings/profile')} />
        ),
      }}>
      <ScrollView contentContainerClassName="screen-scroll" showsVerticalScrollIndicator={false}>
        <View className="gap-[10px]">
          <Pressable
            onPress={() => router.push('/settings/profile')}
            accessibilityRole="button"
            className="profile-row">
            <View className="profile-avatar">
              {/* smallBold (14px/700) statt der fruehren 13px/600-Sonderrolle
                    — naechstliegende bestehende Rolle, onAccent statt fest
                    verdrahtetem Weiss (exakter Zweck des Tokens). */}
              <ThemedText type="smallBold" themeColor="onAccent">
                {initials}
              </ThemedText>
            </View>
            <View className="row-text">
              <ThemedText type="smallBold" numberOfLines={1}>
                {displayName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {session?.user.email ?? '—'}
              </ThemedText>
            </View>
            {/* bodyLarge (18px) statt der fruehren 19px-Sonderroute —
                  naechstliegende bestehende Rolle fuer ein Chevron-Glyph. */}
            <ThemedText type="bodyLarge" themeColor="textSecondary">
              ›
            </ThemedText>
          </Pressable>

          <PremiumPromoCard />
        </View>

        <View className="gap-four">
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
              last
            />
          </SettingsGroup>

          <SettingsGroup title="App">
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
              last
            />
          </SettingsGroup>

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

          {/* Nur mit EXPO_PUBLIC_DEV_TOOLS=true. Die Gruppe verschwindet dann
                vollstaendig statt nur deaktiviert zu sein — ein ausgegrauter
                Eintrag "Entwickler" waere fuer Nutzer eine Frage ohne Antwort. */}
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

        <View className="mt-two">
          <Button label="Abmelden" variant="danger" onPress={handleSignOut} loading={signingOut} />
        </View>

        <ThemedText type="small" className="text-center opacity-60">
          {`fam v${appVersion}`}
        </ThemedText>
      </ScrollView>
    </HubScreen>
  );
}
