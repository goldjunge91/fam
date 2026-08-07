import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useAddShoppingItem } from '../use-shopping-list-mutations';

interface AddItemFormProps {
  householdId: string;
  onDismiss: () => void;
}

export function AddItemForm({ householdId, onDismiss }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [nameError, setNameError] = useState<string | null>(null);

  const addItem = useAddShoppingItem();

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    await addItem.mutateAsync({
      household_id: householdId,
      name: trimmed,
      quantity: Number(quantity) || 1,
      unit,
    });

    setName('');
    setQuantity('1');
    onDismiss();
  }

  return (
    <Card title="Artikel hinzufügen">
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
          <TextField
            label="Einheit"
            value={unit}
            onChangeText={setUnit}
            placeholder="piece"
            autoCapitalize="none"
          />
        </View>
      </View>
      <View style={styles.row}>
        <Button label="Abbrechen" variant="secondary" onPress={onDismiss} />
        <Button label="Hinzufügen" onPress={handleAdd} loading={addItem.isPending} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
