import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { FamIcon } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { Button, HeaderIconButton } from '@/components/ui/buttons';
import { type ItemSource, ItemSourceFilterRow } from '@/components/ui/item-source-filter';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
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
import { categoryIdForLabel, guessCategory } from '../domain-logik/shopping-categories';
import { useAddShoppingItem } from '../hooks/use-shopping-list-mutations';
import type {
  ShoppingProductSuggestion,
  ShoppingSuggestionMode,
} from '../hooks/use-shopping-product-suggestions';
import { useStores } from '../hooks/use-stores';
import { ShoppingProductSuggestions } from './shopping-product-suggestions';

const NO_STORE = '__none__';

interface AddItemFormProps {
  householdId: string;
  initialStoreId?: string | null;
  onDismiss: () => void;
}

export type AddItemFormHandle = {
  closeSearch: () => void;
};

export const AddItemForm = forwardRef<AddItemFormHandle, AddItemFormProps>(function AddItemForm(
  { householdId, initialStoreId = null, onDismiss },
  ref,
) {
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
  // Die bekannte ID bewahrt bei fehlendem Barcode die Merge-Identitaet des Vorschlags.
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [source, setSource] = useState<ItemSource>('food');
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
  const parsedPackageSize = Number(packageSizeInput.replace(',', '.'));
  const packageSize =
    unit === 'package' && Number.isFinite(parsedPackageSize) && parsedPackageSize > 0
      ? parsedPackageSize
      : null;
  const packageHint = formatPackageHint(packageSize, packageSizeUnit);
  const purchaseAmount = formatAmount(purchaseCount, unit);

  function handleSelectProduct(product: OpenFoodFactsProduct) {
    // Vor `setName` markieren, damit die Suche die Auswahl nicht als neue Eingabe behandelt.
    productSearchRef.current?.markSelected(product.name);
    setName(product.name);
    const productUnit = normalizeUnit(product.unit);
    const hasKnownPackageSize =
      product.quantity != null && ['g', 'kg', 'ml', 'l'].includes(productUnit);
    setUnit(hasKnownPackageSize ? 'package' : productUnit);
    setPackageSizeInput(hasKnownPackageSize ? String(product.quantity) : '');
    setPackageSizeUnit(hasKnownPackageSize ? productUnit : 'g');
    setSelectedProduct(product);
    setSelectedProductId(null);
    setNameError(null);
  }

  function handleSelectSuggestion(
    product: OpenFoodFactsProduct,
    suggestion: ShoppingProductSuggestion,
  ) {
    handleSelectProduct(product);
    setSelectedProductId(suggestion.product_id ?? null);
    if (suggestion.last_store_id) setStoreId(suggestion.last_store_id);
  }

  /** Schließt nur die Tastatur; die Trefferliste bleibt bis zur Auswahl offen. */
  function dismissKeyboard() {
    Keyboard.dismiss();
  }

  /** Beendet Trefferliste und Tastatur nach einer Auswahl. */
  function closeSearch() {
    productSearchRef.current?.dismiss();
    Keyboard.dismiss();
  }

  useImperativeHandle(ref, () => ({ closeSearch }));

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    const normalizedPrice = price.trim().replace('€', '').replace(',', '.').trim();
    const parsedPrice = normalizedPrice ? Number(normalizedPrice) : null;
    const productId =
      selectedProductId ??
      (selectedProduct
        ? await persistOffProductIfNeeded(selectedProduct, userId, addProductMutation)
        : null);

    await addItem.mutateAsync({
      household_id: householdId,
      product_id: productId,
      name: trimmed,
      quantity: purchaseCount,
      unit,
      package_size: packageSize,
      package_size_unit: packageSize ? packageSizeUnit : null,
      category_id: categoryIdForLabel(category),
      category_source: category ? 'name_fallback' : null,
      category_classifier_version: null,
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
    <View className="gap-[10px]">
      <ProductSearchDropdown
        ref={productSearchRef}
        label=""
        placeholder={source === 'dish' ? 'Gericht suchen…' : 'Artikel suchen'}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setSelectedProduct(null);
          setSelectedProductId(null);
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
            className="w-10 h-10 rounded-control bg-background-selected">
            <FamIcon name="camera" size={18} color={theme.accent} />
          </HeaderIconButton>
        }
      />

      {/* Die Suche bleibt ausserhalb, damit ihr Panel nicht mit-dismissed wird.
          `accessible={false}` laesst VoiceOver die Kinder einzeln lesen. */}
      <Pressable className="gap-[10px]" onPress={dismissKeyboard} accessible={false}>
        {nameError ? (
          <ThemedText type="body" themeColor="danger" className="font-medium">
            {nameError}
          </ThemedText>
        ) : null}

        <ItemSourceFilterRow
          source={source}
          onSourceChange={(next) => {
            dismissKeyboard();
            setSource(next);
          }}
          sourceAccessibilityLabel="Quelle: Lebensmittel oder Gerichte"
          suggestionFilter={suggestionMode}
          onSuggestionFilterChange={(next) => {
            dismissKeyboard();
            setSuggestionMode(next);
          }}
          suggestionAccessibilityLabel="Vorschlagsfilter"
        />

        <ShoppingProductSuggestions
          userId={userId}
          householdId={householdId}
          mode={suggestionMode}
          selectedName={name}
          onSelect={(product, suggestion) => {
            closeSearch();
            handleSelectSuggestion(product, suggestion);
          }}
        />

        <View className="flex-row items-end gap-[9px]">
          <View className="flex-[1.15] gap-one">
            <ThemedText type="labelMuted">Einkaufsmenge</ThemedText>
            <QuantityStepper
              value={purchaseCount}
              onChange={(next) => {
                dismissKeyboard();
                setPurchaseCount(next);
              }}
              label="Einkaufsmenge"
              size="large"
            />
          </View>
          <View className="flex-1">
            <WheelPickerField
              label="Liste"
              value={storeId ?? NO_STORE}
              options={storeOptions}
              onChange={(value) => {
                dismissKeyboard();
                setStoreId(value === NO_STORE ? null : value);
              }}
              size="large"
            />
          </View>
        </View>

        <View className="border-t-hairline border-border">
          <Pressable
            onPress={() => {
              dismissKeyboard();
              setDetailsOpen((open) => !open);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            accessibilityLabel="Weitere Angaben"
            className="details-summary">
            <ThemedText type="body" themeColor="accent" className="font-medium">
              {detailsOpen ? '▾' : '›'}
            </ThemedText>
            <ThemedText type="body" themeColor="accent" className="font-medium">
              Weitere Angaben
            </ThemedText>
          </Pressable>

          {detailsOpen ? (
            <View className="gap-[10px] pb-one">
              <WheelPickerField
                label="Einheit"
                value={unit}
                options={UNIT_OPTIONS}
                onChange={(next) => {
                  dismissKeyboard();
                  setUnit(next);
                }}
                size="large"
              />
              {unit === 'package' ? (
                <View className="flex-row items-end gap-two">
                  <View className="flex-[1.3]">
                    <TextField
                      label="Inhalt je Packung"
                      value={packageSizeInput}
                      onChangeText={setPackageSizeInput}
                      keyboardType="decimal-pad"
                      placeholder="z. B. 500"
                    />
                  </View>
                  <View className="flex-1">
                    <WheelPickerField
                      label="Einheit"
                      value={packageSizeUnit}
                      options={UNIT_OPTIONS.filter((option) =>
                        ['g', 'kg', 'ml', 'l', 'piece', 'portion'].includes(option.value),
                      )}
                      onChange={(next) => {
                        dismissKeyboard();
                        setPackageSizeUnit(next);
                      }}
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

        {name.trim() ? (
          <View className="product-summary">
            <View className="flex-1 min-w-0">
              <ThemedText type="bodyBold" numberOfLines={1}>
                {name.trim()}
              </ThemedText>
              <ThemedText
                type="detail"
                themeColor="textSecondary"
                numberOfLines={1}
                className="font-medium">
                {selectedProduct?.brand ?? 'Manueller Eintrag'}
              </ThemedText>
              {selectedProduct?.barcode ? (
                <ThemedText type="captionMuted" numberOfLines={1}>
                  EAN {selectedProduct.barcode}
                </ThemedText>
              ) : null}
            </View>
            <View className="items-end">
              <ThemedText type="default">{packageHint ?? purchaseAmount}</ThemedText>
              <ThemedText type="smallMuted">{packageHint ? 'Packungsinhalt' : 'Menge'}</ThemedText>
            </View>
          </View>
        ) : null}

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
      </Pressable>
    </View>
  );
});
