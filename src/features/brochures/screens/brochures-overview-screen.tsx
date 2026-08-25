import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useBrochurePostalCode } from '../hooks/use-brochure-postal-code';
import { useBrochureSync } from '../hooks/use-brochure-sync';
import { useBrochures } from '../hooks/use-brochures';

export default function BrochuresOverviewScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const location = useBrochurePostalCode();
  const postalCode = location.status === 'ready' ? location.postalCode : null;
  const { isSyncing, hasSynced } = useBrochureSync(postalCode);
  const { data, isLoading } = useBrochures();

  if (location.status === 'locating') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Standort wird ermittelt...</Text>
      </View>
    );
  }
  if (location.status !== 'ready') {
    const denied = location.status === 'denied';
    return (
      <View style={[styles.locationState, { backgroundColor: theme.background }]}>
        <Text style={[styles.locationTitle, { color: theme.text }]}>Standort erforderlich</Text>
        <Text style={[styles.locationCopy, { color: theme.textSecondary }]}>
          {denied
            ? 'Erlaube den Standortzugriff, damit fam die Prospekte für deine PLZ laden kann.'
            : 'Deine PLZ konnte gerade nicht ermittelt werden.'}
        </Text>
        <Pressable
          role="button"
          style={[styles.locationButton, { backgroundColor: theme.accent }]}
          onPress={() => {
            if (denied) void Linking.openSettings();
            else location.retry();
          }}>
          <Text style={{ color: theme.onAccent, fontWeight: '700' }}>
            {denied ? 'Einstellungen öffnen' : 'Erneut versuchen'}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (isLoading || isSyncing || !hasSynced) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>
          Angebote für {postalCode} werden geladen...
        </Text>
      </View>
    );
  }
  if (data?.cacheZip !== postalCode) {
    return (
      <View style={[styles.locationState, { backgroundColor: theme.background }]}>
        <Text style={[styles.locationTitle, { color: theme.text }]}>Noch keine Prospekte</Text>
        <Text style={[styles.locationCopy, { color: theme.textSecondary }]}>
          Für die PLZ {postalCode} liegt derzeit kein aktueller Dump vor.
        </Text>
      </View>
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
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}>
      <Text style={[styles.postalCode, { color: theme.textSecondary }]}>PLZ {postalCode}</Text>
      {favorites.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Deine Märkte</Text>
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
                      { backgroundColor: theme.backgroundSelected },
                    ]}>
                    <Text style={[styles.storeInitials, { color: theme.textSecondary }]}>
                      {store.name.substring(0, 2)}
                    </Text>
                  </View>
                )}
                <Text style={[styles.storeName, { color: theme.textSecondary }]} numberOfLines={1}>
                  {store.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Aktuelle Prospekte</Text>
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
                backgroundColor: selectedStoreId === null ? theme.accent : theme.backgroundElement,
                borderColor: selectedStoreId === null ? theme.accent : theme.border,
              },
            ]}
            onPress={() => setSelectedStoreId(null)}>
            <Text style={{ color: selectedStoreId === null ? theme.onAccent : theme.text }}>
              Alle
            </Text>
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
                    backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                    borderColor: isSelected ? theme.accent : theme.border,
                  },
                ]}
                onPress={() => setSelectedStoreId(store.id)}>
                <Text style={{ color: isSelected ? theme.onAccent : theme.text }}>
                  {store.name}
                </Text>
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
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              onPress={() => router.push(`/brochures/${brochure.id}`)}>
              <Image
                source={{ uri: brochure.coverImage }}
                style={styles.brochureCover}
                contentFit="cover"
              />
              <View style={styles.brochureInfo}>
                <Text style={[styles.brochureTitle, { color: theme.text }]} numberOfLines={2}>
                  {brochure.title}
                </Text>
                <Text style={[styles.brochureDate, { color: theme.textSecondary }]}>
                  Bis {new Date(brochure.validUntil).toLocaleDateString()}
                </Text>
              </View>
            </Pressable>
          ))}
          {visibleBrochures.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Keine Prospekte.</Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
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
