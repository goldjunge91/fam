import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { useProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
import {
  useAddWeightEntryMutation,
  useCurrentGoal,
  useLatestWeightEntry,
  useSetGoalMutation,
} from '@/features/calorie-tracking/api';
import { calculateBmr, type Sex } from '@/features/calorie-tracking/bmr';
import {
  calculateMacroTargets,
  type MacroPreset,
  type MacroRatio,
} from '@/features/calorie-tracking/macros';
import {
  type ActivityLevel,
  calculateTargetCalories,
  calculateTdee,
  type GoalType,
} from '@/features/calorie-tracking/tdee';

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

type PresetSelection = MacroPreset | 'custom';

const SEGMENT_LABELS: Record<PresetSelection, string> = {
  ...PRESET_LABELS,
  custom: 'Benutzerdefiniert',
};

const CUSTOM_RATIO_TOLERANCE = 1;
const MIN_MANUAL_KCAL = 1000;
const MAX_MANUAL_KCAL = 10000;

function parsePercent(input: string): number {
  const value = parseFloat(input.replace(',', '.'));
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Ziel-Setup (#84). Baut direkt auf den reinen Funktionen aus #81/#82/#83 auf
 * — die gesamte Vorschau (Grundumsatz → TDEE → Zielkalorien → Makros) laeuft
 * clientseitig, ohne zusaetzliche Requests, bevor irgendetwas gespeichert wird.
 */
export function GoalSetupScreen() {
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
  const [preset, setPreset] = useState<PresetSelection>('balanced');
  const [customProteinPct, setCustomProteinPct] = useState('30');
  const [customCarbsPct, setCustomCarbsPct] = useState('40');
  const [customFatPct, setCustomFatPct] = useState('30');
  const [weightInput, setWeightInput] = useState('');
  const [manualKcalInput, setManualKcalInput] = useState('');
  const [overrideTouched, setOverrideTouched] = useState(false);

  const customPercentSum =
    parsePercent(customProteinPct) + parsePercent(customCarbsPct) + parsePercent(customFatPct);
  const customRatioValid = Math.abs(customPercentSum - 100) <= CUSTOM_RATIO_TOLERANCE;
  const activeRatio: MacroPreset | MacroRatio | null =
    preset === 'custom'
      ? customRatioValid
        ? {
            protein: parsePercent(customProteinPct) / 100,
            carbs: parsePercent(customCarbsPct) / 100,
            fat: parsePercent(customFatPct) / 100,
          }
        : null
      : preset;

  const sex = (profile?.sex as Sex | null) ?? null;
  const birthDate = profile?.birth_date ?? null;
  const heightCm = profile?.height_cm ?? null;
  const activityLevel: ActivityLevel =
    (profile?.activity_level as ActivityLevel | null) ?? 'moderate';

  const hasProfileFields = sex !== null && birthDate !== null && heightCm !== null;
  const needsWeightInput = hasProfileFields && !latestWeight;
  const weightKg = latestWeight?.weight_kg ?? (weightInput.trim() ? parseFloat(weightInput) : null);

  const rate = parseFloat(rateInput.replace(',', '.')) || 0;

  const targetPreview = useMemo(() => {
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
    return { bmrKcal: bmrResult.bmrKcal, target };
  }, [hasProfileFields, weightKg, sex, birthDate, heightCm, activityLevel, goalType, rate]);

  // Vorbefuellung des Override-Felds mit dem berechneten Wert (#84) — nur
  // solange der Nutzer es nicht selbst angefasst hat, sonst wuerde jede
  // Aenderung an Tempo/Gewicht die manuelle Eingabe stillschweigend ueberschreiben.
  const calculatedKcal = targetPreview?.target.targetKcal;
  useEffect(() => {
    if (overrideTouched || calculatedKcal === undefined) return;
    setManualKcalInput(String(Math.round(calculatedKcal)));
  }, [calculatedKcal, overrideTouched]);

  // Kappung wie in calculateTargetCalories: nie unter den Grundumsatz, nie
  // ausserhalb eines global sicheren Bereichs — der Override darf die
  // physiologische Untergrenze nicht umgehen.
  const manualKcal = parseFloat(manualKcalInput.replace(',', '.'));
  const overrideValid =
    targetPreview !== null &&
    !Number.isNaN(manualKcal) &&
    manualKcal >= targetPreview.bmrKcal &&
    manualKcal >= MIN_MANUAL_KCAL &&
    manualKcal <= MAX_MANUAL_KCAL;
  const effectiveKcal = overrideValid ? manualKcal : (targetPreview?.target.targetKcal ?? null);

  // Getrennt vom kcal-Ziel: eine ungueltige benutzerdefinierte Verteilung oder
  // ein ungueltiger Override soll die kcal-Vorschau nicht verstecken, nur das
  // Speichern blockieren.
  const preview =
    targetPreview && activeRatio && overrideValid
      ? {
          ...targetPreview,
          effectiveKcal: effectiveKcal as number,
          macros: calculateMacroTargets(effectiveKcal as number, activeRatio),
        }
      : null;

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
        dailyKcal: Math.round(preview.effectiveKcal),
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
    targetPreview?.target.capped &&
    (targetPreview.target.cappedReason === 'bmr_floor'
      ? 'Auf deinen Grundumsatz gekappt, damit das Ziel gesund bleibt.'
      : 'Auf ein sicheres Mindestmaß gekappt.');

  const rateWarningText =
    targetPreview?.target.rateWarning === 'below_recommended_range'
      ? 'Dieses Tempo liegt unter der empfohlenen Spanne (0,25–1,0 kg/Woche).'
      : targetPreview?.target.rateWarning === 'above_recommended_range'
        ? 'Dieses Tempo liegt über der empfohlenen Spanne (0,25–1,0 kg/Woche) und ist auf Dauer nicht gesund.'
        : null;

  const overrideErrorText =
    targetPreview && !overrideValid
      ? `Muss zwischen deinem Grundumsatz (${Math.round(targetPreview.bmrKcal)} kcal) und ${MAX_MANUAL_KCAL} kcal liegen.`
      : null;

  return (
    <Screen
      title="Kalorienziel"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
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
              <View className="gap-three">
                <ThemedText type="smallBold">Ziel-Art</ThemedText>
                <View className="gs-segmented-row">
                  {(Object.keys(GOAL_LABELS) as GoalType[]).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setGoalType(type)}
                      className={`gs-segment-btn ${goalType === type ? 'bg-accent' : 'bg-background-element'}`}>
                      <ThemedText themeColor={goalType === type ? 'onAccent' : 'text'}>
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

                <ThemedText type="smallBold" className="mt-one">
                  Makro-Verteilung
                </ThemedText>
                <View className="gs-segmented-row">
                  {(Object.keys(SEGMENT_LABELS) as PresetSelection[]).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setPreset(p)}
                      className={`gs-segment-btn ${preset === p ? 'bg-accent' : 'bg-background-element'}`}>
                      <ThemedText themeColor={preset === p ? 'onAccent' : 'text'}>
                        {SEGMENT_LABELS[p]}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {preset === 'custom' ? (
                  <View className="gap-three">
                    <View className="flex-row gap-two">
                      <View className="flex-1">
                        <TextField
                          label="Eiweiß %"
                          value={customProteinPct}
                          onChangeText={setCustomProteinPct}
                          keyboardType="numeric"
                        />
                      </View>
                      <View className="flex-1">
                        <TextField
                          label="Kohlenhydrate %"
                          value={customCarbsPct}
                          onChangeText={setCustomCarbsPct}
                          keyboardType="numeric"
                        />
                      </View>
                      <View className="flex-1">
                        <TextField
                          label="Fett %"
                          value={customFatPct}
                          onChangeText={setCustomFatPct}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    {!customRatioValid ? (
                      <ThemedText type="small" themeColor="danger">
                        Die Summe muss 100 % ergeben (aktuell {customPercentSum} %).
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}

                {needsWeightInput ? (
                  <TextField
                    label="Aktuelles Gewicht in kg"
                    placeholder="z. B. 72"
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="numeric"
                  />
                ) : null}

                {targetPreview ? (
                  <View className="gs-preview">
                    <TextField
                      label="Ziel-Kalorien (kcal/Tag)"
                      value={manualKcalInput}
                      onChangeText={(text) => {
                        setOverrideTouched(true);
                        setManualKcalInput(text);
                      }}
                      keyboardType="numeric"
                    />
                    {overrideErrorText ? (
                      <ThemedText type="small" themeColor="danger">
                        {overrideErrorText}
                      </ThemedText>
                    ) : null}
                    {preview ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        Eiweiß {preview.macros.proteinG} g · Kohlenhydrate {preview.macros.carbsG} g
                        · Fett {preview.macros.fatG} g
                      </ThemedText>
                    ) : null}
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

                <View className="flex-row gap-two mt-one">
                  <View className="flex-1">
                    <Button
                      label="Ziel speichern"
                      onPress={handleSave}
                      loading={setGoalMutation.isPending || addWeightMutation.isPending}
                      disabled={!preview}
                    />
                  </View>
                  {currentGoal ? (
                    <View className="flex-1">
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
