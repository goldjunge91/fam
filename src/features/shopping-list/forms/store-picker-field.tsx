import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { STORE_COLOR_PALETTE, STORE_PRESETS } from '../domain-logik/store-presets';
import { findStoreByName, useAddStoreMutation, useStores } from '../hooks/use-stores';

interface StorePickerFieldProps {
  householdId: string;
  storeId: string | null;
  onChange: (storeId: string | null) => void;
}

export function StorePickerField({ householdId, storeId, onChange }: StorePickerFieldProps) {
  const { colors: theme } = useTheme();
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
        <Txt variant="body" weight="700">
          Markt (optional)
        </Txt>
        {!showAddStore && (
          <Pressable
            onPress={() => setShowAddStore(true)}
            accessibilityRole="button"
            accessibilityLabel="Neuer Markt">
            <Txt variant="body" tone="primary">
              + Neuer Markt
            </Txt>
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
          <Txt variant="body" tone="primary">
            Ohne Markt
          </Txt>
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
              <Txt
                variant="body"
                tone={isActive ? undefined : 'secondary'}
                // Dynamische Markt-Farbe
                style={isActive ? { color: store.color } : undefined}>
                {store.name}
              </Txt>
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
          <Txt variant="body" tone="secondary">
            Vorschläge
          </Txt>
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
                <Txt
                  variant="body"
                  weight="600"
                  // Dynamische Preset-Farbe
                  style={{ color: preset.color }}>
                  {preset.name}
                </Txt>
              </Pressable>
            ))}
          </View>

          <Txt variant="body" tone="secondary">
            Farbe
          </Txt>
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
