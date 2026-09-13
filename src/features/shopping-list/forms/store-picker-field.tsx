import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, TextField, Txt } from '@/constants/ui';
import { debugError } from '@/lib/debug-log';
import { STORE_COLOR_PALETTE, STORE_PRESETS } from '../domain-logik/store-presets';
import { findStoreByName, useAddStoreMutation, useStores } from '../hooks/use-stores';

interface StorePickerFieldProps {
  householdId: string;
  storeId: string | null;
  onChange: (storeId: string | null) => void;
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  storeChip: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xs + theme.space.xs / 2,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth.base,
  },
  selectedChip: {
    borderColor: theme.accent,
    backgroundColor: withAlpha(theme.accent, 0.1),
  },
  unselectedChip: {
    borderColor: theme.border,
    backgroundColor: 'transparent',
  },
  addBox: {
    gap: theme.space.lg,
    padding: theme.space.lg,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    marginTop: theme.space.sm,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xs + theme.space.xs / 2,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth.base,
  },
  presetDot: {
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.sm / 3,
  },
  colorSwatch: {
    width: theme.space.xxl + theme.space.xs,
    height: theme.space.xxl + theme.space.xs,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.strong,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  addNew: {
    minHeight: 44,
    justifyContent: 'center',
  },
}));

export function StorePickerField({ householdId, storeId, onChange }: StorePickerFieldProps) {
  const { t } = useTranslation();
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
          t('shoppingList.storePickerField.alreadyExistsTitle'),
          t('shoppingList.storePickerField.alreadyExistsDifferentColorBody', {
            store: existing.name,
          }),
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
      debugError('Fehler beim Erstellen des Markts:', err);
    }
  }

  return (
    <View>
      <View style={styles.header}>
        <Txt variant="body" weight="700">
          {t('shoppingList.storePickerField.label')}
        </Txt>
        {!showAddStore && (
          <Press
            onPress={() => setShowAddStore(true)}
            accessibilityRole="button"
            accessibilityLabel={t('shoppingList.storePickerField.addNewAccessibility')}
            style={styles.addNew}>
            <Txt variant="body" tone="primary">
              {t('shoppingList.storePickerField.addNew')}
            </Txt>
          </Press>
        )}
      </View>

      <View style={styles.chipRow}>
        <Press
          onPress={() => onChange(null)}
          accessibilityRole="radio"
          accessibilityState={{ selected: storeId === null }}
          haptic="selection"
          style={[
            styles.storeChip,
            storeId === null ? styles.selectedChip : styles.unselectedChip,
          ]}>
          <Txt variant="body" tone="primary">
            {t('shoppingList.storePickerField.unassigned')}
          </Txt>
        </Press>
        {stores.map((store) => {
          const isActive = storeId === store.id;
          return (
            <Press
              key={store.id}
              onPress={() => onChange(store.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              haptic="selection"
              // Dynamische Markt-Farbe aus der Datenbank
              style={[
                styles.storeChip,
                isActive
                  ? { borderColor: store.color, backgroundColor: `${store.color}22` }
                  : styles.unselectedChip,
              ]}>
              <Txt
                variant="body"
                tone={isActive ? undefined : 'secondary'}
                // Dynamische Markt-Farbe
                style={isActive ? { color: store.color } : undefined}>
                {store.name}
              </Txt>
            </Press>
          );
        })}
      </View>

      {showAddStore && (
        <View style={styles.addBox}>
          <TextField
            label={t('shoppingList.storePickerField.nameLabel')}
            placeholder={t('shoppingList.storePickerField.namePlaceholder')}
            value={newStoreName}
            onChangeText={setNewStoreName}
          />
          <Txt variant="body" tone="secondary">
            {t('shoppingList.stores.addStore.suggestions')}
          </Txt>
          <View style={styles.chipRow}>
            {STORE_PRESETS.map((preset) => (
              <Press
                key={preset.name}
                onPress={() => setNewStoreName(preset.name)}
                accessibilityRole="button"
                haptic="selection"
                // Dynamische Preset-Farbe
                style={[
                  styles.presetChip,
                  { backgroundColor: `${preset.color}18`, borderColor: preset.color },
                ]}>
                {/* Dynamische Preset-Farbe */}
                <View style={[styles.presetDot, { backgroundColor: preset.color }]} />
                <Txt
                  variant="body"
                  weight="600"
                  // Dynamische Preset-Farbe
                  style={{ color: preset.color }}>
                  {preset.name}
                </Txt>
              </Press>
            ))}
          </View>

          <Txt variant="body" tone="secondary">
            {t('shoppingList.stores.addStore.color')}
          </Txt>
          <View style={styles.chipRow}>
            {STORE_COLOR_PALETTE.map((color) => (
              <Press
                key={color}
                onPress={() => setNewStoreColor(color)}
                accessibilityRole="button"
                accessibilityLabel={t('shoppingList.stores.addStore.colorAccessibility', {
                  color,
                })}
                accessibilityState={{ selected: newStoreColor === color }}
                haptic="selection"
                // Dynamische Palettenfarbe & Auswahlrand
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
          <View style={styles.inputRow}>
            <Button
              title={t('shoppingList.storePickerField.create')}
              onPress={handleAddStore}
              loading={addStoreMutation.isPending}
              disabled={!newStoreName.trim()}
            />
            <Button
              title={t('shoppingList.storePickerField.cancel')}
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
