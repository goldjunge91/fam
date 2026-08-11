import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { WheelPickerField } from '@/components/wheel-picker-field';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { persistOffProductIfNeeded } from '@/features/inventory/persist-off-product';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { UNIT_OPTIONS } from '@/lib/units';
import { guessCategory } from '../shopping-categories';
import { useAddShoppingItem } from '../use-shopping-list-mutations';
import { StorePickerField } from './store-picker-field';

interface AddItemFormProps {
  householdId: string;
  onDismiss: () => void;
}

export function AddItemForm({ householdId, onDismiss }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [price, setPrice] = useState('');
  // Kategorie wird ausschliesslich automatisch aus dem Namen erkannt
  // (Stichwort-Heuristik), keine manuelle Auswahl in diesem Formular.
  const [category, setCategory] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<OpenFoodFactsProduct | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const addItem = useAddShoppingItem();
  const addProductMutation = useAddProductMutation();
  const { session } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    setCategory(guessCategory(name));
  }, [name]);

  function handleSelectProduct(product: OpenFoodFactsProduct) {
    setName(product.name);
    if (product.quantity) setQuantity(String(product.quantity));
    if (product.unit) setUnit(product.unit);
    setSelectedProduct(product);
  }

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    const parsedPrice = price.trim() ? Number(price.trim().replace(',', '.')) : null;
    const productId = selectedProduct
      ? await persistOffProductIfNeeded(selectedProduct, userId, addProductMutation)
      : null;

    await addItem.mutateAsync({
      household_id: householdId,
      product_id: productId,
      name: trimmed,
      quantity: Number(quantity) || 1,
      unit,
      category,
      store_id: storeId,
      price_estimate: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
    });

    setName('');
    setQuantity('1');
    setPrice('');
    setCategory(null);
    setStoreId(null);
    setSelectedProduct(null);
    onDismiss();
  }

  return (
    <View style={styles.form}>
      <Button label="📷 Barcode scannen" variant="secondary" onPress={() => setShowScanner(true)} />

      <ProductSearchDropdown
        label="Name"
        placeholder="z. B. Milch"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setSelectedProduct(null);
        }}
        onSelectProduct={handleSelectProduct}
      />
      {nameError ? (
        <ThemedText type="small" themeColor="danger">
          {nameError}
        </ThemedText>
      ) : null}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Menge"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="1"
          />
        </View>
        <View style={{ flex: 1 }}>
          <WheelPickerField
            label="Einheit"
            value={unit}
            options={UNIT_OPTIONS}
            onChange={setUnit}
          />
        </View>
      </View>

      <TextField
        label="Preis (geschätzt, optional)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="z. B. 2,49"
      />

      <StorePickerField householdId={householdId} storeId={storeId} onChange={setStoreId} />

      <View style={styles.row}>
        <Button label="Abbrechen" variant="secondary" onPress={onDismiss} />
        <Button label="Hinzufügen" onPress={handleAdd} loading={addItem.isPending} />
      </View>

      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onProductFound={handleSelectProduct}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
