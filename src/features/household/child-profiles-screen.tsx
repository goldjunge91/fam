import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { DatePicker } from '@/components/forms/date-picker';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, Press, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useAddChildProfileMutation,
  useChildProfiles,
  useDeleteChildProfileMutation,
  useUpdateChildProfileMutation,
} from '@/features/household/api';
import { parseChildHeight } from '@/features/household/household-helpers';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
  sectionLabel: {
    marginTop: theme.space.xs,
  },
  sexRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  sexButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: theme.space.md,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sexButtonSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  sexButtonIdle: {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.xs,
  },
  flex: {
    flex: 1,
  },
  addButtonContainer: {
    marginBottom: theme.space.xxl,
  },
  childEditCard: {
    gap: theme.space.lg,
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  childActionButtons: {
    flexDirection: 'row',
    gap: theme.space.xs,
  },
}));

export function ChildProfilesScreen() {
  const { i18n, t } = useTranslation();
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
      Alert.alert(
        t('common.errors.generic'),
        err instanceof Error ? err.message : t('household.children.errorCreate'),
      );
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
      Alert.alert(
        t('common.errors.generic'),
        err instanceof Error ? err.message : t('household.children.errorSave'),
      );
    }
  }

  async function handleDelete(id: string, childName: string) {
    Alert.alert(
      t('household.children.deleteTitle'),
      t('household.children.deleteConfirm', { name: childName }),
      [
        { text: t('household.children.cancel'), style: 'cancel' },
        {
          text: t('household.children.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id, householdId });
            } catch (err) {
              Alert.alert(
                t('common.errors.generic'),
                err instanceof Error ? err.message : t('household.children.errorDelete'),
              );
            }
          },
        },
      ],
    );
  }

  return (
    <Screen
      title={t('household.children.title')}
      subtitle={currentHousehold?.name}
      back={{ label: t('household.children.back'), href: '/household/members' }}>
      {/* Formular zum Anlegen eines neuen Kinder-Profils (ausklappbar) */}
      {showAddForm ? (
        <ContentCard title={t('household.children.addTitle')}>
          <View style={styles.form}>
            <TextField
              label={t('household.children.nameLabel')}
              placeholder={t('household.children.namePlaceholder')}
              value={name}
              onChangeText={setName}
            />
            <DatePicker
              label={t('household.children.birthDateOptional')}
              value={birthDate}
              onChangeText={setBirthDate}
            />

            <Txt variant="body" weight="700" style={styles.sectionLabel}>
              {t('household.children.sexOptional')}
            </Txt>
            <View
              style={styles.sexRow}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('household.children.sexOptional')}>
              <Press
                onPress={() => setSex(sex === 'male' ? null : 'male')}
                containerStyle={styles.flex}
                accessibilityRole="radio"
                accessibilityLabel={t('household.children.male')}
                accessibilityState={{ selected: sex === 'male' }}
                haptic="selection"
                style={[
                  styles.sexButton,
                  sex === 'male' ? styles.sexButtonSelected : styles.sexButtonIdle,
                ]}>
                <Txt variant="body" tone={sex === 'male' ? 'onAccent' : 'primary'}>
                  👦 {t('household.children.male')}
                </Txt>
              </Press>
              <Press
                onPress={() => setSex(sex === 'female' ? null : 'female')}
                containerStyle={styles.flex}
                accessibilityRole="radio"
                accessibilityLabel={t('household.children.female')}
                accessibilityState={{ selected: sex === 'female' }}
                haptic="selection"
                style={[
                  styles.sexButton,
                  sex === 'female' ? styles.sexButtonSelected : styles.sexButtonIdle,
                ]}>
                <Txt variant="body" tone={sex === 'female' ? 'onAccent' : 'primary'}>
                  👧 {t('household.children.female')}
                </Txt>
              </Press>
            </View>

            <TextField
              label={t('household.children.heightOptional')}
              placeholder={t('household.children.heightPlaceholder')}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
            />

            <View style={styles.actionRow}>
              <View style={styles.flex}>
                <Button
                  title={t('household.children.save')}
                  onPress={handleAdd}
                  loading={addMutation.isPending}
                  disabled={!name.trim()}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  title={t('household.children.cancel')}
                  variant="secondary"
                  onPress={() => setShowAddForm(false)}
                />
              </View>
            </View>
          </View>
        </ContentCard>
      ) : (
        /* Button zum Öffnen des Anlege-Formulars */
        <View style={styles.addButtonContainer}>
          <Button title={t('household.children.addButton')} onPress={() => setShowAddForm(true)} />
        </View>
      )}

      {/* Liste aller erfassten Kinder-Profile mit Bearbeiten & Löschen */}
      <ContentCard title={t('household.children.listTitle')}>
        {isLoading ? (
          <Txt variant="body">{t('household.children.loading')}</Txt>
        ) : children.length === 0 ? (
          <Txt variant="body" tone="secondary">
            {t('household.children.empty')}
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
                <View key={item.id} style={styles.childEditCard}>
                  <TextField
                    label={t('household.children.nameLabel')}
                    value={editName}
                    onChangeText={setEditName}
                  />
                  <DatePicker
                    label={t('household.children.birthDate')}
                    value={editBirthDate}
                    onChangeText={setEditBirthDate}
                  />

                  <Txt variant="body" weight="700" style={styles.sectionLabel}>
                    {t('household.children.sex')}
                  </Txt>
                  <View
                    style={styles.sexRow}
                    accessibilityRole="radiogroup"
                    accessibilityLabel={t('household.children.sex')}>
                    <Press
                      onPress={() => setEditSex(editSex === 'male' ? null : 'male')}
                      containerStyle={styles.flex}
                      accessibilityRole="radio"
                      accessibilityLabel={t('household.children.male')}
                      accessibilityState={{ selected: editSex === 'male' }}
                      haptic="selection"
                      style={[
                        styles.sexButton,
                        editSex === 'male' ? styles.sexButtonSelected : styles.sexButtonIdle,
                      ]}>
                      <Txt variant="body" tone={editSex === 'male' ? 'onAccent' : 'primary'}>
                        👦 {t('household.children.male')}
                      </Txt>
                    </Press>
                    <Press
                      onPress={() => setEditSex(editSex === 'female' ? null : 'female')}
                      containerStyle={styles.flex}
                      accessibilityRole="radio"
                      accessibilityLabel={t('household.children.female')}
                      accessibilityState={{ selected: editSex === 'female' }}
                      haptic="selection"
                      style={[
                        styles.sexButton,
                        editSex === 'female' ? styles.sexButtonSelected : styles.sexButtonIdle,
                      ]}>
                      <Txt variant="body" tone={editSex === 'female' ? 'onAccent' : 'primary'}>
                        👧 {t('household.children.female')}
                      </Txt>
                    </Press>
                  </View>

                  <TextField
                    label={t('household.children.height')}
                    value={editHeightCm}
                    onChangeText={setEditHeightCm}
                    keyboardType="numeric"
                  />

                  <View style={styles.actionRow}>
                    <View style={styles.flex}>
                      <Button
                        title={t('household.children.apply')}
                        onPress={() => handleUpdate(item.id)}
                        loading={updateMutation.isPending}
                        disabled={!editName.trim()}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        title={t('household.children.cancel')}
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
              <View key={item.id} style={styles.childRow}>
                <View style={styles.flex}>
                  <Txt variant="body" weight="700">
                    {item.sex === 'female' ? '👧' : item.sex === 'male' ? '👦' : '👶'}{' '}
                    {item.display_name}
                  </Txt>
                  <Txt variant="body" tone="secondary">
                    {[
                      item.birth_date
                        ? t('household.children.born', {
                            date: new Date(item.birth_date).toLocaleDateString(i18n.language),
                          })
                        : null,
                      item.height_cm ? `${item.height_cm} cm` : null,
                      item.sex === 'male'
                        ? t('household.children.maleShort')
                        : item.sex === 'female'
                          ? t('household.children.femaleShort')
                          : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('household.children.none')}
                  </Txt>
                </View>

                <View style={styles.childActionButtons}>
                  <Button
                    title={t('household.children.edit')}
                    variant="secondary"
                    onPress={() => startEdit(item)}
                  />
                  <Button
                    title={t('household.children.delete')}
                    variant="danger"
                    onPress={() => handleDelete(item.id, item.display_name)}
                  />
                </View>
              </View>
            );
          })
        )}
      </ContentCard>
    </Screen>
  );
}
