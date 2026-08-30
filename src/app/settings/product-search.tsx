import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  usePreferredProductMarket,
  useSetPreferredProductMarket,
} from '@/features/product-search/preferred-market';
import { useStores } from '@/features/shopping-list/hooks/use-stores';

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
      <View className="gap-three">
        <ThemedText themeColor="textSecondary">
          Der bevorzugte Markt beeinflusst die Reihenfolge der Suchtreffer. Passende Eigenmarken
          werden etwas weiter nach vorne sortiert. Die Einstellung ist persönlich und nur auf diesem
          Gerät gespeichert.
        </ThemedText>

        {loading ? null : (
          <View className="gap-two">
            <View className="gap-one">
              <ThemedText type="small" themeColor="textSecondary">
                Bevorzugte Märkte
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Wähle mehrere Märkte. Die Reihenfolge bestimmt die Priorität.
              </ThemedText>
            </View>
            <View className="gap-one">
              {orderedStores.map((store) => {
                const selected = selectedStoreIds.includes(store.id);
                const position = selectedStoreIds.indexOf(store.id);
                return (
                  <View key={store.id} className="flex-row items-center gap-two">
                    <Pressable
                      onPress={() => toggleStore(store.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${store.name} auswählen`}
                      className="input-field flex-1 active:opacity-75">
                      <ThemedText themeColor="text">
                        {selected ? `✓  ${position + 1}. ${store.name}` : store.name}
                      </ThemedText>
                    </Pressable>
                    {selected ? (
                      <View className="flex-row gap-one">
                        <Pressable
                          onPress={() => moveStore(position, -1)}
                          disabled={position === 0}
                          accessibilityRole="button"
                          accessibilityLabel={`${store.name} nach oben bewegen`}
                          className="px-two py-two active:opacity-75">
                          <ThemedText themeColor="text">↑</ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => moveStore(position, 1)}
                          disabled={position === selectedStoreIds.length - 1}
                          accessibilityRole="button"
                          accessibilityLabel={`${store.name} nach unten bewegen`}
                          className="px-two py-two active:opacity-75">
                          <ThemedText themeColor="text">↓</ThemedText>
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
          <ThemedText type="small" themeColor="textSecondary">
            Lege zuerst unter Einstellungen → Märkte einen Markt an.
          </ThemedText>
        ) : null}
      </View>
    </Screen>
  );
}
