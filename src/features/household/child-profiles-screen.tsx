import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { DatePicker } from '@/components/forms/date-picker';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useAddChildProfileMutation,
  useChildProfiles,
  useDeleteChildProfileMutation,
  useUpdateChildProfileMutation,
} from '@/features/household/api';
import { parseChildHeight } from '@/features/household/household-helpers';

export function ChildProfilesScreen() {
  const { session } = useSession();
  const { colors } = useTheme();
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
      {/* Formular zum Anlegen eines neuen Kinder-Profils (ausklappbar) */}
      {showAddForm ? (
        <Card title="Kinder-Profil hinzufügen">
          <View className="gap-three">
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

            <Txt variant="body" weight="700" className="mt-one">
              Geschlecht (optional)
            </Txt>
            <View className="sex-row">
              <Pressable
                onPress={() => setSex(sex === 'male' ? null : 'male')}
                className="child-segment-btn"
                style={{
                  backgroundColor: sex === 'male' ? colors.basil : colors.surface,
                  borderColor: sex === 'male' ? colors.basil : colors.border,
                }}>
                <Txt variant="body" tone={sex === 'male' ? 'onAccent' : 'primary'}>
                  👦 Männlich
                </Txt>
              </Pressable>
              <Pressable
                onPress={() => setSex(sex === 'female' ? null : 'female')}
                className="child-segment-btn"
                style={{
                  backgroundColor: sex === 'female' ? colors.basil : colors.surface,
                  borderColor: sex === 'female' ? colors.basil : colors.border,
                }}>
                <Txt variant="body" tone={sex === 'female' ? 'onAccent' : 'primary'}>
                  👧 Weiblich
                </Txt>
              </Pressable>
            </View>

            <TextField
              label="Körpergröße in cm (optional)"
              placeholder="z. B. 104"
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
            />

            <View className="flex-row gap-two mt-one">
              <View className="flex-1">
                <Button
                  title="Speichern"
                  onPress={handleAdd}
                  loading={addMutation.isPending}
                  disabled={!name.trim()}
                />
              </View>
              <View className="flex-1">
                <Button
                  title="Abbrechen"
                  variant="secondary"
                  onPress={() => setShowAddForm(false)}
                />
              </View>
            </View>
          </View>
        </Card>
      ) : (
        /* Button zum Öffnen des Anlege-Formulars */
        <View className="mb-four">
          <Button title="+ Kinder-Profil anlegen" onPress={() => setShowAddForm(true)} />
        </View>
      )}

      {/* Liste aller erfassten Kinder-Profile mit Bearbeiten & Löschen */}
      <Card title="Erfasste Kinder-Profile">
        {isLoading ? (
          <Txt variant="body">Lädt Kinder-Profile...</Txt>
        ) : children.length === 0 ? (
          <Txt variant="body" tone="secondary">
            Noch keine Kinder-Profile in diesem Haushalt hinterlegt.
          </Txt>
        ) : (
          /* Kein FlashList: die Karte steckt im scrollenden Screen, eine
             virtualisierte Liste im ScrollView wird nicht unterstuetzt (#139).
             Die Profilanzahl ist klein, eine Direktabbildung reicht. */
          children.map((item) => {
            const isEditing = editingId === item.id;
            if (isEditing) {
              return (
                /* Inline-Bearbeitungsformular für ein Kind */
                <View key={item.id} className="child-edit-card">
                  <TextField label="Name des Kindes" value={editName} onChangeText={setEditName} />
                  <DatePicker
                    label="Geburtsdatum"
                    value={editBirthDate}
                    onChangeText={setEditBirthDate}
                  />

                  <Txt variant="body" weight="700" className="mt-one">
                    Geschlecht
                  </Txt>
                  <View className="sex-row">
                    <Pressable
                      onPress={() => setEditSex(editSex === 'male' ? null : 'male')}
                      className="child-segment-btn"
                      style={{
                        backgroundColor: editSex === 'male' ? colors.basil : colors.surface,
                        borderColor: editSex === 'male' ? colors.basil : colors.border,
                      }}>
                      <Txt variant="body" tone={editSex === 'male' ? 'onAccent' : 'primary'}>
                        👦 Männlich
                      </Txt>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditSex(editSex === 'female' ? null : 'female')}
                      className="child-segment-btn"
                      style={{
                        backgroundColor: editSex === 'female' ? colors.basil : colors.surface,
                        borderColor: editSex === 'female' ? colors.basil : colors.border,
                      }}>
                      <Txt variant="body" tone={editSex === 'female' ? 'onAccent' : 'primary'}>
                        👧 Weiblich
                      </Txt>
                    </Pressable>
                  </View>

                  <TextField
                    label="Körpergröße in cm"
                    value={editHeightCm}
                    onChangeText={setEditHeightCm}
                    keyboardType="numeric"
                  />

                  <View className="flex-row gap-two mt-one">
                    <View className="flex-1">
                      <Button
                        title="Übernehmen"
                        onPress={() => handleUpdate(item.id)}
                        loading={updateMutation.isPending}
                        disabled={!editName.trim()}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        title="Abbrechen"
                        variant="secondary"
                        onPress={() => setEditingId(null)}
                      />
                    </View>
                  </View>
                </View>
              );
            }

            return (
              /* Zeile mit Profil-Stammdaten und Aktions-Buttons */
              <View key={item.id} className="child-row">
                <View className="flex-1">
                  <Txt variant="body" weight="700">
                    {item.sex === 'female' ? '👧' : item.sex === 'male' ? '👦' : '👶'}{' '}
                    {item.display_name}
                  </Txt>
                  <Txt variant="body" tone="secondary">
                    {[
                      item.birth_date
                        ? `Geboren: ${new Date(item.birth_date).toLocaleDateString('de-DE')}`
                        : null,
                      item.height_cm ? `${item.height_cm} cm` : null,
                      item.sex === 'male' ? 'männlich' : item.sex === 'female' ? 'weiblich' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Keine Zusatzdaten'}
                  </Txt>
                </View>

                <View className="child-action-buttons">
                  <Button title="Bearbeiten" variant="secondary" onPress={() => startEdit(item)} />
                  <Button
                    title="Löschen"
                    variant="danger"
                    onPress={() => handleDelete(item.id, item.display_name)}
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
