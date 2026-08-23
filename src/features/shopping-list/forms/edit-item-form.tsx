import { useRef, useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { Button } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import { UNIT_OPTIONS } from '@/lib/units';
import type { ShoppingCategoryId } from '../classification/shopping-category-id';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import { useUpdateShoppingItem } from '../hooks/use-shopping-list-mutations';
import {
  useResetCategoryPreferenceMutation,
  useSetCategoryPreferenceMutation,
} from '../preferences/hooks';
import { CategoryField } from './category-field';
import type { CategoryFormState } from './category-form-state';
import { StorePickerField } from './store-picker-field';

interface EditItemFormProps {
  item: LocalShoppingItem;
  onDismiss: () => void;
}

/**
 * Bearbeitungsformular fuer einen bestehenden Artikel. Ausgangspunkt war,
 * dass ein Artikel ohne Markt sich gar nicht mehr aendern liess — bewusst
 * als vollstaendiges Formular wie beim Hinzufuegen statt eines reinen
 * Markt-Dialogs, weil hier noch weitere Punkte dazukommen werden.
 */
export function EditItemForm({ item, onDismiss }: EditItemFormProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState(
    item.price_estimate != null ? String(item.price_estimate) : '',
  );
  const [storeId, setStoreId] = useState<string | null>(item.store_id);
  const [nameError, setNameError] = useState<string | null>(null);

  // Abschnitt 10 "Bearbeiten": `category_id`/`category_source` werden aus dem
  // Eintrag initialisiert, nicht erneut ueber den Namen berechnet — anders
  // als im Add-Formular gibt es hier bewusst KEINEN Effekt, der bei einer
  // Namensaenderung neu klassifiziert.
  const [categoryState, setCategoryState] = useState<CategoryFormState>({
    categoryId: item.category_id as ShoppingCategoryId | null,
    source: item.category_source,
    classifierVersion: item.category_classifier_version,
  });
  // Vergleichsbasis fuer "echte Kategorieaenderung" unten — bewusst der
  // Ausgangszustand, nicht der jeweils aktuelle `categoryState`.
  const initialCategory = useRef({
    categoryId: item.category_id,
    source: item.category_source,
  }).current;

  const updateItem = useUpdateShoppingItem();
  const setCategoryPreference = useSetCategoryPreferenceMutation();
  const resetCategoryPreference = useResetCategoryPreferenceMutation();
  const { session } = useSession();
  const userId = session?.user.id;

  function handleSelectCategory(categoryId: ShoppingCategoryId | null) {
    setCategoryState({ categoryId, source: 'user', classifierVersion: null });
  }

  async function handleResetCategory() {
    const trimmed = name.trim();
    const result = await resetCategoryPreference.mutateAsync({
      householdId: item.household_id,
      keyType: item.product_id ? 'product' : 'name',
      keyValue: item.product_id ?? trimmed,
      name: trimmed,
      productId: item.product_id ?? undefined,
    });
    setCategoryState(result);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    const parsedPrice = price.trim() ? Number(price.trim().replace(',', '.')) : null;

    await updateItem.mutateAsync({
      id: item.id,
      household_id: item.household_id,
      name: trimmed,
      quantity: Number(quantity) || 1,
      unit,
      category_id: categoryState.categoryId,
      category_source: categoryState.source,
      category_classifier_version: categoryState.classifierVersion,
      store_id: storeId,
      price_estimate: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
    });

    // Nur eine echte, manuelle Kategorieaenderung aktualisiert die Praeferenz
    // (Abschnitt 10) — verglichen mit dem Ausgangszustand beim Oeffnen des
    // Formulars, nicht bloss "source ist gerade 'user'" (das waere auch bei
    // einem unveraendert uebernommenen frueheren manuellen Pick wahr).
    const categoryGenuinelyChanged =
      categoryState.categoryId !== initialCategory.categoryId ||
      categoryState.source !== initialCategory.source;
    if (categoryGenuinelyChanged && categoryState.source === 'user') {
      await setCategoryPreference.mutateAsync({
        householdId: item.household_id,
        keyType: item.product_id ? 'product' : 'name',
        keyValue: item.product_id ?? trimmed,
        categoryId: categoryState.categoryId,
        createdBy: userId ?? null,
      });
    }

    onDismiss();
  }

  return (
    <View className="stack">
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="z. B. Milch"
        autoFocus
        error={nameError ?? undefined}
      />
      <View className="input-row">
        <View className="flex-1">
          <TextField
            label="Menge"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="1"
          />
        </View>
        <View className="flex-1">
          <WheelPickerField
            label="Einheit"
            value={unit}
            options={UNIT_OPTIONS}
            onChange={setUnit}
          />
        </View>
      </View>

      <CategoryField
        categoryId={categoryState.categoryId}
        source={categoryState.source}
        onSelectCategory={handleSelectCategory}
        onReset={handleResetCategory}
      />

      <TextField
        label="Preis (geschätzt, optional)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="z. B. 2,49"
      />

      <StorePickerField householdId={item.household_id} storeId={storeId} onChange={setStoreId} />

      <View className="input-row">
        <Button label="Abbrechen" variant="secondary" onPress={onDismiss} />
        <Button label="Speichern" onPress={handleSave} loading={updateItem.isPending} />
      </View>
    </View>
  );
}
