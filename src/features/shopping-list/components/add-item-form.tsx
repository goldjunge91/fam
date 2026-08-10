import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { WheelPickerField } from '@/components/wheel-picker-field';
import { Spacing } from '@/constants/theme';
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

  const addItem = useAddShoppingItem();

  useEffect(() => {
    setCategory(guessCategory(name));
  }, [name]);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    const parsedPrice = price.trim() ? Number(price.trim().replace(',', '.')) : null;

    await addItem.mutateAsync({
      household_id: householdId,
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
    onDismiss();
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="z. B. Milch"
        autoFocus
        error={nameError ?? undefined}
      />
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
