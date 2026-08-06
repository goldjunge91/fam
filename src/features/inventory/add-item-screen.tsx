import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHouseholds } from '@/features/household/api';
import { useAddFridgeItemMutation, useStorageLocations } from '@/features/inventory/api';

export function AddItemScreen() {
  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];

  const { data: locations, isLoading: locationsLoading } = useStorageLocations(
    currentHousehold?.id,
  );
  const mutation = useAddFridgeItemMutation();

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [locationId, setLocationId] = useState<string | null>(null);

  async function handleSave() {
    if (!currentHousehold || !name.trim()) return;

    // TODO: Bessere Picker für Einheit und Lagerort einbauen (derzeit MVP Hardcoded oder einfache Buttons)
    // Wenn locationId nicht explizit gewählt wurde, nimm den ersten verfügbaren oder null
    const chosenLocation = locationId ?? locations?.[0]?.id ?? null;

    try {
      await mutation.mutateAsync({
        household_id: currentHousehold.id,
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit: unit,
        location_id: chosenLocation,
        expiry_date: null, // Fürs Erste optional weggelassen oder später DatePicker hinzufügen
      });
      router.back();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Screen title="Artikel hinzufügen">
      <View style={styles.form}>
        <TextField label="Name" placeholder="z.B. Milch" value={name} onChangeText={setName} />

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

        <ThemedText style={{ marginTop: Spacing.four }}>Lagerort</ThemedText>
        {locationsLoading ? (
          <ThemedText>Lade Lagerorte...</ThemedText>
        ) : (
          <View style={styles.locationGroup}>
            {locations?.map((loc) => (
              <View key={loc.id} style={styles.locationButton}>
                <Button
                  label={loc.name}
                  variant={
                    locationId === loc.id || (!locationId && locations[0].id === loc.id)
                      ? 'primary'
                      : 'secondary'
                  }
                  onPress={() => setLocationId(loc.id)}
                />
              </View>
            ))}
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
  locationGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  locationButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  saveButton: {
    marginTop: Spacing.six,
  },
});
