import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateWheelField } from '@/components/forms/date-wheel-field';
import { TextField } from '@/components/forms/text-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { FamIcon } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import { Button, HeaderIconButton } from '@/components/ui/buttons';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { InlineSelect } from '@/components/ui/inline-select';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import {
  FrequentProductsQuickSelect,
  type SuggestionMode,
} from '@/features/inventory/frequent-products-quick-select';
import { consumePendingProductSelection } from '@/features/inventory/pending-product-selection';
import { persistOffProductIfNeeded } from '@/features/inventory/persist-off-product';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import { useAddFridgeItemMutation } from '@/features/inventory/use-inventory-mutations';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import {
  useAddStorageLocationMutation,
  useStorageLocations,
} from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { recordProductUsage } from '@/lib/db/product-usage';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { normalizeUnit, UNIT_OPTIONS } from '@/lib/units';

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

type QuickDateKey = 'd3' | 'd7' | 'd14' | 'm1' | 'none';

const QUICK_DATE_OPTIONS: { value: QuickDateKey; label: string }[] = [
  { value: 'd3', label: '+ 3 Tage' },
  { value: 'd7', label: '+ 7 Tage' },
  { value: 'd14', label: '+ 14 Tage' },
  { value: 'm1', label: '+ 1 Monat' },
];

function quickDateOffset(key: QuickDateKey): string {
  switch (key) {
    case 'd3':
      return formatOffsetDate(3);
    case 'd7':
      return formatOffsetDate(7);
    case 'd14':
      return formatOffsetDate(14);
    case 'm1':
      return formatOffsetMonths(1);
    default:
      return '';
  }
}

/**
 * Quelle des gesuchten Eintrags. "Gerichte" (Rezepte als Vorrats-Eintrag)
 * ist im Dropdown sichtbar, aber bewusst deaktiviert — der Datenbezug
 * (nur Name uebernehmen vs. echte Rezept-Verknuepfung) ist noch offen,
 * s. Migrations-/Redesign-Absprache. Nicht ohne Rueckfrage aktivieren.
 */
type ItemSource = 'food' | 'dish';

/**
 * Artikel-hinzufuegen fuer Vorrat, im selben Bottom-Sheet-Stil wie
 * `add-item-form.tsx` bei der Einkaufsliste: Suche mit Scan-Button,
 * Quelle-/Vorschlagsfilter-Dropdowns, Produktkarte, Menge+Lagerort
 * nebeneinander, "Weitere Angaben" eingeklappt (Einheit + MHD).
 */
export function AddItemScreen() {
  const theme = useTheme();
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

  const [source, setSource] = useState<ItemSource>('food');
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>('frequent');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [showScanner, setShowScanner] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  const activeLocationId = locationId ?? locations?.[0]?.id ?? null;
  const locationOptions = (locations ?? []).map((loc) => ({ value: loc.id, label: loc.name }));
  const selectedQuickDate =
    QUICK_DATE_OPTIONS.find((option) => quickDateOffset(option.value) === expiryDate)?.value ??
    'none';

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
    <ThemedView className="flex-1 bg-background">
      <SafeAreaView className="modal-safe-area" edges={['top', 'left', 'right', 'bottom']}>
        <View className="modal-handle" />
        <View className="modal-header min-h-[54px]">
          <ThemedText type="headingSmall">Artikel hinzufügen</ThemedText>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
            className="modal-close-btn">
            <ThemedText themeColor="textSecondary">✕</ThemedText>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-three pb-four"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ProductSearchDropdown
            label=""
            placeholder={source === 'dish' ? 'Gericht suchen…' : 'z. B. Milch oder Barcode-Name'}
            value={name}
            onChangeText={setName}
            onSelectProduct={handleSelectProduct}
            size="large"
            trailing={
              <HeaderIconButton
                label="Barcode scannen"
                onPress={() => setShowScanner(true)}
                className="ai-scan-btn">
                <FamIcon name="camera" size={18} color={theme.accent} />
              </HeaderIconButton>
            }
          />

          <View className="flex-row gap-two">
            <InlineSelect
              value={source}
              accessibilityLabel="Quelle: Lebensmittel oder Gerichte"
              options={[
                { value: 'food', label: 'Lebensmittel', icon: '🥕' },
                {
                  value: 'dish',
                  label: 'Gerichte',
                  icon: '🍽️',
                  disabled: true,
                  disabledHint: 'bald',
                },
              ]}
              onChange={(next) => {
                if (next === 'food' || next === 'dish') setSource(next);
              }}
            />
            <InlineSelect
              value={suggestionMode}
              accessibilityLabel="Vorschlagsfilter"
              options={[
                { value: 'frequent', label: 'Häufig', icon: '🕘' },
                { value: 'recent', label: 'Zuletzt', icon: '🔁' },
                {
                  value: 'favorites',
                  label: 'Favoriten',
                  icon: '⭐',
                  disabled: true,
                  disabledHint: 'bald',
                },
              ]}
              onChange={(next) => {
                if (next === 'frequent' || next === 'recent') setSuggestionMode(next);
              }}
            />
          </View>

          <FrequentProductsQuickSelect
            feature="fridge"
            userId={userId}
            mode={suggestionMode}
            onSelectProduct={handleSelectProduct}
          />

          {name.trim() ? (
            <View className="edit-fridge-product-card">
              <View className="edit-fridge-product-copy">
                <ThemedText type="smallBold" numberOfLines={1}>
                  {name.trim()}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {selectedProduct?.brand
                    ? `${selectedProduct.brand} · aus Produktdaten`
                    : 'Manueller Eintrag'}
                </ThemedText>
              </View>
              <View className="edit-fridge-product-quantity">
                <ThemedText type="smallBold">
                  {packageSize ? `${packageSize} ${packageSizeUnit}` : `${quantity} ${unit}`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {packageSize ? 'Packungsinhalt' : 'Menge'}
                </ThemedText>
              </View>
            </View>
          ) : null}

          <View className="edit-fridge-controls-row">
            <View className="edit-fridge-control-column">
              <ThemedText type="small" themeColor="textSecondary">
                Menge
              </ThemedText>
              <QuantityStepper
                value={Number.parseInt(quantity, 10) || 1}
                onChange={(value) => setQuantity(String(value))}
                max={999}
                label="Menge"
                size="large"
              />
            </View>
            <View className="edit-fridge-control-column">
              {locationsLoading ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Lädt Lagerorte…
                </ThemedText>
              ) : locationOptions.length > 0 ? (
                <WheelPickerField
                  label="Lagerort"
                  value={activeLocationId ?? ''}
                  options={locationOptions}
                  onChange={setLocationId}
                  size="large"
                />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Kein Lagerort
                </ThemedText>
              )}
            </View>
          </View>

          {!showAddLocation ? (
            <Pressable
              onPress={() => setShowAddLocation(true)}
              accessibilityRole="button"
              className="self-start">
              <ThemedText type="small" themeColor="accent" className="font-bold">
                + Neuer Lagerort
              </ThemedText>
            </Pressable>
          ) : (
            <View className="ai-new-location-box">
              <TextField
                label="Name des Lagerorts"
                placeholder="z.B. Keller, Regalfach, Gefrierfach"
                value={newLocationName}
                onChangeText={setNewLocationName}
              />
              <View className="flex-row gap-two">
                <View className="flex-1">
                  <Button
                    label="Erstellen"
                    onPress={handleAddLocation}
                    loading={addLocationMutation.isPending}
                    disabled={!newLocationName.trim()}
                  />
                </View>
                <View className="flex-1">
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

          <Pressable
            onPress={() => setDetailsOpen((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={`${detailsOpen ? 'Weitere Angaben schließen' : 'Weitere Angaben öffnen'}`}
            accessibilityState={{ expanded: detailsOpen }}
            className="edit-fridge-details-toggle">
            <ThemedText themeColor="accent">{detailsOpen ? '⌄' : '›'}</ThemedText>
            <ThemedText type="small" themeColor="accent">
              Weitere Angaben
            </ThemedText>
          </Pressable>

          {detailsOpen ? (
            <View className="gap-three">
              <WheelPickerField
                label="Einheit"
                value={unit}
                options={UNIT_OPTIONS}
                onChange={setUnit}
                size="large"
              />
              <DateWheelField
                label="Mindesthaltbarkeitsdatum (MHD)"
                value={expiryDate}
                onChange={setExpiryDate}
              />
              <FilterChipBar
                label="Schnellauswahl MHD"
                options={QUICK_DATE_OPTIONS}
                selected={selectedQuickDate}
                onSelect={(value) => setExpiryDate(quickDateOffset(value))}
              />
            </View>
          ) : null}

          <Button
            label="Zum Vorrat hinzufügen"
            onPress={handleSave}
            loading={mutation.isPending}
            disabled={!name.trim()}
            size="large"
          />
        </ScrollView>
      </SafeAreaView>

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onProductFound={handleSelectProduct}
      />
    </ThemedView>
  );
}
