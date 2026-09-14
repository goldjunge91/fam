import { router } from 'expo-router';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { useDevSettingsStore } from '@/constants/dev-settings';
import { Button, CloseButton, Surface, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  type TrackingMethod,
  useCurrentGoal,
  useUpdateTrackingDayStartTimeMutation,
  useUpdateTrackingMethodMutation,
} from '@/features/calorie-tracking/api';
import { InjectionPlanSection } from '@/features/glp1/components/injection-plan-section';
import { useProfile } from '@/features/profile/api';
import { getTrackingMethodSettings, TRACKING_METHODS } from '@/features/profile/tracking-methods';
import { SettingsGroup } from '@/features/settings/settings-menu';
import { useFeatureFlags } from '@/lib/posthog';

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

const styles = StyleSheet.create((theme) => ({
  timePicker: {
    gap: theme.space.lg,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    padding: theme.space.xl + theme.space.xs,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
  timeDisplayButton: {
    flex: 1,
    marginRight: theme.space.sm,
  },
  timeValue: {
    marginTop: theme.space.xs,
  },
  stepper: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  stepperButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
  presetLabel: {
    marginBottom: theme.space.xs,
  },
  presets: {
    gap: theme.space.sm,
  },
  preset: {
    minWidth: 84,
    alignItems: 'center',
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
  presetSelected: {
    backgroundColor: theme.basil,
    borderColor: theme.basil,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  modal: {
    padding: theme.space.xl + theme.space.xs,
    gap: theme.space.xl + theme.space.xs,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    paddingBottom: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  modalFields: {
    gap: theme.space.lg,
  },
  modalActions: {
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
  },
  groupContent: {
    gap: theme.space.sm,
    padding: theme.space.lg,
  },
  groupContentWide: {
    gap: theme.space.lg,
    padding: theme.space.lg,
  },
  methodList: {
    gap: theme.space.sm,
  },
  methodOption: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space.lg,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  methodOptionSelected: {
    backgroundColor: theme.basil,
    borderColor: theme.basil,
  },
  methodOptionDisabled: {
    opacity: 0.55,
  },
  methodCopy: {
    flex: 1,
    minWidth: 0,
    marginRight: theme.space.sm,
  },
  metricHero: {
    alignItems: 'center',
    padding: theme.space.xl + theme.space.xs,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
  metricValue: {
    marginTop: theme.space.xs,
  },
  metricRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    padding: theme.space.lg,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
  macroCard: {
    alignItems: 'center',
  },
}));

function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
}) {
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
    <View style={styles.timePicker}>
      {/* Große digitale Uhr & Stepper */}
      <Surface tone="surface" style={styles.timeDisplay}>
        <Pressable
          onPress={handleOpenModal}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Uhrzeit für Tagesstart manuell anpassen"
          style={styles.timeDisplayButton}>
          <Txt variant="caption" tone="secondary">
            Individueller Tagesstart (Tippen zum Anpassen)
          </Txt>
          <Txt variant="display" style={styles.timeValue}>
            {value} Uhr ✏️
          </Txt>
        </Pressable>

        {/* Stepper Buttons (-1h / +1h) */}
        <View style={styles.stepper}>
          <Pressable
            onPress={() => step(-1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Eine Stunde früher"
            style={styles.stepperButton}>
            <Txt variant="body" weight="700">
              -1h
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => step(1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Eine Stunde später"
            style={styles.stepperButton}>
            <Txt variant="body" weight="700">
              +1h
            </Txt>
          </Pressable>
        </View>
      </Surface>

      {/* Schicht-Presets */}
      <View>
        <Txt variant="caption" tone="secondary" style={styles.presetLabel}>
          Schnellauswahl für Schichtmodelle:
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presets}>
          {TIME_PRESETS.map((preset) => {
            const isSelected = value === preset.label;
            return (
              <Pressable
                key={preset.hour}
                onPress={() => onChange(preset.label)}
                disabled={disabled}
                style={[styles.preset, isSelected && styles.presetSelected]}>
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
        <View style={styles.modalBackdrop}>
          <Surface tone="page" style={styles.modal}>
            <View style={styles.modalHeader}>
              <Txt variant="title">Tagesstart festlegen</Txt>
              <CloseButton
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Tagesstart festlegen schließen"
              />
            </View>

            <View style={styles.modalFields}>
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

            <View style={styles.modalActions}>
              <Button title="Uhrzeit übernehmen" onPress={handleSaveCustomTime} />
              <Button
                title="Abbrechen"
                variant="secondary"
                onPress={() => setModalVisible(false)}
              />
            </View>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

export function TrackingScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: currentGoal } = useCurrentGoal(userId);
  const featureFlags = useFeatureFlags();
  const trackingMethodOverrides = useDevSettingsStore((state) => state.trackingMethodOverrides);
  const trackingMethodEnabled = getTrackingMethodSettings(featureFlags, trackingMethodOverrides);

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
    if (!userId || method === selectedMethod || !trackingMethodEnabled[method]) return;
    setSelectedMethod(method);
    updateMethodMutation.mutate({ userId, method });
  }

  function handleSelectStartTime(time: string) {
    if (!userId || time === selectedStartTime) return;
    setSelectedStartTime(time);
    updateStartTimeMutation.mutate({ userId, time });
  }

  return (
    <Screen
      title="Mein Tracking"
      back={{ label: 'Einstellungen', href: '/settings' }}
      backStyle="icon">
      <SettingsGroup title="Deine Tracking-Methode">
        <View style={styles.groupContent}>
          <Txt variant="body" tone="secondary">
            Wähle deine aktive Methode für das Ernährungstagebuch:
          </Txt>
          <View style={styles.methodList}>
            {TRACKING_METHODS.map((m) => {
              const isSelected = selectedMethod === m.id;
              const isEnabled = trackingMethodEnabled[m.id];
              return (
                <Fragment key={m.id}>
                  <Pressable
                    onPress={() => handleSelectMethod(m.id)}
                    disabled={!isEnabled}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected, disabled: !isEnabled }}
                    style={[
                      styles.methodOption,
                      isSelected && styles.methodOptionSelected,
                      !isEnabled && styles.methodOptionDisabled,
                    ]}>
                    <View style={styles.methodCopy}>
                      <Txt
                        variant="body"
                        weight="700"
                        tone={isSelected ? 'onAccent' : isEnabled ? 'primary' : 'secondary'}>
                        {m.label}
                      </Txt>
                      <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                        {m.desc}
                      </Txt>
                    </View>
                    {isSelected ? (
                      <Txt variant="body" weight="700" tone="onAccent">
                        Aktiv ✓
                      </Txt>
                    ) : !isEnabled ? (
                      <Txt variant="caption" tone="secondary">
                        Demnächst verfügbar
                      </Txt>
                    ) : null}
                  </Pressable>
                  {m.id === 'glp1' && isSelected ? <InjectionPlanSection userId={userId} /> : null}
                </Fragment>
              );
            })}
          </View>
        </View>
      </SettingsGroup>

      {/* 2. Ernährung & Tagesziele (Kalorienziel & Makros) */}
      <SettingsGroup title="Ernährung & Tagesziele">
        <View style={styles.groupContentWide}>
          {/* Große Tagesziel-Kachel für Kalorien */}
          <Surface tone="surface" style={styles.metricHero}>
            <Txt variant="caption" tone="secondary">
              🎯 Kalorien-Tagesziel
            </Txt>
            <Txt variant="display" style={styles.metricValue}>
              {currentGoal?.daily_kcal ? `${currentGoal.daily_kcal} kcal` : 'Nicht festgelegt'}
            </Txt>
          </Surface>

          {/* 3 Makronährstoff-Kacheln (Protein, Carbs, Fett) */}
          <View style={styles.metricRow}>
            <Surface tone="surface" style={[styles.metricCard, styles.macroCard]}>
              <Txt variant="caption" tone="secondary">
                🥩 Protein
              </Txt>
              <Txt variant="body" weight="700" style={styles.metricValue}>
                {currentGoal ? `${currentGoal.protein_g}g` : '–'}
              </Txt>
            </Surface>

            <Surface tone="surface" style={[styles.metricCard, styles.macroCard]}>
              <Txt variant="caption" tone="secondary">
                🍞 Carbs
              </Txt>
              <Txt variant="body" weight="700" style={styles.metricValue}>
                {currentGoal ? `${currentGoal.carbs_g}g` : '–'}
              </Txt>
            </Surface>

            <Surface tone="surface" style={[styles.metricCard, styles.macroCard]}>
              <Txt variant="caption" tone="secondary">
                🥑 Fett
              </Txt>
              <Txt variant="body" weight="700" style={styles.metricValue}>
                {currentGoal ? `${currentGoal.fat_g}g` : '–'}
              </Txt>
            </Surface>
          </View>

          {/* Button zum Bearbeiten der Ziele */}
          <Button
            title="Ziele & Makros bearbeiten"
            variant="secondary"
            onPress={() => router.push('/settings/goals')}
          />
        </View>
      </SettingsGroup>

      {/* 3. Tracking-Rhythmus & Zeitfenster (Tagesstart-Uhrzeit) */}
      <SettingsGroup title="Tracking-Rhythmus & Zeitfenster">
        <View style={styles.groupContent}>
          <TimePicker
            value={selectedStartTime}
            onChange={handleSelectStartTime}
            disabled={updateStartTimeMutation.isPending}
          />
        </View>
      </SettingsGroup>
    </Screen>
  );
}
