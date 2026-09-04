import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileAvatar } from '@/features/navigation/use-profile-initials';
import { PostalCodeEditor } from '../components/postal-code-editor';
import { useBrochurePostalCode } from '../hooks/use-brochure-postal-code';
import { useBrochureSync } from '../hooks/use-brochure-sync';
import { useBrochures } from '../hooks/use-brochures';

export default function BrochuresOverviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  // Angebote ist ein Drawer-Top-Level-Screen: der Header braucht einen Menü-Button
  // zurück ins Nav-Menü statt eines Zurück-Pfeils zur vorherigen Route.
  const { openDrawer, openProfile } = useNavigationChrome();
  const { initials, avatarUrl } = useProfileAvatar();
  const chrome = { onMenuPress: openDrawer, onAvatarPress: openProfile, initials, avatarUrl };
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isEditingPostalCode, setIsEditingPostalCode] = useState(false);
  const location = useBrochurePostalCode();
  const postalCode = location.status === 'ready' ? location.postalCode : null;
  const { isSyncing, hasSynced } = useBrochureSync(postalCode);
  const { data, isLoading } = useBrochures();

  if (location.status === 'locating') {
    return (
      <Screen title="Angebote" chrome={chrome}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
          <Txt variant="body" tone="secondary">Standort wird ermittelt...</Txt>
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
      <Screen title="Angebote" chrome={chrome}>
        <View style={[styles.locationState, { backgroundColor: colors.bg }]}>
          <Txt variant="heading" style={[styles.locationTitle, { color: colors.text }]}>Standort erforderlich</Txt>
          <Txt variant="body" style={[styles.locationCopy, { color: colors.textMuted }]}> 
            {permanentlyDenied
              ? 'Erlaube den Standortzugriff in den Systemeinstellungen, damit fam die Prospekte für deine PLZ laden kann.'
              : denied
                ? 'Erlaube den Standortzugriff, damit fam die Prospekte für deine PLZ laden kann.'
                : 'Deine PLZ konnte gerade nicht ermittelt werden.'}
          </Text>
          {isEditingPostalCode ? (
            <PostalCodeEditor
              onCancel={() => setIsEditingPostalCode(false)}
              onSubmit={async (code) => {
                await location.setManualPostalCode(code);
                setIsEditingPostalCode(false);
              }}
            />
          ) : (
            <>
              <Pressable
                role="button"
                style={[styles.locationButton, { backgroundColor: colors.basil }]}
                onPress={() => {
                  if (permanentlyDenied) void Linking.openSettings();
                  else location.retry();
                }}>
                <Txt variant="body" tone="inverse" weight="700">
                  {permanentlyDenied ? 'Einstellungen öffnen' : 'Erneut versuchen'}
                </Txt>
              </Pressable>
              <Pressable role="button" onPress={() => setIsEditingPostalCode(true)}>
                <Txt variant="body" tone="secondary" style={{ textDecorationLine: 'underline' }}>
                  PLZ stattdessen manuell eingeben
                </Txt>
              </Pressable>
            </>
          )}
        </View>
      </Screen>
    );
  }
  if (isLoading || isSyncing || !hasSynced) {
    return (
      <Screen title="Angebote" chrome={chrome}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
          <Txt variant="body" tone="secondary">
            Angebote für {postalCode} werden geladen...
          </Txt>
        </View>
      </Screen>
    );
  }
  if (data?.cacheZip !== postalCode) {
    return (
      <Screen title="Angebote" chrome={chrome}>
        <View style={[styles.locationState, { backgroundColor: colors.bg }]}>
          <Txt variant="heading" style={[styles.locationTitle, { color: colors.text }]}>Noch keine Prospekte</Txt>
          <Txt variant="body" style={[styles.locationCopy, { color: colors.textMuted }]}> 
            Für die PLZ {postalCode} liegt derzeit kein aktueller Dump vor.
          </Text>
        </View>
      </Screen>
    );
  }
  const { brochures, favorites, stores } = data || { brochures: [], favorites: [], stores: [] };
  const availableStoreIds = new Set(brochures.map((brochure) => brochure.storeId));
  const availableStores = stores
    .filter((store) => availableStoreIds.has(store.id))
    .sort((left, right) => left.name.localeCompare(right.name, 'de'));
  const visibleBrochures = selectedStoreId
    ? brochures.filter((brochure) => brochure.storeId === selectedStoreId)
    : brochures;

  return (
    <Screen title="Angebote" chrome={chrome} scroll={false} applyBottomPadding={false}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}>
        {isEditingPostalCode ? (
          <View style={styles.postalCodeEditRow}>
            <PostalCodeEditor
              onCancel={() => setIsEditingPostalCode(false)}
              onSubmit={async (code) => {
                await location.setManualPostalCode(code);
                setIsEditingPostalCode(false);
              }}
            />
          </View>
        ) : (
          <View style={styles.postalCodeRow}>
            <Txt variant="caption" tone="secondary" style={styles.postalCode}>
              PLZ {postalCode}
            </Txt>
            <Pressable role="button" onPress={() => setIsEditingPostalCode(true)}>
              <Txt variant="body" tone="primary" weight="600">Ändern</Txt>
            </Pressable>
            {location.isManual ? (
              <Pressable role="button" onPress={location.useDeviceLocation}>
                <Txt variant="body" tone="secondary" style={{ textDecorationLine: 'underline' }}>
                  Standort verwenden
                </Txt>
              </Pressable>
            ) : null}
          </View>
        )}
        {favorites.length > 0 && (
          <View style={styles.section}>
            <Txt variant="heading" style={[styles.sectionTitle, { color: colors.text }]}>Deine Märkte</Txt>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.favoritesScroll}>
              {favorites.map((store) => (
                <View key={store.id} style={styles.favoriteStore}>
                  {store.logoUrl ? (
                    <Image
                      source={{ uri: store.logoUrl }}
                      style={styles.storeLogo}
                      contentFit="contain"
                    />
                  ) : (
                    <View
                      style={[
                        styles.storeLogoPlaceholder,
                        { backgroundColor: colors.surfaceSoft },
                      ]}>
                      <Txt variant="body" tone="secondary" style={styles.storeInitials}>
                        {store.name.substring(0, 2)}
                      </Txt>
                    </View>
                  )}
                  <Txt
                    variant="caption"
                    tone="secondary"
                    style={styles.storeName}
                    numberOfLines={1}>
                    {store.name}
                  </Txt>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Txt variant="heading" style={[styles.sectionTitle, { color: colors.text }]}>Aktuelle Prospekte</Txt>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            <Pressable
              role="button"
              aria-pressed={selectedStoreId === null}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedStoreId === null ? colors.basil : colors.surface,
                  borderColor: selectedStoreId === null ? colors.basil : colors.border,
                },
              ]}
              onPress={() => setSelectedStoreId(null)}>
              <Txt
                variant="body"
                color={selectedStoreId === null ? colors.inverse : colors.text}>
                Alle
              </Txt>
            </Pressable>
            {availableStores.map((store) => {
              const isSelected = selectedStoreId === store.id;
              return (
                <Pressable
                  key={store.id}
                  role="button"
                  aria-pressed={isSelected}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? colors.basil : colors.surface,
                      borderColor: isSelected ? colors.basil : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedStoreId(store.id)}>
                  <Txt variant="body" color={isSelected ? colors.inverse : colors.text}>
                    {store.name}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.grid}>
            {visibleBrochures.map((brochure) => (
              <Pressable
                key={brochure.id}
                style={[
                  styles.brochureCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => router.push(`/brochures/${brochure.id}`)}>
                <Image
                  source={{ uri: brochure.coverImage }}
                  style={styles.brochureCover}
                  contentFit="cover"
                />
                <View style={styles.brochureInfo}>
                  <Txt variant="body" style={[styles.brochureTitle, { color: colors.text }]} numberOfLines={2}>
                    {brochure.title}
                  </Txt>
                  <Txt variant="caption" tone="secondary" style={styles.brochureDate}>
                    Bis {new Date(brochure.validUntil).toLocaleDateString()}
                  </Txt>
                </View>
              </Pressable>
            ))}
            {visibleBrochures.length === 0 ? (
              <Txt variant="body" tone="secondary" style={styles.emptyText}> 
                Keine Prospekte.
              </Txt>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
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
    padding: 28,
    gap: 12,
  },
  locationTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  locationCopy: {
    maxWidth: 360,
    textAlign: 'center',
    lineHeight: 21,
  },
  locationButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 18,
  },
  postalCode: {
    fontSize: 13,
  },
  postalCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  postalCodeEditRow: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1F1A21',
  },
  favoritesScroll: {
    flexDirection: 'row',
  },
  favoriteStore: {
    alignItems: 'center',
    marginRight: 16,
    width: 72,
  },
  storeLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginBottom: 8,
  },
  storeLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeInitials: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  storeName: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  brochureCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  brochureCover: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#F3F4F6',
  },
  brochureInfo: {
    padding: 12,
  },
  brochureTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  brochureDate: {
    fontSize: 12,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  emptyText: {
    paddingVertical: 24,
  },
});
