import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlusIcon } from '@/components/icons/fam-icon';
import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/buttons/header-icon-button';
import { Button } from '@/constants/ui';
import { CardGallerySheet } from '@/features/dashboard/components/card-gallery-sheet';
import { CardList } from '@/features/dashboard/components/card-list';
import { DashboardCardsProvider } from '@/features/dashboard/use-card-sizes';
import { useDashboardEditMode } from '@/features/dashboard/use-dashboard-edit-mode';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useExpiryNotifications } from '@/features/inventory/use-expiry-notifications';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileAvatar } from '@/features/navigation/use-profile-initials';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { syncRunHasErrors, triggerHouseholdSync } from '@/lib/sync/sync-runner';

const styles = StyleSheet.create({
  editTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  editBody: {
    flex: 1,
    paddingTop: space.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: space.sm,
  },
});

export function DashboardScreen() {
  const { colors } = useTheme();
  const hubGradient = useHubGradient();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { openDrawer, openProfile } = useNavigationChrome();
  const { initials, avatarUrl } = useProfileAvatar();

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

  const bottomPadding = insets.bottom + space.xxl + space.xxxl;

  const editChromeTrailing = isEditing ? (
    <View style={styles.editTrailing}>
      <HeaderIconButton label="Karten anpassen" onPress={openGallery}>
        <PlusIcon color={colors.accent} />
      </HeaderIconButton>
      <Button
        title="Fertig"
        onPress={exitEditMode}
        accessibilityLabel="Bearbeitungsmodus beenden"
        variant="accent"
        accentKey="pantry"
        size="sm"
        flat
      />
    </View>
  ) : null;

  const cardList = (
    <CardList
      isEditing={isEditing}
      onEnterEditMode={enterEditMode}
      onOpenGallery={openGallery}
      onDragStateChange={setIsDragging}
    />
  );

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
          avatarUrl,
          trailing: editChromeTrailing,
        }}
        backgroundGradient={hubGradient}>
        {isEditing ? (
          <View style={styles.editBody}>{cardList}</View>
        ) : (
          <ScrollView
            testID="dashboard-scroll-view"
            style={[styles.scroll, { overflow: isDragging ? 'visible' : 'hidden' }]}
            scrollEnabled={!isDragging}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                testID="dashboard-refresh-control"
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
              />
            }>
            {cardList}
          </ScrollView>
        )}

        {/* Galerie-Bottom-Sheet zum Hinzufügen/Entfernen von Dashboard-Karten */}
        <CardGallerySheet visible={isGalleryOpen} onClose={closeGallery} />
      </Screen>
    </DashboardCardsProvider>
  );
}
