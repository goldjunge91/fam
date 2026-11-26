import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
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
  const { t } = useTranslation();
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
      Alert.alert(
        t('inventory.storageLocations.error'),
        err instanceof Error ? err.message : t('inventory.storageLocations.createError'),
      );
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
      Alert.alert(
        t('inventory.storageLocations.error'),
        err instanceof Error ? err.message : t('inventory.storageLocations.updateError'),
      );
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!currentHousehold) return;
    Alert.alert(
      t('inventory.storageLocations.deleteTitle'),
      t('inventory.storageLocations.deleteBody', { name }),
      [
        { text: t('inventory.storageLocations.cancel'), style: 'cancel' },
        {
          text: t('inventory.storageLocations.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({
                id,
                household_id: currentHousehold.id,
              });
            } catch (err) {
              Alert.alert(
                t('inventory.storageLocations.error'),
                err instanceof Error ? err.message : t('inventory.storageLocations.deleteError'),
              );
            }
          },
        },
      ],
    );
  }

  return (
    <Screen
      title={t('inventory.storageLocations.title')}
      subtitle={currentHousehold?.name}
      back={{ label: t('inventory.storageLocations.settings'), href: '/settings' }}
      backStyle="icon">
      {/* Formular zum Anlegen eines neuen Lagerorts */}
      <ContentCard title={t('inventory.storageLocations.newTitle')}>
        <View style={styles.addForm}>
          <TextField
            placeholder={t('inventory.storageLocations.placeholder')}
            value={newLocationName}
            onChangeText={setNewLocationName}
          />
          <Button
            title={t('inventory.storageLocations.add')}
            onPress={handleAdd}
            loading={addMutation.isPending}
            disabled={!newLocationName.trim()}
          />
        </View>
      </ContentCard>

      {/* Liste aller vorhandenen Lagerorte mit Umbenennen- & Löschen-Optionen */}
      <ContentCard title={t('inventory.storageLocations.existingTitle')}>
        {isLoading ? (
          <Txt variant="body">{t('inventory.storageLocations.loading')}</Txt>
        ) : !hasLoadedLocations && isError ? (
          <View style={styles.state}>
            <Txt variant="body" tone="danger" accessibilityRole="alert">
              {t('inventory.storageLocations.loadError')}
            </Txt>
            <Button
              title={t('inventory.storageLocations.retry')}
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
                  {t('inventory.storageLocations.updatedError')}
                </Txt>
                <Button
                  title={t('inventory.storageLocations.retry')}
                  variant="secondary"
                  size="sm"
                  onPress={() => void refetch()}
                />
              </View>
            ) : null}
            <Txt variant="body" tone="secondary">
              {t('inventory.storageLocations.empty')}
            </Txt>
          </>
        ) : (
          <>
            {isError ? (
              <View style={styles.state}>
                <Txt variant="body" tone="danger" accessibilityRole="alert">
                  {t('inventory.storageLocations.updatedError')}
                </Txt>
                <Button
                  title={t('inventory.storageLocations.retry')}
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
                              title={t('inventory.storageLocations.save')}
                              onPress={() => handleUpdate(loc.id)}
                              loading={updateMutation.isPending}
                              disabled={!editingName.trim()}
                            />
                          </View>
                          <View style={styles.flex}>
                            <Button
                              title={t('inventory.storageLocations.cancel')}
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
                            title={t('inventory.storageLocations.rename')}
                            variant="secondary"
                            onPress={() => {
                              setEditingId(loc.id);
                              setEditingName(loc.name);
                            }}
                          />
                          <Button
                            title={t('inventory.storageLocations.delete')}
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
      </ContentCard>
    </Screen>
  );
}
