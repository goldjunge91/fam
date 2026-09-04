import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlusIcon } from '@/components/icons/fam-icon';
import { Screen } from '@/components/layout/screen';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/buttons/header-icon-button';
import { Txt } from '@/constants/ui';
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
    <View className="flex-row items-center gap-two">
      <HeaderIconButton label="Karten anpassen" onPress={openGallery}>
        <PlusIcon color={colors.basil} />
      </HeaderIconButton>
      <Pressable
        onPress={exitEditMode}
        accessibilityRole="button"
        accessibilityLabel="Bearbeitungsmodus beenden"
        className="px-three py-one rounded-control items-center justify-center"
        style={{ backgroundColor: colors.basil }}>
        <Txt variant="label" tone="onAccent" weight="600">
          Fertig
        </Txt>
      </Pressable>
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
          <View className="flex-1" style={{ paddingTop: space.sm }}>
            {cardList}
          </View>
        ) : (
          <ScrollView
            testID="dashboard-scroll-view"
            className="flex-1"
            style={{ overflow: isDragging ? 'visible' : 'hidden' }}
            scrollEnabled={!isDragging}
            contentContainerStyle={{ paddingTop: space.sm, paddingBottom: bottomPadding }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                testID="dashboard-refresh-control"
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.basil}
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
