import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from '@/components/icons/fam-icon';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons/header-icon-button';
import { Layout, Spacing } from '@/constants/layout';
import { CardGallerySheet } from '@/features/dashboard/components/card-gallery-sheet';
import { CardList } from '@/features/dashboard/components/card-list';
import { DashboardCardsProvider } from '@/features/dashboard/use-card-sizes';
import { useDashboardEditMode } from '@/features/dashboard/use-dashboard-edit-mode';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useExpiryNotifications } from '@/features/inventory/use-expiry-notifications';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { syncRunHasErrors, triggerHouseholdSync } from '@/lib/sync/sync-runner';

export function DashboardScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { openDrawer, openProfile } = useNavigationChrome();
  const initials = useProfileInitials();

  const { isEditing, isGalleryOpen, enterEditMode, exitEditMode, openGallery, closeGallery } =
    useDashboardEditMode();

  const heute = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  // Hintergrund-Benachrichtigungen fuer ablaufende Artikel aktivieren/synchronisieren
  useExpiryNotifications(householdId);

  async function handleRefresh() {
    if (!householdId) return;
    setRefreshing(true);
    trackAnalyticsEvent('sync.manual.started', { source: 'dashboard_pull_to_refresh' });
    try {
      const result = await triggerHouseholdSync([householdId], false, queryClient);
      trackAnalyticsEvent(
        syncRunHasErrors(result) ? 'sync.manual.failed' : 'sync.manual.completed',
        { source: 'dashboard_pull_to_refresh' },
      );
    } finally {
      setRefreshing(false);
    }
  }

  const bottomPadding = insets.bottom + Spacing.four + Layout.floatingActionClearance;

  const editChromeTrailing = isEditing ? (
    <View className="flex-row items-center gap-two">
      <HeaderIconButton label="Karten anpassen" onPress={openGallery}>
        <PlusIcon color={theme.accent} />
      </HeaderIconButton>
      <Pressable
        onPress={exitEditMode}
        accessibilityRole="button"
        accessibilityLabel="Bearbeitungsmodus beenden"
        className="px-three py-one rounded-control bg-accent items-center justify-center">
        <ThemedText style={{ color: theme.onAccent, fontWeight: '600', fontSize: 13 }}>
          Fertig
        </ThemedText>
      </Pressable>
    </View>
  ) : null;

  return (
    <DashboardCardsProvider>
      <Screen
        title="Übersicht"
        subtitle={heute}
        scroll={false}
        applyBottomPadding={false}
        chrome={{
          onMenuPress: openDrawer,
          onAvatarPress: openProfile,
          initials,
          trailing: editChromeTrailing,
        }}
        backgroundGradient={hubGradient}>
        {/* Scrollbare Dashboard-Kartenliste mit Pull-to-Refresh & Drag-and-Drop.
        Clipping bleibt nur waehrend eines aktiven Drags deaktiviert, damit die
        gezogene Karte nicht abgeschnitten wird — ansonsten schiebt sich der
        Inhalt beim Overscroll sonst ueber die Safe Area bzw. Nav-Buttons. */}
        <ScrollView
          testID="dashboard-scroll-view"
          className="flex-1"
          style={{ overflow: isDragging ? 'visible' : 'hidden' }}
          scrollEnabled={!isDragging}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              testID="dashboard-refresh-control"
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent}
            />
          }>
          {/* Dynamische Widgets/Karten (z. B. Vorrat, Einkaufsliste, Kalorien) */}
          <CardList
            isEditing={isEditing}
            onEnterEditMode={enterEditMode}
            onOpenGallery={openGallery}
            onDragStateChange={setIsDragging}
          />
        </ScrollView>

        {/* Galerie-Bottom-Sheet zum Hinzufügen/Entfernen von Dashboard-Karten */}
        <CardGallerySheet visible={isGalleryOpen} onClose={closeGallery} />
      </Screen>
    </DashboardCardsProvider>
  );
}
