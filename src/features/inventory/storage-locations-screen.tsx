import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useAddStorageLocationMutation,
  useDeleteStorageLocationMutation,
  useStorageLocations,
  useUpdateStorageLocationMutation,
} from '@/features/inventory/use-storage-locations';

export function StorageLocationsScreen() {
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;

  const { data: locations, isLoading } = useStorageLocations(currentHousehold?.id);
  const addMutation = useAddStorageLocationMutation();
  const updateMutation = useUpdateStorageLocationMutation();
  const deleteMutation = useDeleteStorageLocationMutation();

  const [newLocationName, setNewLocationName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  async function handleAdd() {
    if (!currentHousehold || !newLocationName.trim()) return;
    try {
      await addMutation.mutateAsync({
        household_id: currentHousehold.id,
        name: newLocationName.trim(),
      });
      setNewLocationName('');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Erstellen');
    }
  }

  async function handleUpdate(id: string) {
    if (!currentHousehold || !editingName.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id,
        household_id: currentHousehold.id,
        name: editingName.trim(),
      });
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!currentHousehold) return;
    Alert.alert('Lagerort löschen', `Möchtest du den Lagerort "${name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({
              id,
              household_id: currentHousehold.id,
            });
          } catch (err) {
            Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Löschen');
          }
        },
      },
    ]);
  }

  return (
    <Screen
      title="Lagerorte verwalten"
      subtitle={currentHousehold?.name}
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <Card title="Neuen Lagerort hinzufügen">
        <View className="gap-three mt-two">
          <TextField
            placeholder="z.B. Abstellkammer, Keller, Vorratsschrank..."
            value={newLocationName}
            onChangeText={setNewLocationName}
          />
          <Button
            label="Hinzufügen"
            onPress={handleAdd}
            loading={addMutation.isPending}
            disabled={!newLocationName.trim()}
          />
        </View>
      </Card>

      <Card title="Vorhandene Lagerorte">
        {isLoading ? (
          <ThemedText>Lädt...</ThemedText>
        ) : locations?.length === 0 ? (
          <ThemedText themeColor="textSecondary">Keine Lagerorte vorhanden.</ThemedText>
        ) : (
          <View className="gap-two">
            {locations?.map((loc) => {
              const isEditing = editingId === loc.id;

              return (
                <View key={loc.id} className="storage-location-row">
                  {isEditing ? (
                    <View className="gap-two">
                      <TextField value={editingName} onChangeText={setEditingName} autoFocus />
                      <View className="storage-location-btn-row">
                        <View className="flex-1">
                          <Button
                            label="Speichern"
                            onPress={() => handleUpdate(loc.id)}
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
                    <>
                      <ThemedText className="storage-location-name">{loc.name}</ThemedText>
                      <View className="storage-location-btn-row">
                        <Button
                          label="Umbenennen"
                          variant="secondary"
                          onPress={() => {
                            setEditingId(loc.id);
                            setEditingName(loc.name);
                          }}
                        />
                        <Button
                          label="Löschen"
                          variant="danger"
                          onPress={() => handleDelete(loc.id, loc.name)}
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
