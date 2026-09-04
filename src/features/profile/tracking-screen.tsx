import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  type TrackingMethod,
  useCurrentGoal,
  useLatestWeightEntry,
  useUpdateTrackingDayStartTimeMutation,
  useUpdateTrackingMethodMutation,
  useWeightEntries,
} from '@/features/calorie-tracking/api';
import { calculateAgeYears, calculateBmr } from '@/features/calorie-tracking/bmr';
import { type ActivityLevel, calculateTdee } from '@/features/calorie-tracking/tdee';
import { InjectionPlanSection } from '@/features/glp1/components/injection-plan-section';
import { updateProfile, useProfile } from '@/features/profile/api';
import { SettingsGroup } from '@/features/settings/settings-menu';
import { getLogicalDateForTimestamp } from '@/features/tracking/domain/day-boundary';

function formatHourString(hour: number): string {
  const clamped = Math.max(0, Math.min(23, Math.round(hour)));
  return `${String(clamped).padStart(2, '0')}:00`;
}

const TIME_PRESETS: { hour: number; label: string; tag: string }[] = [
  { hour: 0, label: '00:00', tag: 'Standard' },
  { hour: 4, label: '04:00', tag: 'Frühaufsteher' },
  { hour: 6, label: '06:00', tag: 'Frühschicht' },
  { hour: 14, label: '14:00', tag: 'Spätschicht' },
  { hour: 22, label: '22:00', tag: 'Nachtschicht' },
];

const TRACKING_METHODS: { id: TrackingMethod; label: string; icon: string; desc: string }[] = [
  {
    id: 'standard',
    label: 'Klassisch (CICO)',
    icon: '🎯',
    desc: 'Kalorien- & Makronährstoff-Tracking ohne Spezialregeln',
  },
  {
    id: 'glp1',
    label: 'GLP-1 & Medikation',
    icon: '💉',
    desc: 'Injektionsintervalle, Dosierungen & Symptome erfassen',
  },
  {
    id: 'fasting',
    label: 'Intervallfasten',
    icon: '⏱️',
    desc: 'Fastenphasen-Timer & individuelle Essensfenster',
  },
  {
    id: 'low_carb',
    label: 'Low-Carb',
    icon: '🥗',
    desc: 'Netto-Kohlenhydrate & Ballaststoffe fokussieren',
  },
  {
    id: 'keto',
    label: 'Keto (Ketogen)',
    icon: '🥑',
    desc: 'Ketose-Ernährung (<20–50g Carbs) & Keton-Logs',
  },
  {
    id: 'workouts',
    label: 'Kraftsport',
    icon: '🏋️',
    desc: 'Übungen, Sätze, Wiederholungen & Gewichte dokumentieren',
  },
  {
    id: 'cgm',
    label: 'Blutzucker & CGM',
    icon: '🩸',
    desc: 'Glukosemessungen vor & nach den Mahlzeiten loggen',
  },
  {
    id: 'volumetrics',
    label: 'Volumetrics',
    icon: '🥗',
    desc: 'Energiedichte-Ampel & Sättigungs-Scoring nutzen',
  },
];

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Kaum Bewegung',
  light: 'Leicht aktiv',
  moderate: 'Mäßig aktiv',
  active: 'Aktiv',
  very_active: 'Sehr aktiv',
};

function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [inputTime, setInputTime] = useState(value);
  const [inputError, setInputError] = useState<string | null>(null);

  const currentHour = useMemo(() => {
    const parts = value.split(':');
    const h = Number.parseInt(parts[0] || '0', 10);
    return Number.isNaN(h) ? 0 : Math.max(0, Math.min(23, h));
  }, [value]);

  function step(delta: number) {
    if (disabled) return;
    const next = (currentHour + delta + 24) % 24;
    onChange(formatHourString(next));
  }

  function handleOpenModal() {
    if (disabled) return;
    setInputTime(value);
    setInputError(null);
    setModalVisible(true);
  }

  function handleSaveCustomTime() {
    const trimmed = inputTime.trim();
    const match = trimmed.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (!match) {
      setInputError('Bitte gib eine gültige Uhrzeit im Format HH:MM ein (z. B. 06:00 oder 23:00).');
      return;
    }
    const formatted = `${match[1].padStart(2, '0')}:${match[2]}`;
    onChange(formatted);
    setModalVisible(false);
  }

  return (
    <View className="gap-three">
      {/* Große digitale Uhr & Stepper */}
      <View
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="p-four rounded-2xl border flex-row items-center justify-between">
        <Pressable
          onPress={handleOpenModal}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Uhrzeit für Tagesstart manuell anpassen"
          className="flex-1 mr-two">
          <Txt variant="caption" tone="secondary">
            Individueller Tagesstart (Tippen zum Anpassen)
          </Txt>
          <Txt variant="display" className="mt-one">
            {value} Uhr ✏️
          </Txt>
        </Pressable>

        {/* Stepper Buttons (-1h / +1h) */}
        <View className="flex-row gap-two">
          <Pressable
            onPress={() => step(-1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Eine Stunde früher"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="w-12 h-12 rounded-xl border items-center justify-center">
            <Txt variant="body" weight="700">
              -1h
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => step(1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Eine Stunde später"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="w-12 h-12 rounded-xl border items-center justify-center">
            <Txt variant="body" weight="700">
              +1h
            </Txt>
          </Pressable>
        </View>
      </View>

      {/* Schicht-Presets */}
      <View>
        <Txt variant="caption" tone="secondary" className="mb-one">
          Schnellauswahl für Schichtmodelle:
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-two">
          {TIME_PRESETS.map((preset) => {
            const isSelected = value === preset.label;
            return (
              <Pressable
                key={preset.hour}
                onPress={() => onChange(preset.label)}
                disabled={disabled}
                style={{
                  backgroundColor: isSelected ? colors.basil : colors.surface,
                  borderColor: isSelected ? colors.basil : colors.border,
                }}
                className="py-two px-three rounded-xl border mr-two items-center">
                <Txt variant="body" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                  {preset.label}
                </Txt>
                <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                  {preset.tag}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Präzise Erklärung */}
      <Txt variant="caption" tone="secondary">
        {value === '00:00'
          ? 'Standard: Dein Tracking-Tag wechselt um 00:00 Uhr. Das betrifft Mahlzeiten, Injektionen, Symptome und Gewicht. Bestehende Einträge bleiben unverändert.'
          : `Dein Tracking-Tag läuft jeweils 24 Stunden ab ${value} Uhr. Mahlzeiten, Injektionen, Symptome und Gewicht vor ${value} Uhr zählen zum vorherigen Tag. Bestehende Einträge bleiben unverändert.`}
      </Txt>

      {/* Modal für manuelle Zeiteingabe */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View style={{ backgroundColor: colors.bg }} className="p-four rounded-t-3xl gap-four">
            <View className="flex-row justify-between items-center pb-two border-b border-border">
              <Txt variant="title">Tagesstart festlegen</Txt>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                <Txt variant="title" tone="secondary">
                  ×
                </Txt>
              </Pressable>
            </View>

            <View className="gap-three">
              <TextField
                label="Uhrzeit (HH:MM)"
                value={inputTime}
                onChangeText={setInputTime}
                placeholder="z. B. 06:00 oder 23:00"
                error={inputError ?? undefined}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
              <Txt variant="caption" tone="secondary">
                Gib die Uhrzeit ein, zu der dein persönlicher Tracking-Tag beginnen soll.
              </Txt>
            </View>

            <View className="pt-two gap-two">
              <Button label="Uhrzeit übernehmen" onPress={handleSaveCustomTime} />
              <Button
                label="Abbrechen"
                variant="secondary"
                onPress={() => setModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function TrackingScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: currentGoal } = useCurrentGoal(userId);
  const { data: latestWeight } = useLatestWeightEntry(userId);
  const dayStartTime = profile?.tracking_day_start_time ?? '00:00';
  const selectedLogicalDate = getLogicalDateForTimestamp(new Date(), dayStartTime);
  const { data: logicalDayWeightEntries = [] } = useWeightEntries(
    userId,
    null,
    selectedLogicalDate,
    dayStartTime,
  );
  const logicalDayWeight = logicalDayWeightEntries.at(-1);
  const queryClient = useQueryClient();

  const [biometricsModalVisible, setBiometricsModalVisible] = useState(false);
  const [editHeightCm, setEditHeightCm] = useState('');
  const [editSex, setEditSex] = useState<'male' | 'female' | null>(null);
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editActivityLevel, setEditActivityLevel] = useState<ActivityLevel | null>(null);
  const [savingBiometrics, setSavingBiometrics] = useState(false);

  // Synchroner lokaler State für Tracking-Methode und Tagesstart
  const [selectedMethod, setSelectedMethod] = useState<TrackingMethod>('standard');
  const [selectedStartTime, setSelectedStartTime] = useState('00:00');

  useEffect(() => {
    if (profile?.tracking_method) {
      setSelectedMethod(profile.tracking_method as TrackingMethod);
    }
    if (profile?.tracking_day_start_time) {
      setSelectedStartTime(profile.tracking_day_start_time);
    }
  }, [profile?.tracking_method, profile?.tracking_day_start_time]);

  const updateMethodMutation = useUpdateTrackingMethodMutation();
  const updateStartTimeMutation = useUpdateTrackingDayStartTimeMutation();

  function handleSelectMethod(method: TrackingMethod) {
    if (!userId || method === selectedMethod) return;
    setSelectedMethod(method);
    updateMethodMutation.mutate({ userId, method });
  }

  function handleSelectStartTime(time: string) {
    if (!userId || time === selectedStartTime) return;
    setSelectedStartTime(time);
    updateStartTimeMutation.mutate({ userId, time });
  }

  // BMR / TDEE / Alter
  const bmrResult = useMemo(() => {
    if (!profile) return null;
    return calculateBmr(
      {
        sex: (profile.sex as 'male' | 'female') ?? null,
        birthDate: profile.birth_date ?? null,
        heightCm: profile.height_cm ?? null,
        weightKg: latestWeight?.weight_kg ?? null,
      },
      new Date(),
    );
  }, [profile, latestWeight]);

  const bmrKcal = bmrResult?.ok ? Math.round(bmrResult.bmrKcal) : null;
  const tdeeKcal =
    bmrResult?.ok && profile?.activity_level
      ? Math.round(calculateTdee(bmrResult.bmrKcal, profile.activity_level as ActivityLevel))
      : null;

  const ageYears = useMemo(() => {
    if (!profile?.birth_date) return null;
    const parts = profile.birth_date.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return Number.isNaN(d.getTime()) ? null : calculateAgeYears(d, new Date());
  }, [profile?.birth_date]);

  function openBiometricsModal() {
    if (profile) {
      setEditHeightCm(profile.height_cm ? String(profile.height_cm) : '');
      setEditSex((profile.sex as 'male' | 'female') ?? null);
      setEditBirthDate(profile.birth_date ?? '');
      setEditActivityLevel((profile.activity_level as ActivityLevel) ?? null);
    }
    setBiometricsModalVisible(true);
  }

  async function handleSaveBiometrics() {
    if (!userId || savingBiometrics) return;
    setSavingBiometrics(true);

    const heightNum = editHeightCm.trim() ? Number(editHeightCm.replace(',', '.')) : undefined;

    await updateProfile(userId, {
      heightCm: Number.isNaN(heightNum) ? undefined : heightNum,
      sex: editSex ?? undefined,
      birthDate: editBirthDate.trim() || undefined,
      activityLevel: editActivityLevel ?? undefined,
    });

    await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    setSavingBiometrics(false);
    setBiometricsModalVisible(false);
  }

  return (
    <Screen
      title="Mein Tracking"
      back={{ label: 'Mein Profil', href: '/profile' }}
      backStyle="icon">
      <ScrollView contentContainerClassName="screen-scroll" showsVerticalScrollIndicator={false}>
        <SettingsGroup title="Deine Tracking-Methode">
          <View className="p-three gap-two">
            <Txt variant="body" tone="secondary" className="mb-one">
              Wähle deine aktive Methode für das Ernährungstagebuch:
            </Txt>
            <View className="gap-two">
              {TRACKING_METHODS.map((m) => {
                const isSelected = selectedMethod === m.id;
                return (
                  <Fragment key={m.id}>
                    <Pressable
                      onPress={() => handleSelectMethod(m.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      style={{
                        backgroundColor: isSelected ? colors.basil : colors.surface,
                        borderColor: isSelected ? colors.basil : colors.border,
                      }}
                      className="p-three rounded-xl border flex-row items-center justify-between">
                      <View className="flex-row items-center gap-three flex-1 mr-two">
                        <Txt variant="title">{m.icon}</Txt>
                        <View className="flex-1">
                          <Txt
                            variant="body"
                            weight="700"
                            tone={isSelected ? 'onAccent' : 'primary'}>
                            {m.label}
                          </Txt>
                          <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                            {m.desc}
                          </Txt>
                        </View>
                      </View>
                      {isSelected ? (
                        <Txt variant="body" weight="700" tone="onAccent">
                          Aktiv ✓
                        </Txt>
                      ) : null}
                    </Pressable>
                    {m.id === 'glp1' && isSelected ? (
                      <InjectionPlanSection userId={userId} />
                    ) : null}
                  </Fragment>
                );
              })}
            </View>
          </View>
        </SettingsGroup>

        {/* 2. Ernährung & Tagesziele (Kalorienziel & Makros) */}
        <SettingsGroup title="Ernährung & Tagesziele">
          <View className="p-three gap-three">
            {/* Große Tagesziel-Kachel für Kalorien */}
            <View
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="p-four rounded-2xl border items-center">
              <Txt variant="caption" tone="secondary">
                🎯 Kalorien-Tagesziel
              </Txt>
              <Txt variant="display" className="mt-one">
                {currentGoal?.daily_kcal ? `${currentGoal.daily_kcal} kcal` : 'Nicht festgelegt'}
              </Txt>
            </View>

            {/* 3 Makronährstoff-Kacheln (Protein, Carbs, Fett) */}
            <View className="flex-row gap-two">
              <View
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="flex-1 p-three rounded-xl border items-center">
                <Txt variant="caption" tone="secondary">
                  🥩 Protein
                </Txt>
                <Txt variant="body" weight="700" className="mt-one" style={{ fontSize: 16 }}>
                  {currentGoal ? `${currentGoal.protein_g}g` : '–'}
                </Txt>
              </View>

              <View
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="flex-1 p-three rounded-xl border items-center">
                <Txt variant="caption" tone="secondary">
                  🍞 Carbs
                </Txt>
                <Txt variant="body" weight="700" className="mt-one" style={{ fontSize: 16 }}>
                  {currentGoal ? `${currentGoal.carbs_g}g` : '–'}
                </Txt>
              </View>

              <View
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="flex-1 p-three rounded-xl border items-center">
                <Txt variant="caption" tone="secondary">
                  🥑 Fett
                </Txt>
                <Txt variant="body" weight="700" className="mt-one" style={{ fontSize: 16 }}>
                  {currentGoal ? `${currentGoal.fat_g}g` : '–'}
                </Txt>
              </View>
            </View>

            {/* Button zum Bearbeiten der Ziele */}
            <Button
              label="Ziele & Makros bearbeiten"
              variant="secondary"
              onPress={() => router.push('/settings/goals')}
            />
          </View>
        </SettingsGroup>

        <SettingsGroup title="Vitalwerte & Biometrie">
          <View className="p-three gap-three">
            {/* 2x2 Grid für Kern-Messwerte */}
            <View className="flex-row gap-two">
              <View
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="flex-1 p-three rounded-xl border">
                <Txt variant="caption" tone="secondary">
                  📏 Körpergröße
                </Txt>
                <Txt variant="body" weight="700" className="mt-one" style={{ fontSize: 16 }}>
                  {profile?.height_cm ? `${profile.height_cm} cm` : 'Nicht gesetzt'}
                </Txt>
              </View>

              <View
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="flex-1 p-three rounded-xl border">
                <Txt variant="caption" tone="secondary">
                  ⚖️ Aktuelles Gewicht
                </Txt>
                <Txt variant="body" weight="700" className="mt-one" style={{ fontSize: 16 }}>
                  {logicalDayWeight?.weight_kg ? `${logicalDayWeight.weight_kg} kg` : 'Kein Log'}
                </Txt>
              </View>
            </View>

            <View className="flex-row gap-two">
              <View
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="flex-1 p-three rounded-xl border">
                <Txt variant="caption" tone="secondary">
                  🧬 Geschlecht & Alter
                </Txt>
                <Txt variant="body" weight="700" className="mt-one" style={{ fontSize: 14 }}>
                  {profile?.sex === 'male'
                    ? 'Männlich'
                    : profile?.sex === 'female'
                      ? 'Weiblich'
                      : '–'}
                  {ageYears !== null ? ` · ${ageYears} J.` : ''}
                </Txt>
              </View>

              <View
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="flex-1 p-three rounded-xl border">
                <Txt variant="caption" tone="secondary">
                  🏃 Aktivitätslevel
                </Txt>
                <Txt
                  variant="body"
                  weight="700"
                  className="mt-one"
                  style={{ fontSize: 14 }}
                  numberOfLines={1}>
                  {profile?.activity_level
                    ? (ACTIVITY_LABELS[profile.activity_level] ?? profile.activity_level)
                    : 'Nicht gesetzt'}
                </Txt>
              </View>
            </View>

            {/* BMR & TDEE Energie-Banner */}
            <View
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="p-three rounded-xl border flex-row items-center justify-around">
              <View className="items-center">
                <Txt variant="caption" tone="secondary">
                  Grundumsatz (BMR)
                </Txt>
                <Txt variant="body" weight="700" className="mt-one" style={{ fontSize: 16 }}>
                  {bmrKcal ? `${bmrKcal} kcal` : '–'}
                </Txt>
              </View>
              <View style={{ backgroundColor: colors.border }} className="w-px h-8" />
              <View className="items-center">
                <Txt variant="caption" tone="secondary">
                  Gesamtbedarf (TDEE)
                </Txt>
                <Txt variant="body" weight="700" className="mt-one" style={{ fontSize: 16 }}>
                  {tdeeKcal ? `${tdeeKcal} kcal` : '–'}
                </Txt>
              </View>
            </View>

            {/* Button zum Bearbeiten der Biometrie */}
            <Button
              label="Biometrie bearbeiten"
              variant="secondary"
              onPress={openBiometricsModal}
            />
          </View>
        </SettingsGroup>

        {/* 4. Tracking-Rhythmus & Zeitfenster (Tagesstart-Uhrzeit) */}
        <SettingsGroup title="Tracking-Rhythmus & Zeitfenster">
          <View className="p-three">
            <TimePicker
              value={selectedStartTime}
              onChange={handleSelectStartTime}
              disabled={updateStartTimeMutation.isPending}
            />
          </View>
        </SettingsGroup>
      </ScrollView>

      <Modal
        visible={biometricsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBiometricsModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            style={{ backgroundColor: colors.bg }}
            className="p-four rounded-t-3xl gap-four max-h-[85%]">
            <View className="flex-row justify-between items-center pb-two border-b border-border">
              <Txt variant="title">Biometrie bearbeiten</Txt>
              <Pressable onPress={() => setBiometricsModalVisible(false)} hitSlop={12}>
                <Txt variant="title" tone="secondary">
                  ×
                </Txt>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="gap-three">
              <TextField
                label="Größe in cm"
                value={editHeightCm}
                onChangeText={setEditHeightCm}
                placeholder="z. B. 180"
                keyboardType="numeric"
              />

              <View className="gap-one">
                <Txt variant="caption" tone="secondary">
                  Geschlecht (Rechenbasis für Grundumsatz)
                </Txt>
                <View className="flex-row gap-two">
                  <Pressable
                    onPress={() => setEditSex('male')}
                    style={{
                      backgroundColor: editSex === 'male' ? colors.basil : colors.surface,
                      borderColor: editSex === 'male' ? colors.basil : colors.border,
                    }}
                    className="flex-1 py-two rounded-xl border items-center">
                    <Txt
                      variant="body"
                      weight="700"
                      tone={editSex === 'male' ? 'onAccent' : 'primary'}>
                      Männlich
                    </Txt>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditSex('female')}
                    style={{
                      backgroundColor: editSex === 'female' ? colors.basil : colors.surface,
                      borderColor: editSex === 'female' ? colors.basil : colors.border,
                    }}
                    className="flex-1 py-two rounded-xl border items-center">
                    <Txt
                      variant="body"
                      weight="700"
                      tone={editSex === 'female' ? 'onAccent' : 'primary'}>
                      Weiblich
                    </Txt>
                  </Pressable>
                </View>
              </View>

              <TextField
                label="Geburtsdatum (JJJJ-MM-TT)"
                value={editBirthDate}
                onChangeText={setEditBirthDate}
                placeholder="1990-05-15"
              />

              <View className="gap-one">
                <Txt variant="caption" tone="secondary">
                  Aktivitätslevel
                </Txt>
                <View className="gap-two">
                  {(
                    ['sedentary', 'light', 'moderate', 'active', 'very_active'] as ActivityLevel[]
                  ).map((level) => {
                    const isSelected = editActivityLevel === level;
                    return (
                      <Pressable
                        key={level}
                        onPress={() => setEditActivityLevel(level)}
                        style={{
                          backgroundColor: isSelected ? colors.basil : colors.surface,
                          borderColor: isSelected ? colors.basil : colors.border,
                        }}
                        className="py-two px-three rounded-xl border flex-row justify-between items-center">
                        <Txt variant="body" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                          {ACTIVITY_LABELS[level]}
                        </Txt>
                        {isSelected ? (
                          <Txt variant="caption" tone="onAccent">
                            ✓
                          </Txt>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View className="pt-two gap-two">
              <Button
                label="Biometrie speichern"
                onPress={handleSaveBiometrics}
                loading={savingBiometrics}
              />
              <Button
                label="Abbrechen"
                variant="secondary"
                onPress={() => setBiometricsModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
