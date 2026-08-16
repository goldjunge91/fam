import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { STORE_COLOR_PALETTE, STORE_PRESETS } from '../store-presets';
import { findStoreByName, useAddStoreMutation, useStores } from '../use-stores';

interface StorePickerFieldProps {
  householdId: string;
  storeId: string | null;
  onChange: (storeId: string | null) => void;
}

/**
 * Markt-Auswahl (Chips) + Inline-"+ Neuer Markt"-Erstellung — geteilt
 * zwischen Artikel-hinzufuegen und Artikel-bearbeiten, damit beide Formulare
 * dieselbe Dedup-/Presets-/Farb-Logik verwenden statt sie zweimal zu pflegen.
 */
export function StorePickerField({ householdId, storeId, onChange }: StorePickerFieldProps) {
  const theme = useTheme();
  const { data: stores = [] } = useStores(householdId);
  const addStoreMutation = useAddStoreMutation();

  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreColor, setNewStoreColor] = useState<string>(STORE_COLOR_PALETTE[0]);

  async function handleAddStore() {
    const trimmed = newStoreName.trim();
    if (!trimmed) return;

    // Maerkte existieren pro Haushalt nur einmal, unabhaengig von
    // Gross-/Kleinschreibung — ein Duplikat-Versuch waehlt den vorhandenen.
    const existing = findStoreByName(stores, trimmed);
    if (existing) {
      if (existing.color !== newStoreColor) {
        Alert.alert(
          'Markt existiert bereits',
          `"${existing.name}" gibt es schon in einer anderen Farbe. Der vorhandene Markt wird verwendet.`,
        );
      }
      onChange(existing.id);
      setNewStoreName('');
      setShowAddStore(false);
      return;
    }

    try {
      const created = await addStoreMutation.mutateAsync({
        household_id: householdId,
        name: trimmed,
        color: newStoreColor,
      });
      onChange(created.id);
      setNewStoreName('');
      setShowAddStore(false);
    } catch (err) {
      console.error('Fehler beim Erstellen des Markts:', err);
    }
  }

  return (
    <View>
      <View style={styles.storeHeaderRow}>
        <ThemedText type="smallBold">Markt (optional)</ThemedText>
        {!showAddStore && (
          <Pressable
            onPress={() => setShowAddStore(true)}
            accessibilityRole="button"
            accessibilityLabel="Neuer Markt">
            <ThemedText type="small" themeColor="accent">
              + Neuer Markt
            </ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.storeChips}>
        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: storeId === null }}
          style={[
            styles.storeChip,
            {
              borderColor: storeId === null ? theme.accent : theme.border,
              backgroundColor: storeId === null ? `${theme.accent}18` : 'transparent',
            },
          ]}>
          <ThemedText
            type="small"
            style={{ color: storeId === null ? theme.accent : theme.textSecondary }}>
            Kein Markt
          </ThemedText>
        </Pressable>
        {stores.map((store) => {
          const isActive = storeId === store.id;
          return (
            <Pressable
              key={store.id}
              onPress={() => onChange(store.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              style={[
                styles.storeChip,
                {
                  borderColor: isActive ? store.color : theme.border,
                  backgroundColor: isActive ? `${store.color}22` : 'transparent',
                },
              ]}>
              <ThemedText
                type="small"
                style={{ color: isActive ? store.color : theme.textSecondary }}>
                {store.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {showAddStore && (
        <View style={styles.addStoreBox}>
          <TextField
            label="Name des Markts"
            placeholder="z.B. REWE"
            value={newStoreName}
            onChangeText={setNewStoreName}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Vorschläge
          </ThemedText>
          <View style={styles.presetRow}>
            {STORE_PRESETS.map((preset) => (
              <Pressable
                key={preset.name}
                onPress={() => setNewStoreName(preset.name)}
                accessibilityRole="button"
                style={[
                  styles.presetChip,
                  { backgroundColor: `${preset.color}18`, borderColor: preset.color },
                ]}>
                <View style={[styles.presetDot, { backgroundColor: preset.color }]} />
                <ThemedText type="small" style={{ color: preset.color, fontWeight: '600' }}>
                  {preset.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            Farbe
          </ThemedText>
          <View style={styles.presetRow}>
            {STORE_COLOR_PALETTE.map((color) => (
              <Pressable
                key={color}
                onPress={() => setNewStoreColor(color)}
                accessibilityRole="button"
                accessibilityLabel={`Farbe ${color}`}
                accessibilityState={{ selected: newStoreColor === color }}
                style={[
                  styles.colorSwatch,
                  {
                    backgroundColor: color,
                    borderColor: newStoreColor === color ? theme.text : 'transparent',
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.row}>
            <Button
              label="Erstellen"
              onPress={handleAddStore}
              loading={addStoreMutation.isPending}
              disabled={!newStoreName.trim()}
            />
            <Button
              label="Abbrechen"
              variant="secondary"
              onPress={() => {
                setShowAddStore(false);
                setNewStoreName('');
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  storeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  storeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  storeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.sheet,
    borderWidth: 1.5,
  },
  addStoreBox: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: Spacing.two,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.sheet,
    borderWidth: 1,
  },
  presetDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.xs,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: Radius.card,
    borderWidth: 2,
  },
});
