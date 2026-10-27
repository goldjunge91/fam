import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FilterIcon, SearchIcon } from '@/components/icons/fam-icon';
import { Screen } from '@/components/layout/screen';
import { borderWidth, radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, Txt } from '@/constants/ui';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileAvatar } from '@/features/navigation/use-profile-initials';
import { BrochureFilterSheet } from '../components/brochure-filter-sheet';
import { PostalCodeEditor } from '../components/postal-code-editor';
import { useBrochureImagePrefetch } from '../hooks/use-brochure-image-prefetch';
import { useBrochurePostalCode } from '../hooks/use-brochure-postal-code';
import { useBrochureSync } from '../hooks/use-brochure-sync';
import { useBrochures } from '../hooks/use-brochures';
import { groupBrochureStores } from '../market-groups';

const EMPTY_IMAGE_REFERENCES: [] = [];

export default function BrochuresOverviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  // Prospekte ist ein Drawer-Top-Level-Screen: der Header braucht einen Menü-Button
  // zurück ins Nav-Menü statt eines Zurück-Pfeils zur vorherigen Route.
  const { openDrawer, openProfile } = useNavigationChrome();
  const { initials, avatarUrl } = useProfileAvatar();
  const chrome = { onMenuPress: openDrawer, onAvatarPress: openProfile, initials, avatarUrl };
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string> | null>(null);
  const [filterDraftStoreIds, setFilterDraftStoreIds] = useState<Set<string>>(new Set());
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isEditingPostalCode, setIsEditingPostalCode] = useState(false);
  const location = useBrochurePostalCode();
  const postalCode = location.status === 'ready' ? location.postalCode : null;
  const { isSyncing, hasSynced, isScanPending, hasScanError } = useBrochureSync(postalCode);
  const { data, isLoading } = useBrochures();
  const imageReferences =
    data?.cacheZip === postalCode ? data.imageReferences : EMPTY_IMAGE_REFERENCES;
  useBrochureImagePrefetch(imageReferences, data?.cacheZip === postalCode ? postalCode : null);

  const lastPostalCode = useRef(postalCode);
  useEffect(() => {
    if (lastPostalCode.current === postalCode) return;
    lastPostalCode.current = postalCode;
    setSelectedStoreIds(null);
    setFilterDraftStoreIds(new Set());
    setIsFilterSheetVisible(false);
    setSearchQuery('');
    setShowFavoritesOnly(false);
  }, [postalCode]);

  const postalCodeSettings = isEditingPostalCode ? (
    <View style={styles.postalCodeEditRow}>
      <PostalCodeEditor
        onCancel={() => setIsEditingPostalCode(false)}
        onSubmit={async (code) => {
          await location.setManualPostalCode(code);
          setIsEditingPostalCode(false);
        }}
      />
    </View>
  ) : postalCode ? (
    <View style={styles.postalCodeRow}>
      <Txt variant="body" tone="primary" weight="500">
        PLZ {postalCode}
      </Txt>
      <Pressable
        accessibilityRole="button"
        style={styles.postalCodeAction}
        onPress={() => setIsEditingPostalCode(true)}>
        <Txt variant="body" tone="primary" weight="500">
          PLZ ändern
        </Txt>
      </Pressable>
      {location.isManual ? (
        <Pressable
          accessibilityRole="button"
          style={styles.postalCodeAction}
          onPress={location.useDeviceLocation}>
          <Txt variant="body" tone="secondary" style={{ textDecorationLine: 'underline' }}>
            Standort verwenden
          </Txt>
        </Pressable>
      ) : null}
    </View>
  ) : (
    <Pressable
      accessibilityRole="button"
      style={styles.postalCodeAction}
      onPress={() => setIsEditingPostalCode(true)}>
      <Txt variant="body" tone="secondary" style={{ textDecorationLine: 'underline' }}>
        PLZ manuell eingeben
      </Txt>
    </Pressable>
  );

  if (location.status === 'locating') {
    return (
      <Screen title="Prospekte" chrome={chrome}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <Txt variant="body" tone="secondary">
            Standort wird ermittelt...
          </Txt>
          {postalCodeSettings}
        </View>
      </Screen>
    );
  }
  if (location.status !== 'ready') {
    const denied = location.status === 'denied';
    // Solange iOS/Android noch einen erneuten System-Dialog erlauben (canAskAgain),
    // reicht ein erneuter Request statt eines Umwegs über die Einstellungen.
    const permanentlyDenied = denied && !location.canAskAgain;
    return (
      <Screen title="Prospekte" chrome={chrome}>
        <View style={[styles.locationState, { backgroundColor: colors.background }]}>
          <Txt variant="heading" style={styles.locationTitle}>
            Standort erforderlich
          </Txt>
          <Txt variant="body" tone="secondary" style={styles.locationCopy}>
            {permanentlyDenied
              ? 'Erlaube den Standortzugriff in den Systemeinstellungen, damit fam die Prospekte für deine PLZ laden kann.'
              : denied
                ? 'Erlaube den Standortzugriff, damit fam die Prospekte für deine PLZ laden kann.'
                : 'Deine PLZ konnte gerade nicht ermittelt werden.'}
          </Txt>
          {isEditingPostalCode ? (
            postalCodeSettings
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                style={[styles.locationButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  if (permanentlyDenied) void Linking.openSettings();
                  else location.retry();
                }}>
                <Txt variant="body" tone="onAccent" weight="700">
                  {permanentlyDenied ? 'Einstellungen öffnen' : 'Erneut versuchen'}
                </Txt>
              </Pressable>
              {postalCodeSettings}
            </>
          )}
        </View>
      </Screen>
    );
  }
  const hasCurrentBrochures = data?.cacheZip === postalCode && data.brochures.length > 0;
  if (isLoading || isSyncing || !hasSynced || (isScanPending && !hasCurrentBrochures)) {
    return (
      <Screen title="Prospekte" chrome={chrome}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <Txt variant="body" tone="secondary">
            Prospekte für {postalCode} werden geladen...
          </Txt>
          {postalCodeSettings}
        </View>
      </Screen>
    );
  }
  if (hasScanError && !hasCurrentBrochures) {
    return (
      <Screen title="Prospekte" chrome={chrome}>
        <View style={[styles.locationState, { backgroundColor: colors.background }]}>
          <Txt variant="heading" style={styles.locationTitle}>
            Prospekte konnten nicht geladen werden
          </Txt>
          <Txt variant="body" tone="secondary" style={styles.locationCopy}>
            Für die PLZ {postalCode} konnte der Prospektkatalog gerade nicht aktualisiert werden.
            Versuche es später erneut.
          </Txt>
          {postalCodeSettings}
        </View>
      </Screen>
    );
  }
  if (data?.cacheZip !== postalCode) {
    return (
      <Screen title="Prospekte" chrome={chrome}>
        <View style={[styles.locationState, { backgroundColor: colors.background }]}>
          <Txt variant="heading" style={styles.locationTitle}>
            Noch keine Prospekte
          </Txt>
          <Txt variant="body" tone="secondary" style={styles.locationCopy}>
            Für die PLZ {postalCode} liegt derzeit kein aktueller Dump vor.
          </Txt>
          {postalCodeSettings}
        </View>
      </Screen>
    );
  }
  const { brochures, favorites, stores } = data || { brochures: [], favorites: [], stores: [] };
  const availableStoreIds = new Set(brochures.map((brochure) => brochure.storeId));
  const availableStores = stores
    .filter((store) => availableStoreIds.has(store.id))
    .sort((left, right) => left.name.localeCompare(right.name, 'de'));
  const allAvailableStoreIds = new Set(availableStores.map((store) => store.id));
  const marketGroups = groupBrochureStores(availableStores);
  const storeById = new Map(availableStores.map((store) => [store.id, store]));
  const brochureCounts = new Map<string, number>();
  for (const brochure of brochures) {
    brochureCounts.set(brochure.storeId, (brochureCounts.get(brochure.storeId) ?? 0) + 1);
  }
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('de-DE');
  const countResults = (storeIds: ReadonlySet<string>) =>
    brochures.reduce((count, brochure) => {
      const store = storeById.get(brochure.storeId);
      if (!store || !storeIds.has(store.id) || (showFavoritesOnly && !store.isFavorite))
        return count;

      const matchesQuery =
        normalizedQuery.length === 0 ||
        store.name.toLocaleLowerCase('de-DE').includes(normalizedQuery) ||
        brochure.title.toLocaleLowerCase('de-DE').includes(normalizedQuery);
      return matchesQuery ? count + 1 : count;
    }, 0);
  const visibleStoreIds = selectedStoreIds ?? allAvailableStoreIds;
  const visibleMarketGroups = marketGroups
    .map((group) => ({
      ...group,
      stores: group.stores.flatMap((store) => {
        if (!visibleStoreIds.has(store.id) || (showFavoritesOnly && !store.isFavorite)) return [];

        const storeMatchesQuery = store.name.toLocaleLowerCase('de-DE').includes(normalizedQuery);
        const visibleBrochures = brochures.filter(
          (brochure) =>
            brochure.storeId === store.id &&
            (normalizedQuery.length === 0 ||
              storeMatchesQuery ||
              brochure.title.toLocaleLowerCase('de-DE').includes(normalizedQuery)),
        );
        return visibleBrochures.length > 0 ? [{ store, brochures: visibleBrochures }] : [];
      }),
    }))
    .filter((group) => group.stores.length > 0);
  const visibleBrochureCount = visibleMarketGroups.reduce(
    (count, group) =>
      count + group.stores.reduce((total, market) => total + market.brochures.length, 0),
    0,
  );
  const draftResultCount = countResults(filterDraftStoreIds);

  return (
    <Screen title="Prospekte" chrome={chrome} scroll={false} applyBottomPadding={false}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}>
        {postalCodeSettings}
        <View
          style={[
            styles.searchField,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          ]}>
          <SearchIcon size={space.lg} color={colors.textSecondary} />
          <TextInput
            accessibilityLabel="Prospekte und Märkte suchen"
            placeholder="Markt oder Prospekt suchen"
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.accent}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
          />
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.scopeTabs}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !showFavoritesOnly }}
              onPress={() => setShowFavoritesOnly(false)}
              style={[
                styles.scopeTab,
                !showFavoritesOnly && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
              ]}>
              <Txt variant="body" tone={!showFavoritesOnly ? 'primary' : 'secondary'} weight="500">
                Alle Märkte
              </Txt>
            </Pressable>
            {favorites.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: showFavoritesOnly }}
                onPress={() => setShowFavoritesOnly(true)}
                style={[
                  styles.scopeTab,
                  showFavoritesOnly && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
                ]}>
                <Txt variant="body" tone={showFavoritesOnly ? 'primary' : 'secondary'} weight="500">
                  Favoriten
                </Txt>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedStoreIds === null
                ? 'Filter öffnen'
                : `Filter öffnen, ${selectedStoreIds.size} ausgewählt`
            }
            onPress={() => {
              setFilterDraftStoreIds(new Set(selectedStoreIds ?? allAvailableStoreIds));
              setIsFilterSheetVisible(true);
            }}
            style={[styles.filterButton, { borderColor: colors.border }]}>
            <FilterIcon size={space.lg} color={colors.text} />
            <Txt variant="body" weight="500">
              Filter
            </Txt>
            {selectedStoreIds !== null ? (
              <Txt variant="caption" tone="secondary">
                {selectedStoreIds.size}
              </Txt>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <Txt variant="body" weight="600">
            Aktuelle Prospekte
          </Txt>
          <Txt variant="caption" tone="secondary">
            {visibleBrochureCount}
          </Txt>
        </View>

        {visibleMarketGroups.map((group) => (
          <View key={group.id} style={styles.groupSection}>
            <Txt variant="subheading" style={styles.groupTitle}>
              {group.label}
            </Txt>
            {group.stores.map(({ store, brochures: storeBrochures }) => (
              <View key={store.id} style={styles.marketSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={store.name}
                  accessibilityState={{
                    selected: visibleStoreIds.size === 1 && visibleStoreIds.has(store.id),
                  }}
                  onPress={() => {
                    setShowFavoritesOnly(false);
                    setSelectedStoreIds(new Set([store.id]));
                  }}
                  style={styles.marketHeading}>
                  <Txt variant="body" weight="600" style={styles.marketName} numberOfLines={1}>
                    {store.name}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    {storeBrochures.length} Prospekte
                  </Txt>
                </Pressable>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.brochureRow}>
                  {storeBrochures.map((brochure) => (
                    <Pressable
                      key={brochure.id}
                      style={[
                        styles.brochureCard,
                        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                      ]}
                      onPress={() => router.push(`/brochures/${brochure.id}`)}>
                      <Image
                        source={brochure.coverImage}
                        style={[styles.brochureCover, { backgroundColor: colors.backgroundSoft }]}
                        contentFit="cover"
                      />
                      <View style={styles.brochureInfo}>
                        <Txt
                          variant="body"
                          weight="600"
                          style={styles.brochureTitle}
                          numberOfLines={2}>
                          {brochure.title}
                        </Txt>
                        <Txt variant="caption" tone="secondary" style={styles.brochureDate}>
                          Bis {new Date(brochure.validUntil).toLocaleDateString()}
                        </Txt>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        ))}
        {visibleBrochureCount === 0 ? (
          <Txt variant="body" tone="secondary" style={styles.emptyText}>
            {normalizedQuery.length > 0
              ? 'Keine passenden Prospekte gefunden.'
              : showFavoritesOnly
                ? 'Keine Prospekte in deinen Favoriten.'
                : 'Keine Prospekte.'}
          </Txt>
        ) : null}
      </ScrollView>
      <BrochureFilterSheet
        visible={isFilterSheetVisible}
        groups={marketGroups}
        selectedStoreIds={filterDraftStoreIds}
        brochureCounts={brochureCounts}
        resultCount={draftResultCount}
        onClose={() => setIsFilterSheetVisible(false)}
        onReset={() => setFilterDraftStoreIds(new Set(allAvailableStoreIds))}
        onToggleGroup={(storeIds) => {
          const allSelected = storeIds.every((storeId) => filterDraftStoreIds.has(storeId));
          setFilterDraftStoreIds((current) => {
            const next = new Set(current);
            storeIds.forEach((storeId) => {
              if (allSelected) next.delete(storeId);
              else next.add(storeId);
            });
            return next;
          });
        }}
        onToggleStore={(storeId) => {
          setFilterDraftStoreIds((current) => {
            const next = new Set(current);
            if (next.has(storeId)) next.delete(storeId);
            else next.add(storeId);
            return next;
          });
        }}
        onApply={() => {
          setSelectedStoreIds(
            filterDraftStoreIds.size === allAvailableStoreIds.size
              ? null
              : new Set(filterDraftStoreIds),
          );
          setIsFilterSheetVisible(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xxl,
    gap: space.md,
  },
  locationTitle: {
    marginBottom: 0,
  },
  locationCopy: {
    maxWidth: 360,
    textAlign: 'center',
  },
  locationButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: space.xl,
  },
  postalCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
  },
  postalCodeAction: {
    minHeight: MIN_TOUCH_SIZE,
    justifyContent: 'center',
  },
  postalCodeEditRow: {
    marginBottom: space.lg,
  },
  searchField: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: borderWidth.base,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  searchInput: {
    flex: 1,
    height: MIN_TOUCH_SIZE,
    paddingVertical: 0,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginBottom: space.lg,
  },
  scopeTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  scopeTab: {
    minHeight: MIN_TOUCH_SIZE,
    justifyContent: 'center',
  },
  filterButton: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: borderWidth.base,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  groupSection: {
    marginBottom: space.lg,
  },
  groupTitle: {
    marginBottom: space.sm,
  },
  marketSection: {
    marginBottom: space.md,
  },
  marketHeading: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  marketName: {
    flex: 1,
  },
  brochureRow: {
    gap: space.md,
    paddingBottom: space.md,
  },
  brochureCard: {
    width: 148,
    borderWidth: borderWidth.base,
    borderRadius: radius.sm,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  brochureCover: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  brochureInfo: {
    padding: space.md,
  },
  brochureTitle: {
    marginBottom: space.xs,
  },
  brochureDate: {},
  emptyText: {
    paddingVertical: space.xl,
  },
});
