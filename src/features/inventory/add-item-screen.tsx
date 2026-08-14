import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateWheelField } from '@/components/date-wheel-field';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useAddFridgeItemMutation } from '@/features/fridge/use-fridge-mutations';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { FrequentProductsQuickSelect } from '@/features/inventory/frequent-products-quick-select';
import { consumePendingProductSelection } from '@/features/inventory/pending-product-selection';
import { persistOffProductIfNeeded } from '@/features/inventory/persist-off-product';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import {
  useAddStorageLocationMutation,
  useStorageLocations,
} from '@/features/inventory/use-storage-locations';
import { getDatabase } from '@/lib/db/client';
import { recordProductUsage } from '@/lib/db/product-usage';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { formatPackageHint } from '@/lib/package-size';
import { normalizeUnit } from '@/lib/units';

function formatOffsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatOffsetMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function AddItemScreen() {
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;

  const { data: locations, isLoading: locationsLoading } = useStorageLocations(
    currentHousehold?.id,
  );
  const mutation = useAddFridgeItemMutation();
  const addLocationMutation = useAddStorageLocationMutation();
  const addProductMutation = useAddProductMutation();
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [packageSize, setPackageSize] = useState<number | null>(null);
  const [packageSizeUnit, setPackageSizeUnit] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<OpenFoodFactsProduct | null>(null);

  // Scanner & Modal State
  const [showScanner, setShowScanner] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  const activeLocationId = locationId ?? locations?.[0]?.id ?? null;

  function handleSelectProduct(product: OpenFoodFactsProduct) {
    setName(product.name);
    const productUnit = normalizeUnit(product.unit);
    const productQuantity = product.quantity ?? null;
    const hasKnownPackageSize =
      productQuantity !== null && ['g', 'kg', 'ml', 'l'].includes(productUnit);
    setQuantity('1');
    setUnit(hasKnownPackageSize ? 'package' : productUnit);
    setPackageSize(hasKnownPackageSize ? productQuantity : null);
    setPackageSizeUnit(hasKnownPackageSize ? productUnit : null);
    setSelectedProduct(product);
  }

  // Nimmt ein Produkt entgegen, das ueber "Produkt manuell anlegen" (#80) im
  // add-product-Screen erstellt wurde und beim Zurueckkommen hier abgeholt
  // wird — Expo Router kennt keine Rueckgabewerte aus gepushten Routen.
  useFocusEffect(
    useCallback(() => {
      const created = consumePendingProductSelection();
      if (created) {
        setName(created.name);
        if (created.quantity) setQuantity(String(created.quantity));
        if (created.unit) setUnit(created.unit);
      }
    }, []),
  );

  async function handleAddLocation() {
    if (!currentHousehold || !newLocationName.trim()) return;
    try {
      const created = await addLocationMutation.mutateAsync({
        household_id: currentHousehold.id,
        name: newLocationName.trim(),
      });
      setLocationId(created.id);
      setNewLocationName('');
      setShowAddLocation(false);
    } catch (err) {
      console.error('Fehler beim Erstellen des Lagerorts:', err);
    }
  }

  async function handleSave() {
    if (!currentHousehold || !name.trim()) return;

    try {
      const productId = selectedProduct
        ? await persistOffProductIfNeeded(selectedProduct, userId, addProductMutation)
        : null;
      const values = {
        household_id: currentHousehold.id,
        product_id: productId,
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit,
        package_size: packageSize,
        package_size_unit: packageSizeUnit,
        location_id: activeLocationId,
        expiry_date: expiryDate.trim() || null,
      };

      await mutation.mutateAsync(values);

      if (userId) {
        void getDatabase()
          .then((db) =>
            recordProductUsage(db, {
              id: Crypto.randomUUID(),
              userId,
              householdId: currentHousehold.id,
              feature: 'fridge',
              productId,
              name: name.trim(),
              brand: selectedProduct?.brand ?? null,
              barcode: selectedProduct?.barcode ?? null,
              quantity: packageSize ?? (parseFloat(quantity) || 1),
              unit: packageSizeUnit ?? unit,
            }),
          )
          .then(() => queryClient.invalidateQueries({ queryKey: ['product_usage'] }))
          .catch((err) => console.error('Fehler beim Protokollieren der Nutzung:', err));
      }

      router.back();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Screen title="Artikel hinzufügen" back={{ label: 'Abbrechen' }}>
      <View style={styles.form}>
        <Button
          label="📷 Barcode scannen"
          variant="secondary"
          onPress={() => setShowScanner(true)}
        />

        <FrequentProductsQuickSelect
          feature="fridge"
          userId={userId}
          onSelectProduct={handleSelectProduct}
        />

        <ProductSearchDropdown
          label="Name"
          placeholder="z. B. Milch oder Barcode-Name"
          value={name}
          onChangeText={setName}
          onSelectProduct={handleSelectProduct}
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Menge"
              placeholder="1"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Einheit"
              placeholder="piece, l, kg..."
              value={unit}
              onChangeText={setUnit}
            />
          </View>
        </View>

        <View style={{ marginTop: Spacing.two }}>
          <DateWheelField
            label="Mindesthaltbarkeitsdatum (MHD)"
            value={expiryDate}
            onChange={setExpiryDate}
          />
        </View>
        <View style={styles.quickDateGroup}>
          <Button
            label="+ 3 Tage"
            variant="secondary"
            onPress={() => setExpiryDate(formatOffsetDate(3))}
          />
          <Button
            label="+ 7 Tage"
            variant="secondary"
            onPress={() => setExpiryDate(formatOffsetDate(7))}
          />
          <Button
            label="+ 14 Tage"
            variant="secondary"
            onPress={() => setExpiryDate(formatOffsetDate(14))}
          />
          <Button
            label="+ 1 Monat"
            variant="secondary"
            onPress={() => setExpiryDate(formatOffsetMonths(1))}
          />
        </View>

        <View style={styles.locationHeaderRow}>
          <ThemedText style={{ fontWeight: 'bold' }}>Lagerort</ThemedText>
          {!showAddLocation && (
            <Button
              label="+ Neuer Lagerort"
              variant="secondary"
              onPress={() => setShowAddLocation(true)}
            />
          )}
        </View>

        {showAddLocation && (
          <View style={styles.addLocationBox}>
            <TextField
              label="Name des Lagerorts"
              placeholder="z.B. Keller, Regalfach, Gefrierfach"
              value={newLocationName}
              onChangeText={setNewLocationName}
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  label="Erstellen"
                  onPress={handleAddLocation}
                  loading={addLocationMutation.isPending}
                  disabled={!newLocationName.trim()}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Abbrechen"
                  variant="secondary"
                  onPress={() => {
                    setShowAddLocation(false);
                    setNewLocationName('');
                  }}
                />
              </View>
            </View>
          </View>
        )}

        {locationsLoading ? (
          <ThemedText>Lade Lagerorte...</ThemedText>
        ) : (
          <View style={styles.locationGroup}>
            {locations?.map((loc) => {
              const isSelected = activeLocationId === loc.id;
              return (
                <Button
                  key={loc.id}
                  label={loc.name}
                  variant={isSelected ? 'primary' : 'secondary'}
                  onPress={() => setLocationId(loc.id)}
                />
              );
            })}
            {locations?.length === 0 && !showAddLocation && (
              <ThemedText type="small" themeColor="textSecondary">
                Keine Lagerorte vorhanden. Tippe auf &quot;+ Neuer Lagerort&quot; um einen
                anzulegen.
              </ThemedText>
            )}
          </View>
        )}

        <View style={styles.saveButton}>
          <Button
            label="Speichern"
            onPress={handleSave}
            loading={mutation.isPending}
            disabled={!name.trim()}
          />
        </View>
        <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
      </View>

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onProductFound={handleSelectProduct}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
    marginTop: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  quickDateGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  addLocationBox: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  locationGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  saveButton: {
    marginTop: Spacing.four,
  },
});
