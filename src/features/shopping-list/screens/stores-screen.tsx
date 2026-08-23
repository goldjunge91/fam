import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useTheme } from '@/hooks/use-theme';
import { STORE_COLOR_PALETTE, STORE_PRESETS } from '../domain-logik/store-presets';
import {
  findStoreByName,
  useAddStoreMutation,
  useDeleteStoreMutation,
  useStores,
  useUpdateStoreMutation,
} from '../hooks/use-stores';

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

    // Marktnamen sind pro Haushalt ohne Beachtung der Grossschreibung eindeutig.
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
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <Card title="Neuen Markt hinzufügen">
        <View className="gap-three mt-two">
          <TextField
            placeholder="z.B. REWE, Aldi, Lidl..."
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
                style={{ backgroundColor: `${preset.color}18`, borderColor: preset.color }}>
                <View className="store-preset-dot" style={{ backgroundColor: preset.color }} />
                <ThemedText
                  type="small"
                  className="font-semibold"
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
                style={{
                  backgroundColor: color,
                  borderColor: newStoreColor === color ? theme.text : 'transparent',
                }}
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
          <ThemedText type="bodyMuted">Keine Märkte vorhanden.</ThemedText>
        ) : (
          <View className="col-gap">
            {stores?.map((store) => {
              const isEditing = editingId === store.id;

              return (
                <View key={store.id} className="store-manage-row">
                  {isEditing ? (
                    <View className="col-gap">
                      <TextField value={editingName} onChangeText={setEditingName} autoFocus />
                      <ThemedText type="smallMuted">Farbe</ThemedText>
                      <View className="row-wrap">
                        {STORE_COLOR_PALETTE.map((color) => (
                          <Pressable
                            key={color}
                            onPress={() => setEditingColor(color)}
                            accessibilityRole="button"
                            accessibilityLabel={`Farbe ${color}`}
                            accessibilityState={{ selected: editingColor === color }}
                            className="store-color-swatch"
                            style={{
                              backgroundColor: color,
                              borderColor: editingColor === color ? theme.text : 'transparent',
                            }}
                          />
                        ))}
                      </View>
                      <View className="input-row mt-one">
                        <View className="flex-1">
                          <Button
                            label="Speichern"
                            onPress={() => handleUpdate(store.id)}
                            loading={updateMutation.isPending}
                            disabled={!editingName.trim()}
                          />
                        </View>
                        <View className="flex-1">
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
                    <View className="row-between">
                      <View className="row-center flex-1">
                        <View
                          className="store-color-dot"
                          style={{ backgroundColor: store.color }}
                        />
                        <ThemedText type="bodyBold" numberOfLines={1} className="flex-1">
                          {store.name}
                        </ThemedText>
                      </View>
                      <View className="row-center">
                        <Pressable
                          onPress={() => {
                            setEditingId(store.id);
                            setEditingName(store.name);
                            setEditingColor(store.color);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${store.name} bearbeiten`}
                          className="btn-modal-close">
                          <ThemedText type="small">✎</ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDelete(store.id, store.name)}
                          accessibilityRole="button"
                          accessibilityLabel={`${store.name} löschen`}
                          className="btn-modal-close">
                          <ThemedText type="small" themeColor="danger">
                            🗑
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
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
