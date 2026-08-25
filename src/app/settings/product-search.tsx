import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { WheelPickerField } from '@/components/forms/wheel-picker-field';
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
  const { data: storedStoreId, isLoading: preferenceLoading } =
    usePreferredProductMarket(householdId);
  const setPreferredMarket = useSetPreferredProductMarket();
  const [selectedStoreId, setSelectedStoreId] = useState('');

  useEffect(() => {
    setSelectedStoreId(
      storedStoreId && stores.some((store) => store.id === storedStoreId) ? storedStoreId : '',
    );
  }, [storedStoreId, stores]);

  const options = useMemo(
    () => [
      { value: '', label: 'Neutral, kein bevorzugter Markt' },
      ...stores.map((store) => ({ value: store.id, label: store.name })),
    ],
    [stores],
  );

  async function handleChange(storeId: string) {
    setSelectedStoreId(storeId);
    if (householdId) await setPreferredMarket(householdId, storeId || null);
  }

  const loading = storesLoading || preferenceLoading;

  return (
    <Screen title="Produktsuche" back={{ label: 'Einstellungen' }} backStyle="icon">
      <View className="gap-three">
        <ThemedText themeColor="textSecondary">
          Der bevorzugte Markt beeinflusst die Reihenfolge der Suchtreffer. Passende Eigenmarken
          werden etwas weiter nach vorne sortiert. Die Einstellung ist persönlich und nur auf diesem
          Gerät gespeichert.
        </ThemedText>

        {loading ? null : (
          <WheelPickerField
            label="Bevorzugter Markt"
            value={selectedStoreId}
            options={options}
            onChange={handleChange}
          />
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
