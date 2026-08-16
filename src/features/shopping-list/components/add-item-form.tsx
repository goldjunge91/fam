import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FamIcon } from '@/components/fam-icon';
import { QuantityStepper } from '@/components/quantity-stepper';
import { TextField } from '@/components/text-field';
import { ThemedText, Typography } from '@/components/themed-text';
import { Button, HeaderIconButton } from '@/components/ui/buttons';
import { WheelPickerField } from '@/components/wheel-picker-field';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { persistOffProductIfNeeded } from '@/features/inventory/persist-off-product';
import {
  ProductSearchDropdown,
  type ProductSearchDropdownHandle,
} from '@/features/inventory/product-search-dropdown';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { recordProductUsage } from '@/lib/db/product-usage';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { formatAmount, formatPackageHint } from '@/lib/package-size';
import { normalizeUnit, UNIT_OPTIONS } from '@/lib/units';

import { guessCategory } from '../shopping-categories';
import { useAddShoppingItem } from '../use-shopping-list-mutations';
import type {
  ShoppingProductSuggestion,
  ShoppingSuggestionMode,
} from '../use-shopping-product-suggestions';
import { useStores } from '../use-stores';
import { ShoppingProductSuggestions } from './shopping-product-suggestions';

const NO_STORE = '__none__';

interface AddItemFormProps {
  householdId: string;
  initialStoreId?: string | null;
  onDismiss: () => void;
}

export function AddItemForm({ householdId, initialStoreId = null, onDismiss }: AddItemFormProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [purchaseCount, setPurchaseCount] = useState(1);
  const [unit, setUnit] = useState('piece');
  const [packageSizeInput, setPackageSizeInput] = useState('');
  const [packageSizeUnit, setPackageSizeUnit] = useState('g');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(initialStoreId);
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<OpenFoodFactsProduct | null>(null);
  const [suggestionMode, setSuggestionMode] = useState<ShoppingSuggestionMode>('recent');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const productSearchRef = useRef<ProductSearchDropdownHandle>(null);

  const addItem = useAddShoppingItem();
  const addProductMutation = useAddProductMutation();
  const { data: stores = [] } = useStores(householdId);
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    setCategory(guessCategory(name));
  }, [name]);

  const storeOptions = useMemo(
    () => [
      { value: NO_STORE, label: 'Ohne Liste' },
      ...stores.map((store) => ({ value: store.id, label: store.name })),
    ],
    [stores],
  );
  const selectedStore = stores.find((store) => store.id === storeId) ?? null;
  const parsedPackageSize = Number(packageSizeInput.replace(',', '.'));
  const packageSize =
    unit === 'package' && Number.isFinite(parsedPackageSize) && parsedPackageSize > 0
      ? parsedPackageSize
      : null;
  const packageHint = formatPackageHint(packageSize, packageSizeUnit);
  const purchaseAmount = formatAmount(purchaseCount, unit);

  function handleSelectProduct(product: OpenFoodFactsProduct) {
    setName(product.name);
    const productUnit = normalizeUnit(product.unit);
    const hasKnownPackageSize =
      product.quantity != null && ['g', 'kg', 'ml', 'l'].includes(productUnit);
    setUnit(hasKnownPackageSize ? 'package' : productUnit);
    setPackageSizeInput(hasKnownPackageSize ? String(product.quantity) : '');
    setPackageSizeUnit(hasKnownPackageSize ? productUnit : 'g');
    setSelectedProduct(product);
    setNameError(null);
  }

  function handleSelectSuggestion(
    product: OpenFoodFactsProduct,
    suggestion: ShoppingProductSuggestion,
  ) {
    handleSelectProduct(product);
    if (suggestion.last_store_id) setStoreId(suggestion.last_store_id);
  }

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    const normalizedPrice = price.trim().replace('€', '').replace(',', '.').trim();
    const parsedPrice = normalizedPrice ? Number(normalizedPrice) : null;
    const productId = selectedProduct
      ? await persistOffProductIfNeeded(selectedProduct, userId, addProductMutation)
      : null;

    await addItem.mutateAsync({
      household_id: householdId,
      product_id: productId,
      name: trimmed,
      quantity: purchaseCount,
      unit,
      package_size: packageSize,
      package_size_unit: packageSize ? packageSizeUnit : null,
      category,
      store_id: storeId,
      price_estimate: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
    });

    if (userId) {
      void getDatabase()
        .then((db) =>
          recordProductUsage(db, {
            id: Crypto.randomUUID(),
            userId,
            householdId,
            feature: 'shopping_list',
            productId,
            name: trimmed,
            brand: selectedProduct?.brand ?? null,
            barcode: selectedProduct?.barcode ?? null,
            quantity: packageSize ?? purchaseCount,
            unit: packageSize ? packageSizeUnit : unit,
          }),
        )
        .then(() => queryClient.invalidateQueries({ queryKey: ['product_usage'] }))
        .catch((err) => console.error('Fehler beim Protokollieren der Nutzung:', err));
    }

    onDismiss();
  }

  return (
    <View style={styles.form} onTouchStart={() => productSearchRef.current?.dismiss()}>
      <ProductSearchDropdown
        ref={productSearchRef}
        label=""
        placeholder="Artikel suchen"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setSelectedProduct(null);
          setPackageSizeInput('');
        }}
        onSelectProduct={handleSelectProduct}
        size="large"
        trailing={
          <HeaderIconButton
            label="Barcode scannen"
            onPress={() => {
              productSearchRef.current?.dismiss();
              setShowScanner(true);
            }}
            style={[styles.scanButton, { backgroundColor: theme.backgroundSelected }]}>
            <FamIcon name="camera" size={18} color={theme.accent} />
          </HeaderIconButton>
        }
      />

      {nameError ? (
        <ThemedText type="small" themeColor="danger" style={styles.largeSmallText}>
          {nameError}
        </ThemedText>
      ) : null}

      <ShoppingProductSuggestions
        userId={userId}
        householdId={householdId}
        mode={suggestionMode}
        onModeChange={setSuggestionMode}
        selectedName={name}
        onSelect={handleSelectSuggestion}
      />

      {name.trim() ? (
        <View style={[styles.productSummary, { backgroundColor: theme.backgroundSelected }]}>
          <View style={styles.productCopy}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.summaryPrimary}>
              {name.trim()}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              style={styles.summaryMeta}>
              {selectedProduct?.brand
                ? `${selectedProduct.brand} · aus Produktdaten`
                : 'Manueller Eintrag'}
            </ThemedText>
          </View>
          <View style={styles.packageCopy}>
            <ThemedText type="default">{packageHint ?? purchaseAmount}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {packageHint ? 'Packungsinhalt' : 'Menge'}
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.purchaseRow}>
        <View style={styles.quantityField}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
            Einkaufsmenge
          </ThemedText>
          <QuantityStepper
            value={purchaseCount}
            onChange={setPurchaseCount}
            label="Einkaufsmenge"
            size="large"
          />
        </View>
        <View style={styles.storeField}>
          <WheelPickerField
            label="Liste"
            value={storeId ?? NO_STORE}
            options={storeOptions}
            onChange={(value) => setStoreId(value === NO_STORE ? null : value)}
            size="large"
          />
        </View>
      </View>

      <ThemedText type="default" themeColor="textSecondary" style={styles.listHint}>
        Auf der Liste: {purchaseAmount}
        {packageHint ? ` · ${packageHint}` : ''}
        {selectedStore ? ` · ${selectedStore.name} vorgeschlagen` : ' · ohne Liste'}
      </ThemedText>

      <View style={[styles.details, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => setDetailsOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          accessibilityLabel="Weitere Angaben"
          style={({ pressed }) => [styles.detailsSummary, pressed && styles.pressed]}>
          <ThemedText type="small" style={[styles.detailsLabel, { color: theme.accent }]}>
            {detailsOpen ? '▾' : '›'}
          </ThemedText>
          <ThemedText type="small" style={[styles.detailsLabel, { color: theme.accent }]}>
            Weitere Angaben
          </ThemedText>
        </Pressable>

        {detailsOpen ? (
          <View style={styles.detailsFields}>
            <WheelPickerField
              label="Einheit"
              value={unit}
              options={UNIT_OPTIONS}
              onChange={setUnit}
              size="large"
            />
            {unit === 'package' ? (
              <View style={styles.packageSizeRow}>
                <View style={styles.packageSizeValue}>
                  <TextField
                    label="Inhalt je Packung"
                    value={packageSizeInput}
                    onChangeText={setPackageSizeInput}
                    keyboardType="decimal-pad"
                    placeholder="z. B. 500"
                    style={styles.largeInput}
                  />
                </View>
                <View style={styles.packageSizeUnit}>
                  <WheelPickerField
                    label="Einheit"
                    value={packageSizeUnit}
                    options={UNIT_OPTIONS.filter((option) =>
                      ['g', 'kg', 'ml', 'l', 'piece', 'portion'].includes(option.value),
                    )}
                    onChange={setPackageSizeUnit}
                    size="large"
                  />
                </View>
              </View>
            ) : null}
            <TextField
              label="Geschätzter Preis (optional)"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="z. B. 2,49 €"
              size="large"
            />
          </View>
        ) : null}
      </View>

      <Button
        label="Zur Einkaufsliste hinzufügen"
        onPress={handleAdd}
        loading={addItem.isPending}
        disabled={!name.trim()}
        size="large"
      />

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onProductFound={handleSelectProduct}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  largeInput: {
    ...Typography.bodyLarge,
  },
  form: {
    gap: 10,
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.control,
  },
  largeSmallText: {
    ...Typography.body,
  },
  productSummary: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.controlLarge,
    borderCurve: 'continuous',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  productCopy: {
    flex: 1,
    minWidth: 0,
  },
  packageCopy: {
    alignItems: 'flex-end',
  },
  summaryMeta: {
    ...Typography.detail,
  },
  summaryPrimary: {
    ...Typography.body,
  },
  purchaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
  },
  quantityField: {
    flex: 1.15,
    gap: Spacing.one,
  },
  storeField: {
    flex: 1,
  },
  fieldLabel: {
    ...Typography.label,
  },
  listHint: {
    ...Typography.bodyRelaxed,
  },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailsSummary: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  detailsFields: {
    gap: 10,
    paddingBottom: Spacing.one,
  },
  packageSizeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  packageSizeValue: {
    flex: 1.3,
  },
  packageSizeUnit: {
    flex: 1,
  },
  detailsLabel: {
    ...Typography.body,
  },
  pressed: {
    opacity: 0.72,
  },
});
