import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useTheme } from '@/hooks/use-theme';
import { STORE_COLOR_PALETTE, STORE_PRESETS } from './store-presets';
import {
  findStoreByName,
  useAddStoreMutation,
  useDeleteStoreMutation,
  useStores,
  useUpdateStoreMutation,
} from './use-stores';

export function StoresScreen() {
  const theme = useTheme();
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;

  const { data: stores, isLoading } = useStores(currentHousehold?.id);
  const addMutation = useAddStoreMutation();
  const updateMutation = useUpdateStoreMutation();
  const deleteMutation = useDeleteStoreMutation();

  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreColor, setNewStoreColor] = useState<string>(STORE_COLOR_PALETTE[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');

  async function handleAdd() {
    if (!currentHousehold || !newStoreName.trim()) return;
    const trimmed = newStoreName.trim();

    // Maerkte existieren pro Haushalt nur einmal, unabhaengig von
    // Gross-/Kleinschreibung.
    const existing = findStoreByName(stores ?? [], trimmed);
    if (existing) {
      Alert.alert('Markt existiert bereits', `"${existing.name}" ist bereits vorhanden.`);
      setNewStoreName('');
      return;
    }

    try {
      await addMutation.mutateAsync({
        household_id: currentHousehold.id,
        name: trimmed,
        color: newStoreColor,
      });
      setNewStoreName('');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Erstellen');
    }
  }

  async function handleUpdate(id: string) {
    if (!currentHousehold || !editingName.trim()) return;
    const trimmed = editingName.trim();

    const existing = findStoreByName(
      (stores ?? []).filter((s) => s.id !== id),
      trimmed,
    );
    if (existing) {
      Alert.alert('Markt existiert bereits', `"${existing.name}" ist bereits vorhanden.`);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id,
        household_id: currentHousehold.id,
        name: trimmed,
        color: editingColor,
      });
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!currentHousehold) return;
    Alert.alert('Markt löschen', `Möchtest du den Markt "${name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id, household_id: currentHousehold.id });
          } catch (err) {
            Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Löschen');
          }
        },
      },
    ]);
  }

  return (
    <Screen
      title="Märkte verwalten"
      subtitle={currentHousehold?.name}
      back={{ label: 'Einstellungen', href: '/settings' }}>
      <Card title="Neuen Markt hinzufügen">
        <View style={styles.addBox}>
          <TextField
            placeholder="z.B. REWE, Aldi, Lidl..."
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
          <Button
            label="Hinzufügen"
            onPress={handleAdd}
            loading={addMutation.isPending}
            disabled={!newStoreName.trim()}
          />
        </View>
      </Card>

      <Card title="Vorhandene Märkte">
        {isLoading ? (
          <ThemedText>Lädt...</ThemedText>
        ) : stores?.length === 0 ? (
          <ThemedText themeColor="textSecondary">Keine Märkte vorhanden.</ThemedText>
        ) : (
          <View style={styles.list}>
            {stores?.map((store) => {
              const isEditing = editingId === store.id;

              return (
                <View key={store.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                  {isEditing ? (
                    <View style={styles.editBox}>
                      <TextField value={editingName} onChangeText={setEditingName} autoFocus />
                      <ThemedText type="small" themeColor="textSecondary">
                        Farbe
                      </ThemedText>
                      <View style={styles.presetRow}>
                        {STORE_COLOR_PALETTE.map((color) => (
                          <Pressable
                            key={color}
                            onPress={() => setEditingColor(color)}
                            accessibilityRole="button"
                            accessibilityLabel={`Farbe ${color}`}
                            accessibilityState={{ selected: editingColor === color }}
                            style={[
                              styles.colorSwatch,
                              {
                                backgroundColor: color,
                                borderColor: editingColor === color ? theme.text : 'transparent',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.buttonRow}>
                        <View style={styles.flex}>
                          <Button
                            label="Speichern"
                            onPress={() => handleUpdate(store.id)}
                            loading={updateMutation.isPending}
                            disabled={!editingName.trim()}
                          />
                        </View>
                        <View style={styles.flex}>
                          <Button
                            label="Abbrechen"
                            variant="secondary"
                            onPress={() => {
                              setEditingId(null);
                              setEditingName('');
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.nameRow}>
                        <View style={[styles.colorDot, { backgroundColor: store.color }]} />
                        <ThemedText style={styles.nameText}>{store.name}</ThemedText>
                      </View>
                      <View style={styles.actionButtons}>
                        <Button
                          label="Bearbeiten"
                          variant="secondary"
                          onPress={() => {
                            setEditingId(store.id);
                            setEditingName(store.name);
                            setEditingColor(store.color);
                          }}
                        />
                        <Button
                          label="Löschen"
                          variant="danger"
                          onPress={() => handleDelete(store.id, store.name)}
                        />
                      </View>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBox: {
    gap: Spacing.three,
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
  list: {
    gap: Spacing.two,
  },
  row: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: Radius.sm,
  },
  nameText: {
    fontWeight: 'bold',
    ...FontSize[16],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  editBox: {
    gap: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  flex: {
    flex: 1,
  },
});
