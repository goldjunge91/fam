import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { DateWheelField } from '@/components/forms/date-wheel-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { FamIcon } from '@/components/icons/fam-icon';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/buttons';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { type ItemSource, ItemSourceFilterRow } from '@/components/ui/item-source-filter';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Button, Surface, TextField, Txt } from '@/constants/ui';
import { useInterstitialAd } from '@/features/ads';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import {
  FrequentProductsQuickSelect,
  type SuggestionMode,
} from '@/features/inventory/frequent-products-quick-select';
import { consumePendingProductSelection } from '@/features/inventory/pending-product-selection';
import { persistOffProductIfNeeded } from '@/features/inventory/persist-off-product';
import {
  ProductSearchDropdown,
  type ProductSearchDropdownHandle,
} from '@/features/inventory/product-search-dropdown';
import { useAddFridgeItemMutation } from '@/features/inventory/use-inventory-mutations';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import {
  useAddStorageLocationMutation,
  useStorageLocations,
} from '@/features/inventory/use-storage-locations';
import { useProductBarcodeLookup } from '@/features/product-search/hooks/use-product-barcode-lookup';
import type { CatalogProduct } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/client';
import { recordProductUsage } from '@/lib/db/product-usage';
import { debugError } from '@/lib/observability/debug-log';
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

const styles = StyleSheet.create((theme, rt) => ({
  flex: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
    paddingHorizontal: theme.space.xl + theme.space.xs,
  },
  modalHandle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    marginTop: 10,
    borderRadius: 2,
    backgroundColor: theme.border,
  },
  modalHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.lg,
  },
  scrollContent: {
    gap: theme.space.lg,
    paddingBottom: theme.space.xl + theme.space.xs + rt.insets.ime,
  },
  scannerButton: {
    width: 48,
    height: 48,
  },
  productCard: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
  },
  productCopy: {
    flex: 1,
    gap: theme.space.xs / 2,
  },
  productQuantity: {
    alignItems: 'flex-end',
    gap: theme.space.xs / 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.sm,
  },
  controlColumn: {
    flex: 1,
    gap: theme.space.xs,
  },
  selfStart: {
    alignSelf: 'flex-start',
  },
  newLocationBox: {
    gap: theme.space.lg,
    padding: theme.space.lg,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  detailsToggle: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  details: {
    gap: theme.space.lg,
  },
}));

export function AddItemScreen() {
  const { colors } = useTheme();
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;
  const interstitialAd = useInterstitialAd();

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
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const [source, setSource] = useState<ItemSource>('food');
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>('frequent');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [showScanner, setShowScanner] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const productSearchRef = useRef<ProductSearchDropdownHandle>(null);

  const activeLocationId = locationId ?? locations?.[0]?.id ?? null;
  const locationOptions = (locations ?? []).map((loc) => ({ value: loc.id, label: loc.name }));
  const selectedQuickDate =
    QUICK_DATE_OPTIONS.find((option) => quickDateOffset(option.value) === expiryDate)?.value ??
    'none';

  const handleSelectProduct = useCallback((product: CatalogProduct) => {
    // Muss VOR `setName` passieren — sonst haelt der Such-Effekt in
    // `product-search-dropdown.tsx` diesen Namenswechsel fuer neue Eingabe
    // und oeffnet die Trefferliste erneut (#UI-Feedback: "Auswaehlen eines
    // History-Artikels soll die Suchliste nicht ausloesen"). Deckt alle
    // Aufrufer ab, die den Namen von aussen setzen (Häufig/Zuletzt,
    // Barcode-Scan) — bei Auswahl direkt in der Dropdown-Zeile selbst ist der
    // Wert schon (redundant, aber harmlos) markiert.
    productSearchRef.current?.markSelected(product.name);
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
  }, []);

  // Nimmt ein Produkt entgegen, das ueber "Produkt manuell anlegen" (#80) im
  // add-product-Screen erstellt wurde und beim Zurueckkommen hier abgeholt
  // wird — Expo Router kennt keine Rueckgabewerte aus gepushten Routen.
  const barcodeLookup = useProductBarcodeLookup({
    onFound: (product) => {
      handleSelectProduct(product);
      setShowScanner(false);
    },
  });

  const closeScanner = useCallback(() => {
    setShowScanner(false);
    barcodeLookup.reset();
  }, [barcodeLookup.reset]);

  useFocusEffect(
    useCallback(() => {
      const created = consumePendingProductSelection();
      if (created) handleSelectProduct(created);
    }, [handleSelectProduct]),
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
      debugError('Fehler beim Erstellen des Lagerorts:', err);
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
        try {
          const db = await getDatabase();
          await recordProductUsage(db, {
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
          });
          void queryClient.invalidateQueries({ queryKey: ['product_usage'] });
        } catch (err) {
          // Die History ist Zusatzfunktion: Ein erfolgreicher Vorrat-Save
          // darf nicht nachtraeglich als Fehler erscheinen.
          debugError('Fehler beim Protokollieren der Nutzung:', err);
        }
      }

      router.back();
      if (process.env.NODE_ENV === 'test') {
        interstitialAd.show();
      } else {
        setTimeout(() => {
          interstitialAd.show();
        }, 700);
      }
    } catch (err) {
      debugError(err);
    }
  }

  return (
    <Surface tone="page" style={styles.flex}>
      <SafeAreaView style={styles.modalSafeArea} edges={['top', 'left', 'right', 'bottom']}>
        {}
        <Pressable
          onPress={() => {
            productSearchRef.current?.dismiss();
            Keyboard.dismiss();
          }}
          accessible={false}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Txt variant="heading">Artikel hinzufügen</Txt>
            <HeaderIconButton label="Schließen" onPress={() => router.back()} variant="modal-close">
              <Image
                source="sf:xmark"
                contentFit="contain"
                tintColor={colors.textMuted}
                style={{ width: space.md, height: space.md }}
              />
            </HeaderIconButton>
          </View>
        </Pressable>

        {}
        <KeyboardAwareScrollView
          style={styles.flex}
          bottomOffset={24}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Produktsuche mit integriertem Barcode-Scan-Button */}
          <ProductSearchDropdown
            ref={productSearchRef}
            label=""
            placeholder={source === 'dish' ? 'Gericht suchen…' : 'z. B. Milch oder Barcode-Name'}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setSelectedProduct(null);
            }}
            onSelectProduct={handleSelectProduct}
            size="large"
            trailingPlacement="outside"
            trailing={
              <HeaderIconButton
                label="Barcode scannen"
                onPress={() => setShowScanner(true)}
                style={styles.scannerButton}>
                <FamIcon name="camera" size={space.xxl} color={colors.accent} />
              </HeaderIconButton>
            }
          />

          {/* Quell- und Vorschlagsfilter (Lebensmittel/Gerichte, Häufig/Zuletzt) */}
          <ItemSourceFilterRow
            source={source}
            onSourceChange={setSource}
            sourceAccessibilityLabel="Quelle: Lebensmittel oder Gerichte"
            suggestionFilter={suggestionMode}
            onSuggestionFilterChange={setSuggestionMode}
            suggestionAccessibilityLabel="Vorschlagsfilter"
          />

          {/* Schnellauswahl häufig oder zuletzt verwendeter Artikel */}
          <FrequentProductsQuickSelect
            feature="fridge"
            userId={userId}
            mode={suggestionMode}
            onSelectProduct={handleSelectProduct}
          />

          {/* Zusammenfassungskarte des ausgewählten Produkts */}
          {name.trim() ? (
            <View style={styles.productCard}>
              <View style={styles.productCopy}>
                <Txt variant="body" weight="700" numberOfLines={1}>
                  {name.trim()}
                </Txt>
                <Txt variant="body" tone="secondary" numberOfLines={1}>
                  {selectedProduct?.brand ?? 'Manueller Eintrag'}
                </Txt>
              </View>
              <View style={styles.productQuantity}>
                <Txt variant="body" weight="700">
                  {packageSize ? `${packageSize} ${packageSizeUnit}` : `${quantity} ${unit}`}
                </Txt>
                <Txt variant="body" tone="secondary">
                  {packageSize ? 'Packungsinhalt' : 'Menge'}
                </Txt>
              </View>
            </View>
          ) : null}

          {/* Eingabefelder für Menge und Lagerort */}
          <View style={styles.controlsRow}>
            <View style={styles.controlColumn}>
              <Txt variant="body" tone="secondary">
                Menge
              </Txt>
              <QuantityStepper
                value={Number.parseInt(quantity, 10) || 1}
                onChange={(value) => setQuantity(String(value))}
                max={999}
                label="Menge"
                size="large"
              />
            </View>
            <View style={styles.controlColumn}>
              {locationsLoading ? (
                <Txt variant="body" tone="secondary">
                  Lädt Lagerorte…
                </Txt>
              ) : locationOptions.length > 0 ? (
                <WheelPickerField
                  label="Lagerort"
                  value={activeLocationId ?? ''}
                  options={locationOptions}
                  onChange={setLocationId}
                  size="large"
                />
              ) : (
                <Txt variant="body" tone="secondary">
                  Kein Lagerort
                </Txt>
              )}
            </View>
          </View>

          {/* Formularbereich zum Anlegen eines neuen Lagerorts */}
          {!showAddLocation ? (
            <Pressable
              onPress={() => setShowAddLocation(true)}
              accessibilityRole="button"
              style={styles.selfStart}>
              <Txt variant="body" tone="primary" weight="700">
                + Neuer Lagerort
              </Txt>
            </Pressable>
          ) : (
            <View style={styles.newLocationBox}>
              <TextField
                label="Name des Lagerorts"
                placeholder="z.B. Keller, Regalfach, Gefrierfach"
                value={newLocationName}
                onChangeText={setNewLocationName}
              />
              <View style={styles.buttonRow}>
                <View style={styles.flex}>
                  <Button
                    title="Erstellen"
                    onPress={handleAddLocation}
                    loading={addLocationMutation.isPending}
                    disabled={!newLocationName.trim()}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    title="Abbrechen"
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

          {/* Aufklappbereich: Weitere Angaben (Einheit, Mindesthaltbarkeitsdatum) */}
          <Pressable
            onPress={() => setDetailsOpen((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={`${detailsOpen ? 'Weitere Angaben schließen' : 'Weitere Angaben öffnen'}`}
            accessibilityState={{ expanded: detailsOpen }}
            style={styles.detailsToggle}>
            <Txt tone="secondary">{detailsOpen ? '⌄' : '›'}</Txt>
            <Txt variant="body" tone="primary">
              Weitere Angaben
            </Txt>
          </Pressable>

          {detailsOpen ? (
            <View style={styles.details}>
              {/* Einheitenauswahl */}
              <WheelPickerField
                label="Einheit"
                value={unit}
                options={UNIT_OPTIONS}
                onChange={setUnit}
                size="large"
              />
              {/* Datumsauswahl & Schnellbuttons für MHD */}
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

          {/* Haupt-Speicher-Button */}
          <Button
            title="Zum Vorrat hinzufügen"
            onPress={handleSave}
            loading={mutation.isPending}
            disabled={!name.trim()}
            size="lg"
          />
        </KeyboardAwareScrollView>
      </SafeAreaView>

      {/* Barcode-Scanner-Modal */}
      <BarcodeScannerModal
        visible={showScanner}
        onClose={closeScanner}
        onBarcodeDetected={barcodeLookup.lookup}
        looking={barcodeLookup.looking}
        errorMessage={barcodeLookup.errorMessage}
      />
      <KeyboardToolbar />
    </Surface>
  );
}
