import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { DatePicker } from '@/components/date-picker';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useAddChildProfileMutation,
  useChildProfiles,
  useDeleteChildProfileMutation,
  useUpdateChildProfileMutation,
} from '@/features/household/api';
import { parseChildHeight } from '@/features/household/household-helpers';
import { useTheme } from '@/hooks/use-theme';

export function ChildProfilesScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { activeHousehold } = useActiveHousehold();
  const currentHousehold = activeHousehold;
  const householdId = currentHousehold?.id ?? '';

  const { data: children = [], isLoading } = useChildProfiles(householdId);
  const addMutation = useAddChildProfileMutation();
  const updateMutation = useUpdateChildProfileMutation();
  const deleteMutation = useDeleteChildProfileMutation();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | null>(null);
  const [heightCm, setHeightCm] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editSex, setEditSex] = useState<'male' | 'female' | null>(null);
  const [editHeightCm, setEditHeightCm] = useState('');

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed || !householdId || !userId) return;

    try {
      await addMutation.mutateAsync({
        householdId,
        displayName: trimmed,
        birthDate: birthDate.trim() || null,
        sex,
        heightCm: parseChildHeight(heightCm),
        managedBy: userId,
      });
      setName('');
      setBirthDate('');
      setSex(null);
      setHeightCm('');
      setShowAddForm(false);
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Erstellen');
    }
  }

  function startEdit(item: (typeof children)[0]) {
    setEditingId(item.id);
    setEditName(item.display_name);
    setEditBirthDate(item.birth_date ?? '');
    setEditSex((item.sex as 'male' | 'female') ?? null);
    setEditHeightCm(item.height_cm ? String(item.height_cm) : '');
  }

  async function handleUpdate(id: string) {
    const trimmed = editName.trim();
    if (!trimmed || !householdId) return;

    try {
      await updateMutation.mutateAsync({
        id,
        householdId,
        displayName: trimmed,
        birthDate: editBirthDate.trim() || null,
        sex: editSex,
        heightCm: parseChildHeight(editHeightCm),
      });
      setEditingId(null);
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Speichern');
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
    <Screen
      title="Kinder-Profile"
      subtitle={currentHousehold?.name}
      back={{ label: 'Mitglieder', href: '/household/members' }}>
      {showAddForm ? (
        <Card title="Kinder-Profil hinzufügen">
          <View style={styles.form}>
            <TextField
              label="Name des Kindes"
              placeholder="z. B. Paul"
              value={name}
              onChangeText={setName}
            />
            <DatePicker
              label="Geburtsdatum (optional)"
              value={birthDate}
              onChangeText={setBirthDate}
            />

            <ThemedText type="smallBold" style={{ marginTop: Spacing.one }}>
              Geschlecht (optional)
            </ThemedText>
            <View style={styles.segmentedRow}>
              <Pressable
                onPress={() => setSex(sex === 'male' ? null : 'male')}
                style={[
                  styles.segmentBtn,
                  { backgroundColor: sex === 'male' ? theme.accent : theme.backgroundElement },
                ]}>
                <ThemedText style={{ color: sex === 'male' ? '#fff' : theme.text }}>
                  👦 Männlich
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setSex(sex === 'female' ? null : 'female')}
                style={[
                  styles.segmentBtn,
                  { backgroundColor: sex === 'female' ? theme.accent : theme.backgroundElement },
                ]}>
                <ThemedText style={{ color: sex === 'female' ? '#fff' : theme.text }}>
                  👧 Weiblich
                </ThemedText>
              </Pressable>
            </View>

            <TextField
              label="Körpergröße in cm (optional)"
              placeholder="z. B. 104"
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
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
            renderItem={({ item }) => {
              const isEditing = editingId === item.id;
              if (isEditing) {
                return (
                  <View style={[styles.editCard, { borderBottomColor: theme.border }]}>
                    <TextField
                      label="Name des Kindes"
                      value={editName}
                      onChangeText={setEditName}
                    />
                    <DatePicker
                      label="Geburtsdatum"
                      value={editBirthDate}
                      onChangeText={setEditBirthDate}
                    />

                    <ThemedText type="smallBold" style={{ marginTop: Spacing.one }}>
                      Geschlecht
                    </ThemedText>
                    <View style={styles.segmentedRow}>
                      <Pressable
                        onPress={() => setEditSex(editSex === 'male' ? null : 'male')}
                        style={[
                          styles.segmentBtn,
                          {
                            backgroundColor:
                              editSex === 'male' ? theme.accent : theme.backgroundElement,
                          },
                        ]}>
                        <ThemedText style={{ color: editSex === 'male' ? '#fff' : theme.text }}>
                          👦 Männlich
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditSex(editSex === 'female' ? null : 'female')}
                        style={[
                          styles.segmentBtn,
                          {
                            backgroundColor:
                              editSex === 'female' ? theme.accent : theme.backgroundElement,
                          },
                        ]}>
                        <ThemedText style={{ color: editSex === 'female' ? '#fff' : theme.text }}>
                          👧 Weiblich
                        </ThemedText>
                      </Pressable>
                    </View>

                    <TextField
                      label="Körpergröße in cm"
                      value={editHeightCm}
                      onChangeText={setEditHeightCm}
                      keyboardType="numeric"
                    />

                    <View style={styles.buttonRow}>
                      <View style={styles.flex}>
                        <Button
                          label="Übernehmen"
                          onPress={() => handleUpdate(item.id)}
                          loading={updateMutation.isPending}
                          disabled={!editName.trim()}
                        />
                      </View>
                      <View style={styles.flex}>
                        <Button
                          label="Abbrechen"
                          variant="secondary"
                          onPress={() => setEditingId(null)}
                        />
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View style={[styles.childRow, { borderBottomColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: 'bold', ...FontSize[16] }}>
                      {item.sex === 'female' ? '👧' : item.sex === 'male' ? '👦' : '👶'}{' '}
                      {item.display_name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {[
                        item.birth_date
                          ? `Geboren: ${new Date(item.birth_date).toLocaleDateString('de-DE')}`
                          : null,
                        item.height_cm ? `${item.height_cm} cm` : null,
                        item.sex === 'male'
                          ? 'männlich'
                          : item.sex === 'female'
                            ? 'weiblich'
                            : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Keine Zusatzdaten'}
                    </ThemedText>
                  </View>

                  <View style={styles.actionButtons}>
                    <Button
                      label="Bearbeiten"
                      variant="secondary"
                      onPress={() => startEdit(item)}
                    />
                    <Button
                      label="Löschen"
                      variant="danger"
                      onPress={() => handleDelete(item.id, item.display_name)}
                    />
                  </View>
                </View>
              );
            }}
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
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  editCard: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
});
