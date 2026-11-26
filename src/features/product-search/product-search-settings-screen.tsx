import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { Press, Txt } from '@/constants/ui';
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
  storeButtonContainer: {
    flex: 1,
  },
  storeButton: {
    flex: 1,
    width: '100%',
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
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
}));

export default function ProductSearchSettingsScreen() {
  const { t } = useTranslation();
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
    <Screen
      title={t('productSearch.settings.title')}
      back={{ label: t('productSearch.settings.back') }}
      backStyle="icon">
      <View style={styles.content}>
        <Txt variant="body" tone="secondary">
          {t('productSearch.settings.description')}
        </Txt>

        {loading ? null : (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Txt variant="caption" tone="secondary">
                {t('productSearch.settings.preferredMarkets')}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {t('productSearch.settings.priorityHint')}
              </Txt>
            </View>
            <View style={styles.storeList}>
              {orderedStores.map((store) => {
                const selected = selectedStoreIds.includes(store.id);
                const position = selectedStoreIds.indexOf(store.id);
                return (
                  <View key={store.id} style={styles.storeRow}>
                    <Press
                      onPress={() => toggleStore(store.id)}
                      haptic="selection"
                      scaleTo={0.98}
                      containerStyle={styles.storeButtonContainer}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={t('productSearch.settings.select', { store: store.name })}
                      style={styles.storeButton}>
                      <Txt variant="body" tone="primary">
                        {selected
                          ? t('productSearch.settings.selected', {
                              position: position + 1,
                              store: store.name,
                            })
                          : store.name}
                      </Txt>
                    </Press>
                    {selected ? (
                      <View style={styles.orderControls}>
                        <Press
                          onPress={() => moveStore(position, -1)}
                          haptic="selection"
                          scaleTo={0.98}
                          disabled={position === 0}
                          accessibilityRole="button"
                          accessibilityLabel={t('productSearch.settings.moveUp', {
                            store: store.name,
                          })}
                          style={styles.orderButton}>
                          <Txt variant="body" tone="secondary">
                            ↑
                          </Txt>
                        </Press>
                        <Press
                          onPress={() => moveStore(position, 1)}
                          haptic="selection"
                          scaleTo={0.98}
                          disabled={position === selectedStoreIds.length - 1}
                          accessibilityRole="button"
                          accessibilityLabel={t('productSearch.settings.moveDown', {
                            store: store.name,
                          })}
                          style={styles.orderButton}>
                          <Txt variant="body" tone="secondary">
                            ↓
                          </Txt>
                        </Press>
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
            {t('productSearch.settings.noStores')}
          </Txt>
        ) : null}
      </View>
    </Screen>
  );
}
