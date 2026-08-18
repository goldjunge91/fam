import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { Button } from '@/components/ui/buttons';
import { UNIT_OPTIONS } from '@/lib/units';
import { guessCategory } from '../shopping-categories';
import type { LocalShoppingItem } from '../use-shopping-list';
import { useUpdateShoppingItem } from '../use-shopping-list-mutations';
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

  const updateItem = useUpdateShoppingItem();

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
      category: guessCategory(trimmed),
      store_id: storeId,
      price_estimate: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
    });

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
