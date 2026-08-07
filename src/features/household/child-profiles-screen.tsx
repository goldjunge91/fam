import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  useAddChildProfileMutation,
  useChildProfiles,
  useDeleteChildProfileMutation,
  useHouseholds,
} from '@/features/household/api';
import { useTheme } from '@/hooks/use-theme';

export function ChildProfilesScreen() {
  const theme = useTheme();
  const { data: households } = useHouseholds();
  const currentHousehold = households?.[0];
  const householdId = currentHousehold?.id ?? '';

  const { data: children = [], isLoading } = useChildProfiles(householdId);
  const addMutation = useAddChildProfileMutation();
  const deleteMutation = useDeleteChildProfileMutation();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed || !householdId) return;

    try {
      await addMutation.mutateAsync({
        householdId,
        displayName: trimmed,
        birthDate: birthDate.trim() || null,
      });
      setName('');
      setBirthDate('');
      setShowAddForm(false);
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Erstellen');
    }
  }

  async function handleDelete(id: string, childName: string) {
    Alert.alert(
      'Profil löschen',
      `Möchtest du das Kinder-Profil "${childName}" wirklich entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id, householdId });
            } catch (err) {
              Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Löschen');
            }
          },
        },
      ],
    );
  }

  return (
    <Screen title="Kinder-Profile" subtitle={currentHousehold?.name} showBackButton>
      {showAddForm ? (
        <Card title="Kinder-Profil hinzufügen">
          <View style={styles.form}>
            <TextField
              label="Name des Kindes"
              placeholder="z. B. Paul"
              value={name}
              onChangeText={setName}
            />
            <TextField
              label="Geburtsdatum (optional)"
              placeholder="JJJJ-MM-TT (z. B. 2020-05-14)"
              value={birthDate}
              onChangeText={setBirthDate}
            />

            <View style={styles.buttonRow}>
              <View style={styles.flex}>
                <Button
                  label="Speichern"
                  onPress={handleAdd}
                  loading={addMutation.isPending}
                  disabled={!name.trim()}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Abbrechen"
                  variant="secondary"
                  onPress={() => setShowAddForm(false)}
                />
              </View>
            </View>
          </View>
        </Card>
      ) : (
        <View style={{ marginBottom: Spacing.four }}>
          <Button label="+ Kinder-Profil anlegen" onPress={() => setShowAddForm(true)} />
        </View>
      )}

      <Card title="Erfasste Kinder-Profile">
        {isLoading ? (
          <ThemedText>Lädt Kinder-Profile...</ThemedText>
        ) : children.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Noch keine Kinder-Profile in diesem Haushalt hinterlegt.
          </ThemedText>
        ) : (
          <FlatList
            data={children}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={[styles.childRow, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: 'bold', fontSize: 16 }}>
                    👶 {item.display_name}
                  </ThemedText>
                  {item.birth_date ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Geboren: {new Date(item.birth_date).toLocaleDateString('de-DE')}
                    </ThemedText>
                  ) : null}
                </View>
                <Button
                  label="Löschen"
                  variant="danger"
                  onPress={() => handleDelete(item.id, item.display_name)}
                />
              </View>
            )}
          />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
});
