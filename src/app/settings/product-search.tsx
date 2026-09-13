import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  usePreferredProductMarket,
  useSetPreferredProductMarket,
} from '@/features/product-search/preferred-market';
import { useStores } from '@/features/shopping-list/hooks/use-stores';

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.lg,
  },
  section: {
    gap: theme.space.sm,
  },
  sectionHeading: {
    gap: theme.space.xs,
  },
  storeList: {
    gap: theme.space.xs,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  storeButton: {
    flex: 1,
    width: '100%',
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 10,
    backgroundColor: theme.backgroundElement,
  },
  orderControls: {
    flexDirection: 'row',
    gap: theme.space.xs,
  },
  orderButton: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.sm,
  },
  pressed: {
    opacity: 0.75,
  },
}));

export default function ProductSearchSettingsRoute() {
  const { activeHousehold } = useActiveHousehold();
  const householdId = activeHousehold?.id;
  const { data: stores = [], isLoading: storesLoading } = useStores(householdId);
  const { data: storedStoreIds = [], isLoading: preferenceLoading } =
    usePreferredProductMarket(householdId);
  const setPreferredMarket = useSetPreferredProductMarket();
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedStoreIds(
      storedStoreIds.filter((storeId) => stores.some((store) => store.id === storeId)),
    );
  }, [storedStoreIds, stores]);

  async function saveSelection(storeIds: string[]) {
    setSelectedStoreIds(storeIds);
    if (householdId) await setPreferredMarket(householdId, storeIds);
  }

  function toggleStore(storeId: string) {
    const next = selectedStoreIds.includes(storeId)
      ? selectedStoreIds.filter((id) => id !== storeId)
      : [...selectedStoreIds, storeId];
    void saveSelection(next);
  }

  function moveStore(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selectedStoreIds.length) return;
    const next = [...selectedStoreIds];
    [next[index], next[target]] = [next[target], next[index]];
    void saveSelection(next);
  }

  const loading = storesLoading || preferenceLoading;
  const orderedStores = [...stores].sort((left, right) => {
    const leftPosition = selectedStoreIds.indexOf(left.id);
    const rightPosition = selectedStoreIds.indexOf(right.id);
    return (
      (leftPosition < 0 ? stores.length : leftPosition) -
      (rightPosition < 0 ? stores.length : rightPosition)
    );
  });

  return (
    <Screen title="Produktsuche" back={{ label: 'Einstellungen' }} backStyle="icon">
      <View style={styles.content}>
        <Txt variant="body" tone="secondary">
          Der bevorzugte Markt beeinflusst die Reihenfolge der Suchtreffer. Passende Eigenmarken
          werden etwas weiter nach vorne sortiert. Die Einstellung ist persönlich und nur auf diesem
          Gerät gespeichert.
        </Txt>

        {loading ? null : (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Txt variant="caption" tone="secondary">
                Bevorzugte Märkte
              </Txt>
              <Txt variant="caption" tone="secondary">
                Wähle mehrere Märkte. Die Reihenfolge bestimmt die Priorität.
              </Txt>
            </View>
            <View style={styles.storeList}>
              {orderedStores.map((store) => {
                const selected = selectedStoreIds.includes(store.id);
                const position = selectedStoreIds.indexOf(store.id);
                return (
                  <View key={store.id} style={styles.storeRow}>
                    <Pressable
                      onPress={() => toggleStore(store.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${store.name} auswählen`}
                      style={({ pressed }) => [styles.storeButton, pressed && styles.pressed]}>
                      <Txt variant="body" tone="primary">
                        {selected ? `✓  ${position + 1}. ${store.name}` : store.name}
                      </Txt>
                    </Pressable>
                    {selected ? (
                      <View style={styles.orderControls}>
                        <Pressable
                          onPress={() => moveStore(position, -1)}
                          disabled={position === 0}
                          accessibilityRole="button"
                          accessibilityLabel={`${store.name} nach oben bewegen`}
                          style={({ pressed }) => [styles.orderButton, pressed && styles.pressed]}>
                          <Txt variant="body" tone="secondary">
                            ↑
                          </Txt>
                        </Pressable>
                        <Pressable
                          onPress={() => moveStore(position, 1)}
                          disabled={position === selectedStoreIds.length - 1}
                          accessibilityRole="button"
                          accessibilityLabel={`${store.name} nach unten bewegen`}
                          style={({ pressed }) => [styles.orderButton, pressed && styles.pressed]}>
                          <Txt variant="body" tone="secondary">
                            ↓
                          </Txt>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {!loading && stores.length === 0 ? (
          <Txt variant="caption" tone="secondary">
            Lege zuerst unter Einstellungen → Märkte einen Markt an.
          </Txt>
        ) : null}
      </View>
    </Screen>
  );
}
