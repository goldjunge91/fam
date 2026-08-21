import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { useTheme } from '@/hooks/use-theme';
import { STORE_COLOR_PALETTE, STORE_PRESETS } from '../domain-logik/store-presets';
import { findStoreByName, useAddStoreMutation, useStores } from '../hooks/use-stores';

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
      <View className="row-between mt-two">
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

      <View className="row-wrap">
        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: storeId === null }}
          className={`store-chip ${
            storeId === null ? 'border-accent bg-accent/10' : 'border-border bg-transparent'
          }`}>
          <ThemedText type="small" themeColor={storeId === null ? 'accent' : 'textSecondary'}>
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
              className={`store-chip ${isActive ? '' : 'border-border bg-transparent'}`}
              // Dynamische Markt-Farbe aus der Datenbank
              style={
                isActive
                  ? { borderColor: store.color, backgroundColor: `${store.color}22` }
                  : undefined
              }>
              <ThemedText
                type="small"
                themeColor={isActive ? undefined : 'textSecondary'}
                // Dynamische Markt-Farbe
                style={isActive ? { color: store.color } : undefined}>
                {store.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {showAddStore && (
        <View className="store-add-box">
          <TextField
            label="Name des Markts"
            placeholder="z.B. REWE"
            value={newStoreName}
            onChangeText={setNewStoreName}
          />
          <ThemedText type="smallMuted">Vorschläge</ThemedText>
          <View className="row-wrap">
            {STORE_PRESETS.map((preset) => (
              <Pressable
                key={preset.name}
                onPress={() => setNewStoreName(preset.name)}
                accessibilityRole="button"
                className="store-preset-chip"
                // Dynamische Preset-Farbe
                style={{ backgroundColor: `${preset.color}18`, borderColor: preset.color }}>
                {/* Dynamische Preset-Farbe */}
                <View className="store-preset-dot" style={{ backgroundColor: preset.color }} />
                <ThemedText
                  type="small"
                  className="font-semibold"
                  // Dynamische Preset-Farbe
                  style={{ color: preset.color }}>
                  {preset.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="smallMuted">Farbe</ThemedText>
          <View className="row-wrap">
            {STORE_COLOR_PALETTE.map((color) => (
              <Pressable
                key={color}
                onPress={() => setNewStoreColor(color)}
                accessibilityRole="button"
                accessibilityLabel={`Farbe ${color}`}
                accessibilityState={{ selected: newStoreColor === color }}
                className="store-color-swatch"
                // Dynamische Palettenfarbe & Auswahlrand
                style={{
                  backgroundColor: color,
                  borderColor: newStoreColor === color ? theme.text : 'transparent',
                }}
              />
            ))}
          </View>
          <View className="input-row">
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
