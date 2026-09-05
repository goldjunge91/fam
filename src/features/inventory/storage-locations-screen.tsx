import { useState } from 'react';
import { Alert, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
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
      {/* Formular zum Anlegen eines neuen Lagerorts */}
      <Card title="Neuen Lagerort hinzufügen">
        <View className="gap-three mt-two">
          <TextField
            placeholder="z.B. Abstellkammer, Keller, Vorratsschrank..."
            value={newLocationName}
            onChangeText={setNewLocationName}
          />
          <Button
            title="Hinzufügen"
            onPress={handleAdd}
            loading={addMutation.isPending}
            disabled={!newLocationName.trim()}
          />
        </View>
      </Card>

      {/* Liste aller vorhandenen Lagerorte mit Umbenennen- & Löschen-Optionen */}
      <Card title="Vorhandene Lagerorte">
        {isLoading ? (
          <Txt variant="body">Lädt...</Txt>
        ) : locations?.length === 0 ? (
          <Txt variant="body" tone="secondary">
            Keine Lagerorte vorhanden.
          </Txt>
        ) : (
          <View className="gap-two">
            {locations?.map((loc) => {
              const isEditing = editingId === loc.id;

              return (
                <View key={loc.id} className="storage-location-row">
                  {isEditing ? (
                    /* Inline-Bearbeitung für Lagerort-Namen */
                    <View className="gap-two">
                      <TextField value={editingName} onChangeText={setEditingName} autoFocus />
                      <View className="storage-location-btn-row">
                        <View className="flex-1">
                          <Button
                            title="Speichern"
                            onPress={() => handleUpdate(loc.id)}
                            loading={updateMutation.isPending}
                            disabled={!editingName.trim()}
                          />
                        </View>
                        <View className="flex-1">
                          <Button
                            title="Abbrechen"
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
                    /* Anzeigezeile für Lagerort mit Umbenennen und Löschen */
                    <>
                      <Txt variant="body" weight="700" className="storage-location-name">
                        {loc.name}
                      </Txt>
                      <View className="storage-location-btn-row">
                        <Button
                          title="Umbenennen"
                          variant="secondary"
                          onPress={() => {
                            setEditingId(loc.id);
                            setEditingName(loc.name);
                          }}
                        />
                        <Button
                          title="Löschen"
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
