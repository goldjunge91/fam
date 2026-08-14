import { router } from 'expo-router';
import { useState } from 'react';
import Constants from 'expo-constants';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Button, MenuButton, ProfileButton } from '@/components/ui/buttons';
import { Spacing } from '@/constants/theme';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { useCurrentGoal } from '@/features/calorie-tracking/api';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { usePremium } from '@/features/premium/premium-provider';
import { classifySupabaseTarget } from '@/features/settings/dev/dev-info';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
  const { session } = useSession();
  const { openDrawer } = useNavigationChrome();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const { data: profile } = useProfile(session?.user.id);
  const initials = useProfileInitials();
  const { activeHousehold } = useActiveHousehold();
  const { data: currentGoal } = useCurrentGoal(session?.user.id);
  const { isPremium, isForced } = usePremium();

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
    <View style={styles.root}>
      <GradientBackground colors={['#FFD2B9', '#F8F4EF', '#EEE7F4']} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Einstellungen"
          align="center"
          leading={<MenuButton onPress={openDrawer} />}
          trailing={<ProfileButton initials={initials} onPress={() => router.push('/settings/profile')} />}
        />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => router.push('/settings/profile')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.profileRow,
              { backgroundColor: `${theme.backgroundElement}B8`, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.profileAvatar, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.profileAvatarText}>{initials}</ThemedText>
            </View>
            <View style={styles.profileTextWrap}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {displayName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {session?.user.email ?? '—'}
              </ThemedText>
            </View>
            <ThemedText themeColor="textSecondary" style={styles.chevron}>
              ›
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/settings/premium')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.premiumCard, pressed && styles.pressed]}>
            <GradientBackground colors={['#715574', '#a36e72', '#c59677']} />
            <ThemedText style={styles.premiumTitle}>
              {isPremium ? 'Premium ist aktiv' : 'Premium für den ganzen Haushalt'}
            </ThemedText>
            <ThemedText style={styles.premiumSubtitle}>
              {isPremium
                ? 'Alle Mitglieder profitieren von den Premium-Funktionen.'
                : 'Kochmodus, intelligente Einkaufslisten und weitere Automationen.'}
            </ThemedText>
            <View style={styles.premiumPill}>
              <ThemedText themeColor="accent" style={styles.premiumPillText}>
                {isPremium ? (isForced ? 'Abo verwalten (erzwungen)' : 'Abo verwalten') : 'Premium ansehen'}
              </ThemedText>
            </View>
          </Pressable>

          <View style={styles.groups}>
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
              />
              <SettingsRow
                icon="🍽️"
                label="Portionen pro Person"
                hint="Umrechnungsfaktor für den Wochenplan"
                onPress={() => router.push('/settings/meal-planner')}
                last
              />
            </SettingsGroup>

            <SettingsGroup title="Ziele & Daten">
              <SettingsRow
                icon="🎯"
                label="Kalorienziel"
                value={currentGoal ? `${currentGoal.daily_kcal ?? '–'} kcal` : 'nicht gesetzt'}
                onPress={() => router.push('/settings/goals')}
              />
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

          <View style={styles.abmelden}>
            <Button label="Abmelden" variant="danger" onPress={handleSignOut} loading={signingOut} />
          </View>

          <ThemedText type="small" style={styles.versionText}>
            {`fam v${appVersion}`}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    ...FontSize[13],
    fontWeight: '600',
  },
  profileTextWrap: {
    flex: 1,
    gap: 2,
  },
  chevron: {
    ...FontSize[19],
    lineHeight: 19,
  },
  premiumCard: {
    overflow: 'hidden',
    borderRadius: 21,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  premiumTitle: {
    color: '#fff',
    ...FontSize[13],
    fontWeight: '600',
  },
  premiumSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    ...FontSize[11],
    lineHeight: 15,
  },
  premiumPill: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  premiumPillText: {
    ...FontSize[11],
    fontWeight: '600',
  },
  groups: {
    gap: Spacing.four,
  },
  abmelden: {
    marginTop: Spacing.two,
  },
  versionText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
});
