import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';
import { space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MenuButton } from '@/components/ui/buttons';
import { Button, Card, SegmentedControl, Txt } from '@/constants/ui';
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
import { type AppLanguage, setAppLanguage } from '@/i18n';
import { debugLogEvent } from '@/lib/debug-log';
import { env } from '@/lib/env';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: space.lg + space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: 64,
  },
  topCards: {
    gap: space.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: space.xl,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: space.xl + space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileText: {
    flex: 1,
    gap: space.xs / 2,
  },
  groups: {
    gap: space.lg + space.sm,
  },
  languageRow: {
    paddingVertical: space.lg,
  },
  signOut: {
    marginTop: space.sm,
  },
  version: {
    textAlign: 'center',
    opacity: 0.6,
  },
});

export function SettingsScreen() {
  const { i18n, t } = useTranslation();
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
  const selectedLanguage: AppLanguage = i18n.language.startsWith('en') ? 'en' : 'de';

  async function handleSignOut() {
    if (signingOut) return;
    debugLogEvent('auth.sign-out.button-clicked');
    setSigningOut(true);

    const { error } = await signOutAndClearLocalData(queryClient);

    setSigningOut(false);

    if (error) {
      Alert.alert(t('settings.signOutFailedTitle'), error.message);
    } else {
      router.replace('/onboarding');
    }
  }

  const hasHousehold = Boolean(activeHousehold);
  const displayName = profile?.display_name || t('settings.noName');
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
        title: t('settings.title'),
        align: 'center',
        leading: <MenuButton onPress={openDrawer} />,
      }}>
      <ScrollView
        testID="settings-scroll-view"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Schnellzugriff-Header (Eigenes Profil & Premium-Aktionskarte) */}
        <View style={styles.topCards}>
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            style={({ pressed }) => pressed && { opacity: 0.85 }}>
            <Card
              testID="settings-profile-card-row"
              padded={false}
              elevation="sm"
              style={[
                styles.profileRow,
                {
                  backgroundColor: withAlpha(colors.backgroundElement, 0.72),
                  borderColor: colors.border,
                },
              ]}>
              <View style={[styles.profileAvatar, { backgroundColor: colors.basil }]}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    accessibilityLabel={t('settings.profileImageAccessibility')}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <Txt variant="body" tone="inverse" weight="700">
                    {initials}
                  </Txt>
                )}
              </View>
              <View style={styles.profileText}>
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
            </Card>
          </Pressable>

          <PlusAndAiPromoCard />
        </View>

        {/* Einstellungs-Menügruppen */}
        <View style={styles.groups}>
          {/* Tracking & Ernährung (Ziele, Vitalwerte, Methoden) */}
          <SettingsGroup title={t('settings.groups.tracking.title')}>
            <SettingsRow
              icon="🎯"
              label={t('settings.groups.tracking.myTracking.label')}
              hint={t('settings.groups.tracking.myTracking.hint')}
              onPress={() => router.push('/profile/tracking')}
              last
            />
          </SettingsGroup>

          {/* Haushalt (Mitglieder, Lagerorte, Einkaufsliste) */}
          <SettingsGroup title={t('settings.groups.household.title')}>
            <SettingsRow
              icon="🏠"
              label={t('settings.groups.household.members.label')}
              value={activeHousehold?.name ?? t('settings.groups.household.members.noHousehold')}
              hint={
                hasHousehold ? undefined : t('settings.groups.household.members.switchOrJoinHint')
              }
              onPress={() => router.push('/household/members')}
            />
            <SettingsRow
              icon="📦"
              label={t('settings.groups.household.storageLocations.label')}
              hint={t('settings.groups.household.storageLocations.hint')}
              onPress={hasHousehold ? () => router.push('/household/storage-locations') : undefined}
              disabled={!hasHousehold}
            />
            <SettingsRow
              icon="🏬"
              label={t('settings.groups.household.shoppingList.label')}
              hint={t('settings.groups.household.shoppingList.hint')}
              onPress={hasHousehold ? () => router.push('/household/stores') : undefined}
              disabled={!hasHousehold}
            />
            <SettingsRow
              icon="🔎"
              label={t('settings.groups.household.productSearch.label')}
              hint={t('settings.groups.household.productSearch.hint')}
              onPress={hasHousehold ? () => router.push('/settings/product-search') : undefined}
              disabled={!hasHousehold}
              last
            />
          </SettingsGroup>

          <SettingsGroup title={t('settings.appGroup')}>
            <View style={styles.languageRow}>
              <SegmentedControl
                label={t('common.language')}
                options={[
                  { value: 'de', label: t('common.german') },
                  { value: 'en', label: t('common.english') },
                ]}
                selected={selectedLanguage}
                onSelect={(language: AppLanguage) => void setAppLanguage(language)}
                appearance="surface"
                size="compact"
              />
            </View>
            <SettingsRow
              icon="🔐"
              label={t('settings.groups.app.permissions.label')}
              onPress={() => router.push('/settings/permissions')}
            />
            <SettingsRow
              icon="🔔"
              label={t('settings.groups.app.notifications.label')}
              onPress={() => router.push('/settings/notifications')}
            />
            <SettingsRow
              icon="🧩"
              label={t('settings.groups.app.modules.label')}
              hint={t('settings.groups.app.modules.hint')}
              onPress={() => router.push('/settings/modules')}
            />
            <SettingsRow
              icon="🏆"
              label={t('settings.groups.app.gamification.label')}
              hint={t('settings.groups.app.gamification.hint')}
              onPress={() => router.push('/gamification')}
            />
            <SettingsRow
              icon="➕"
              label={t('settings.groups.app.fabPosition.label')}
              value={
                fabPosition === 'left'
                  ? t('settings.groups.app.fabPosition.left')
                  : t('settings.groups.app.fabPosition.right')
              }
              hint={t('settings.groups.app.fabPosition.hint')}
              onPress={() => setFabPosition(fabPosition === 'left' ? 'right' : 'left')}
            />
            <SettingsRow
              icon="💬"
              label={t('settings.groups.app.feedback.label')}
              onPress={() => router.push('/settings/feedback')}
              last
            />
          </SettingsGroup>

          {/* Datenverwaltung & Datenschutz (Export, DSGVO, Löschen) */}
          <SettingsGroup title={t('settings.groups.data.title')}>
            <SettingsRow
              icon="📤"
              label={t('settings.groups.data.export.label')}
              onPress={() => router.push('/settings/export')}
            />
            <SettingsRow
              icon="🔒"
              label={t('settings.groups.data.privacy.label')}
              onPress={() => router.push('/settings/privacy')}
            />
            <SettingsRow
              icon="🗑️"
              label={t('settings.groups.data.deleteAccount.label')}
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
        <View style={styles.signOut}>
          <Button
            title={t('settings.signOut')}
            variant="danger"
            onPress={handleSignOut}
            loading={signingOut}
          />
        </View>

        {/* App-Versionsangabe & Build-Nummer */}
        <Txt variant="body" center style={styles.version}>
          {versionLabel}
        </Txt>
      </ScrollView>
    </HubScreen>
  );
}
