import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  type FridgeItem,
  useUpdateFridgeItemQuantityMutation,
} from '@/features/fridge/use-fridge-mutations';
import { useHouseholds } from '@/features/household/api';
import { useFridgeItems } from '@/features/inventory/api';
import { ProductDetailModal } from '@/features/inventory/product-detail-modal';
import { getProductDetails } from '@/features/inventory/product-details-catalog';
import { useStorageLocations } from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';

function formatExpiryDate(rawDate: string | null): {
  text: string;
  isExpired: boolean;
  isSoon: boolean;
  statusText: string;
  color: string;
  badgeBg: string;
  badgeTextColor: string;
} | null {
  if (!rawDate) return null;

  const parts = rawDate.split('-');
  let formatted = rawDate;
  if (parts.length === 3) {
    formatted = `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(rawDate);
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));

  if (diffDays < 0 || diffDays <= 2) {
    return {
      text: formatted,
      isExpired: diffDays < 0,
      isSoon: false,
      statusText: 'Kritisch',
      color: '#EF4444',
      badgeBg: '#FEE2E2',
      badgeTextColor: '#DC2626',
    };
  }

  if (diffDays <= 5) {
    return {
      text: formatted,
      isExpired: false,
      isSoon: true,
      statusText: 'Bald',
      color: '#F59E0B',
      badgeBg: '#FEF3C7',
      badgeTextColor: '#D97706',
    };
  }

  return {
    text: formatted,
    isExpired: false,
    isSoon: false,
    statusText: '',
    color: '#10B981',
    badgeBg: '#DCFCE7',
    badgeTextColor: '#15803D',
  };
}

export function FridgeScreen() {
  const theme = useTheme();
  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];

  const { data: items, isLoading: itemsLoading } = useFridgeItems(currentHousehold?.id);
  const { data: locations } = useStorageLocations(currentHousehold?.id);
  const updateQuantityMutation = useUpdateFridgeItemQuantityMutation();

  const [selectedLocationId, setSelectedLocationId] = useState<string | 'all'>('all');
  const [selectedModalItem, setSelectedModalItem] = useState<FridgeItem | null>(null);

  // Zähle ablaufende / kritische Artikel
  const expiringCount = useMemo(() => {
    if (!items) return 0;
    return items.filter((i) => {
      const info = formatExpiryDate(i.expiry_date);
      return info && (info.isExpired || info.isSoon || info.color === '#EF4444');
    }).length;
  }, [items]);

  // Gefilterte Liste
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (selectedLocationId === 'all') return items;
    return items.filter((i) => i.location_id === selectedLocationId);
  }, [items, selectedLocationId]);

  return (
    <Screen title="Vorrat" scroll={false}>
      <View style={styles.container}>
        {/* Header Zusatzzeile: Warn-Badge + Artikel-Anzahl + Add-Knopf */}
        <View style={styles.topBarRow}>
          <View style={styles.topBarLeft}>
            {expiringCount > 0 ? (
              <View style={styles.warningBadge}>
                <ThemedText style={styles.warningBadgeIcon}>⚠️</ThemedText>
                <ThemedText type="smallBold" style={styles.warningBadgeText}>
                  {expiringCount} ablaufend
                </ThemedText>
              </View>
            ) : null}
          </View>

          <Pressable
            style={styles.addButtonCircle}
            onPress={() => router.push('/add-item')}
            accessibilityLabel="Artikel hinzufügen">
            <ThemedText style={styles.addButtonIcon}>+</ThemedText>
          </Pressable>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitleText}>
          {items?.length ?? 0} Artikel gesamt · Tippe für Nährwerte
        </ThemedText>

        {/* Lagerort Filter Tabs (Kühl, Froster, Kammer) */}
        <View style={styles.locationTabsRow}>
          <Pressable
            onPress={() => setSelectedLocationId('all')}
            style={[styles.locationTab, selectedLocationId === 'all' && styles.locationTabActive]}>
            <ThemedText
              type="smallBold"
              style={
                selectedLocationId === 'all' ? styles.locationTabTextActive : styles.locationTabText
              }>
              Alle
            </ThemedText>
          </Pressable>

          {locations?.map((loc) => {
            const isActive = selectedLocationId === loc.id;
            let icon = '📦';
            if (loc.kind === 'fridge' || loc.name.includes('Kühl')) icon = '🫙';
            else if (
              loc.kind === 'freezer' ||
              loc.name.includes('Tief') ||
              loc.name.includes('Frost')
            )
              icon = '❄️';
            else if (loc.kind === 'pantry' || loc.name.includes('Kammer')) icon = '🥫';

            return (
              <Pressable
                key={loc.id}
                onPress={() => setSelectedLocationId(loc.id)}
                style={[styles.locationTab, isActive && styles.locationTabActive]}>
                <ThemedText style={styles.tabIcon}>{icon}</ThemedText>
                <ThemedText
                  type="smallBold"
                  style={isActive ? styles.locationTabTextActive : styles.locationTabText}>
                  {loc.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Artikel-Liste */}
        {itemsLoading ? (
          <View style={styles.centerContainer}>
            <ThemedText>Vorrat wird geladen...</ThemedText>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.centerContainer}>
            <ThemedText style={{ textAlign: 'center', marginBottom: Spacing.three }}>
              Keine Artikel in dieser Kategorie vorhanden.
            </ThemedText>
            <Pressable style={styles.inlineAddButton} onPress={() => router.push('/add-item')}>
              <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                + Artikel hinzufügen
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const details = getProductDetails(item.name);
              const expiryInfo = formatExpiryDate(item.expiry_date);
              const statusColor = expiryInfo ? expiryInfo.color : '#10B981';

              return (
                <Pressable style={styles.itemCard} onPress={() => setSelectedModalItem(item)}>
                  {/* Linker farbiger Statusbalken */}
                  <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />

                  <View style={styles.itemMainContent}>
                    {/* Titel Zeile mit Info-Icon */}
                    <View style={styles.titleRow}>
                      <ThemedText type="subtitle" style={styles.itemTitle}>
                        {item.name}
                      </ThemedText>
                      <Pressable
                        onPress={() => setSelectedModalItem(item)}
                        style={styles.infoIconCircle}
                        hitSlop={8}>
                        <ThemedText style={styles.infoIconText}>ⓘ</ThemedText>
                      </Pressable>
                    </View>

                    {/* Unterzeile: Kategorie + MHD Badge */}
                    <View style={styles.metaRow}>
                      <ThemedText type="small" style={styles.categorySubText}>
                        {details.category}
                      </ThemedText>

                      {expiryInfo && (
                        <View style={[styles.expiryBadge, { backgroundColor: expiryInfo.badgeBg }]}>
                          <ThemedText
                            type="smallBold"
                            style={[styles.expiryBadgeText, { color: expiryInfo.badgeTextColor }]}>
                            {expiryInfo.text}
                            {expiryInfo.statusText ? ` · ${expiryInfo.statusText}` : ''}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Rechts: Mengen-Stepper (- 1L +) */}
                  <View style={styles.stepperContainer}>
                    <Pressable
                      style={styles.stepperButtonMinus}
                      onPress={() => {
                        if (currentHousehold?.id) {
                          updateQuantityMutation.mutate({
                            id: item.id,
                            household_id: currentHousehold.id,
                            delta: -1,
                          });
                        }
                      }}>
                      <ThemedText style={styles.stepperMinusText}>−</ThemedText>
                    </Pressable>

                    <ThemedText type="smallBold" style={styles.quantityText}>
                      {item.quantity} {item.unit}
                    </ThemedText>

                    <Pressable
                      style={styles.stepperButtonPlus}
                      onPress={() => {
                        if (currentHousehold?.id) {
                          updateQuantityMutation.mutate({
                            id: item.id,
                            household_id: currentHousehold.id,
                            delta: 1,
                          });
                        }
                      }}>
                      <ThemedText style={styles.stepperPlusText}>+</ThemedText>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {/* Produkt Nährwert Modal */}
      <ProductDetailModal
        visible={!!selectedModalItem}
        item={selectedModalItem}
        onClose={() => setSelectedModalItem(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  warningBadgeIcon: {
    fontSize: 12,
  },
  warningBadgeText: {
    color: '#DC2626',
    fontSize: 12,
  },
  addButtonCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  subtitleText: {
    marginBottom: Spacing.two,
    fontSize: 13,
  },
  locationTabsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  locationTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  locationTabActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  tabIcon: {
    fontSize: 14,
  },
  locationTabText: {
    color: '#4B5563',
    fontSize: 13,
  },
  locationTabTextActive: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  listContainer: {
    paddingBottom: 80,
    gap: Spacing.two,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  inlineAddButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 12,
    paddingRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statusStrip: {
    width: 6,
    height: '100%',
    marginRight: 12,
    borderRadius: 3,
  },
  itemMainContent: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTitle: {
    fontWeight: '800',
    fontSize: 16,
    color: '#111827',
  },
  infoIconCircle: {
    paddingHorizontal: 2,
  },
  infoIconText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  categorySubText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  expiryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  expiryBadgeText: {
    fontSize: 11,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepperButtonMinus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperMinusText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '700',
  },
  quantityText: {
    fontSize: 13,
    color: '#111827',
    minWidth: 40,
    textAlign: 'center',
  },
  stepperButtonPlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperPlusText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '700',
  },
  fabButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 24,
  },
});
