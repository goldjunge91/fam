import { useState } from 'react';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button, TextField, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useAddStorageLocationMutation,
  useDeleteStorageLocationMutation,
  useStorageLocations,
  useUpdateStorageLocationMutation,
} from '@/features/inventory/use-storage-locations';

const styles = StyleSheet.create((theme) => ({
  addForm: {
    gap: theme.space.lg,
    marginTop: theme.space.sm,
  },
  locationList: {
    gap: theme.space.sm,
  },
  locationRow: {
    gap: theme.space.sm,
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  editContent: {
    gap: theme.space.sm,
  },
  state: {
    alignItems: 'center',
    gap: theme.space.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.xs,
  },
  flex: {
    flex: 1,
  },
}));

export function StorageLocationsScreen() {
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;

  const {
    data: locations,
    isLoading,
    isError,
    refetch,
  } = useStorageLocations(currentHousehold?.id);
  const displayedLocations = locations ?? [];
  const hasLoadedLocations = locations !== undefined;
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
        <View style={styles.addForm}>
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
        ) : !hasLoadedLocations && isError ? (
          <View style={styles.state}>
            <Txt variant="body" tone="danger" accessibilityRole="alert">
              Lagerorte konnten nicht geladen werden.
            </Txt>
            <Button
              title="Erneut versuchen"
              variant="secondary"
              size="sm"
              onPress={() => void refetch()}
            />
          </View>
        ) : displayedLocations.length === 0 ? (
          <>
            {isError ? (
              <View style={styles.state}>
                <Txt variant="body" tone="danger" accessibilityRole="alert">
                  Lagerorte konnten nicht aktualisiert werden.
                </Txt>
                <Button
                  title="Erneut versuchen"
                  variant="secondary"
                  size="sm"
                  onPress={() => void refetch()}
                />
              </View>
            ) : null}
            <Txt variant="body" tone="secondary">
              Keine Lagerorte vorhanden.
            </Txt>
          </>
        ) : (
          <>
            {isError ? (
              <View style={styles.state}>
                <Txt variant="body" tone="danger" accessibilityRole="alert">
                  Lagerorte konnten nicht aktualisiert werden.
                </Txt>
                <Button
                  title="Erneut versuchen"
                  variant="secondary"
                  size="sm"
                  onPress={() => void refetch()}
                />
              </View>
            ) : null}
            <View style={styles.locationList}>
              {displayedLocations.map((loc) => {
                const isEditing = editingId === loc.id;

                return (
                  <View key={loc.id} style={styles.locationRow}>
                    {isEditing ? (
                      /* Inline-Bearbeitung für Lagerort-Namen */
                      <View style={styles.editContent}>
                        <TextField value={editingName} onChangeText={setEditingName} autoFocus />
                        <View style={styles.buttonRow}>
                          <View style={styles.flex}>
                            <Button
                              title="Speichern"
                              onPress={() => handleUpdate(loc.id)}
                              loading={updateMutation.isPending}
                              disabled={!editingName.trim()}
                            />
                          </View>
                          <View style={styles.flex}>
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
                        <Txt variant="body" weight="700">
                          {loc.name}
                        </Txt>
                        <View style={styles.buttonRow}>
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
          </>
        )}
      </Card>
    </Screen>
  );
}
