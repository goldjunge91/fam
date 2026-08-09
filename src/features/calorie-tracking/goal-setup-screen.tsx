import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import {
  useAddWeightEntryMutation,
  useCurrentGoal,
  useLatestWeightEntry,
  useSetGoalMutation,
} from '@/features/calorie-tracking/api';
import { calculateBmr, type Sex } from '@/features/calorie-tracking/bmr';
import { calculateMacroTargets, type MacroPreset } from '@/features/calorie-tracking/macros';
import {
  type ActivityLevel,
  calculateTargetCalories,
  calculateTdee,
  type GoalType,
} from '@/features/calorie-tracking/tdee';
import { useTheme } from '@/hooks/use-theme';

const GOAL_LABELS: Record<GoalType, string> = {
  lose: 'Abnehmen',
  maintain: 'Halten',
  gain: 'Zunehmen',
};

const PRESET_LABELS: Record<MacroPreset, string> = {
  balanced: 'Ausgewogen',
  high_protein: 'Eiweißreich',
  low_carb: 'Low-Carb',
};

/**
 * Ziel-Setup (#84). Baut direkt auf den reinen Funktionen aus #81/#82/#83 auf
 * — die gesamte Vorschau (Grundumsatz → TDEE → Zielkalorien → Makros) laeuft
 * clientseitig, ohne zusaetzliche Requests, bevor irgendetwas gespeichert wird.
 */
export function GoalSetupScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: profile } = useProfile(userId);
  const { data: latestWeight } = useLatestWeightEntry(userId);
  const { data: currentGoal, isLoading: goalLoading } = useCurrentGoal(userId);
  const addWeightMutation = useAddWeightEntryMutation();
  const setGoalMutation = useSetGoalMutation();

  const [showForm, setShowForm] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>('lose');
  const [rateInput, setRateInput] = useState('0.5');
  const [preset, setPreset] = useState<MacroPreset>('balanced');
  const [weightInput, setWeightInput] = useState('');

  const sex = (profile?.sex as Sex | null) ?? null;
  const birthDate = profile?.birth_date ?? null;
  const heightCm = profile?.height_cm ?? null;
  const activityLevel: ActivityLevel =
    (profile?.activity_level as ActivityLevel | null) ?? 'moderate';

  const hasProfileFields = sex !== null && birthDate !== null && heightCm !== null;
  const needsWeightInput = hasProfileFields && !latestWeight;
  const weightKg = latestWeight?.weight_kg ?? (weightInput.trim() ? parseFloat(weightInput) : null);

  const rate = parseFloat(rateInput.replace(',', '.')) || 0;

  const preview = useMemo(() => {
    if (!hasProfileFields || weightKg === null || Number.isNaN(weightKg)) return null;
    const bmrResult = calculateBmr({ sex, birthDate, heightCm, weightKg }, new Date());
    if (!bmrResult.ok) return null;

    const tdeeKcal = calculateTdee(bmrResult.bmrKcal, activityLevel);
    const target = calculateTargetCalories({
      tdeeKcal,
      bmrKcal: bmrResult.bmrKcal,
      sex: sex as Sex,
      goalType,
      rateKgPerWeek: rate,
    });
    const macros = calculateMacroTargets(target.targetKcal, preset);
    return { bmrKcal: bmrResult.bmrKcal, target, macros };
  }, [hasProfileFields, weightKg, sex, birthDate, heightCm, activityLevel, goalType, rate, preset]);

  const formVisible = showForm || (!goalLoading && !currentGoal);

  async function handleSave() {
    if (!userId || !preview) return;
    try {
      if (needsWeightInput && weightInput.trim()) {
        await addWeightMutation.mutateAsync({ userId, weightKg: parseFloat(weightInput) });
      }
      await setGoalMutation.mutateAsync({
        userId,
        goalType,
        rateKgPerWeek: goalType === 'maintain' ? null : rate,
        dailyKcal: Math.round(preview.target.targetKcal),
        proteinG: preview.macros.proteinG,
        carbsG: preview.macros.carbsG,
        fatG: preview.macros.fatG,
      });
      setShowForm(false);
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Speichern des Ziels');
    }
  }

  const cappedText =
    preview?.target.capped &&
    (preview.target.cappedReason === 'bmr_floor'
      ? 'Auf deinen Grundumsatz gekappt, damit das Ziel gesund bleibt.'
      : 'Auf ein sicheres Mindestmaß gekappt.');

  const rateWarningText =
    preview?.target.rateWarning === 'below_recommended_range'
      ? 'Dieses Tempo liegt unter der empfohlenen Spanne (0,25–1,0 kg/Woche).'
      : preview?.target.rateWarning === 'above_recommended_range'
        ? 'Dieses Tempo liegt über der empfohlenen Spanne (0,25–1,0 kg/Woche) und ist auf Dauer nicht gesund.'
        : null;

  return (
    <Screen title="Kalorienziel" back={{ label: 'Einstellungen', href: '/settings' }}>
      {!hasProfileFields ? (
        <Card title="Profil vervollständigen">
          <ThemedText themeColor="textSecondary">
            Für die Berechnung fehlen noch Angaben zu Geschlecht, Geburtsdatum oder Körpergröße im
            Profil.
          </ThemedText>
          <Button label="Zum Profil" onPress={() => router.push('/settings/profile')} />
        </Card>
      ) : (
        <>
          {currentGoal ? (
            <Card title="Aktuelles Ziel">
              <ThemedText type="subtitle">{currentGoal.daily_kcal ?? '–'} kcal / Tag</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {GOAL_LABELS[currentGoal.goal_type as GoalType] ?? currentGoal.goal_type} · seit{' '}
                {new Date(currentGoal.valid_from).toLocaleDateString('de-DE')}
              </ThemedText>
              {!formVisible ? (
                <Button
                  label="Ziel anpassen"
                  variant="secondary"
                  onPress={() => setShowForm(true)}
                />
              ) : null}
            </Card>
          ) : null}

          {formVisible ? (
            <Card title="Neues Ziel">
              <View style={styles.form}>
                <ThemedText type="smallBold">Ziel-Art</ThemedText>
                <View style={styles.segmentedRow}>
                  {(Object.keys(GOAL_LABELS) as GoalType[]).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setGoalType(type)}
                      style={[
                        styles.segmentBtn,
                        {
                          backgroundColor:
                            goalType === type ? theme.accent : theme.backgroundElement,
                        },
                      ]}>
                      <ThemedText style={{ color: goalType === type ? '#fff' : theme.text }}>
                        {GOAL_LABELS[type]}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {goalType !== 'maintain' ? (
                  <TextField
                    label="Tempo (kg pro Woche)"
                    value={rateInput}
                    onChangeText={setRateInput}
                    keyboardType="numeric"
                  />
                ) : null}

                <ThemedText type="smallBold" style={{ marginTop: Spacing.one }}>
                  Makro-Verteilung
                </ThemedText>
                <View style={styles.segmentedRow}>
                  {(Object.keys(PRESET_LABELS) as MacroPreset[]).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setPreset(p)}
                      style={[
                        styles.segmentBtn,
                        { backgroundColor: preset === p ? theme.accent : theme.backgroundElement },
                      ]}>
                      <ThemedText style={{ color: preset === p ? '#fff' : theme.text }}>
                        {PRESET_LABELS[p]}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {needsWeightInput ? (
                  <TextField
                    label="Aktuelles Gewicht in kg"
                    placeholder="z. B. 72"
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="numeric"
                  />
                ) : null}

                {preview ? (
                  <View style={[styles.preview, { borderColor: theme.border }]}>
                    <ThemedText type="subtitle">
                      {Math.round(preview.target.targetKcal)} kcal / Tag
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Eiweiß {preview.macros.proteinG} g · Kohlenhydrate {preview.macros.carbsG} g ·
                      Fett {preview.macros.fatG} g
                    </ThemedText>
                    {cappedText ? (
                      <ThemedText type="small" themeColor="warning">
                        {cappedText}
                      </ThemedText>
                    ) : null}
                    {rateWarningText ? (
                      <ThemedText type="small" themeColor="warning">
                        {rateWarningText}
                      </ThemedText>
                    ) : null}
                  </View>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    Gib dein aktuelles Gewicht ein, um eine Vorschau zu sehen.
                  </ThemedText>
                )}

                <View style={styles.buttonRow}>
                  <View style={styles.flex}>
                    <Button
                      label="Ziel speichern"
                      onPress={handleSave}
                      loading={setGoalMutation.isPending || addWeightMutation.isPending}
                      disabled={!preview}
                    />
                  </View>
                  {currentGoal ? (
                    <View style={styles.flex}>
                      <Button
                        label="Abbrechen"
                        variant="secondary"
                        onPress={() => setShowForm(false)}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
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
