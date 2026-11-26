import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { useDevSettingsStore } from '@/constants/dev-settings';
import { Button, CloseButton, Press, Surface, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  type TrackingMethod,
  useCurrentGoal,
  useUpdateTrackingDayStartTimeMutation,
  useUpdateTrackingMethodMutation,
} from '@/features/calorie-tracking/api';
import { InjectionPlanSection } from '@/features/glp1/components/injection-plan-section';
import { useProfile } from '@/features/profile/api';
import {
  getTrackingMethodDescription,
  getTrackingMethodLabel,
  getTrackingMethodSettings,
  TRACKING_METHODS,
} from '@/features/profile/tracking-methods';
import { SettingsGroup } from '@/features/settings/settings-menu';
import { useFeatureFlags } from '@/lib/observability/providers/posthog';

function formatHourString(hour: number): string {
  const clamped = Math.max(0, Math.min(23, Math.round(hour)));
  return `${String(clamped).padStart(2, '0')}:00`;
}

const TIME_PRESETS = [
  { hour: 0, label: '00:00', tag: 'standard' },
  { hour: 4, label: '04:00', tag: 'earlyBird' },
  { hour: 6, label: '06:00', tag: 'earlyShift' },
  { hour: 14, label: '14:00', tag: 'lateShift' },
  { hour: 22, label: '22:00', tag: 'nightShift' },
] as const;

const styles = StyleSheet.create((theme) => ({
  timePicker: {
    gap: theme.space.lg,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    padding: theme.space.xxl,
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
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  modal: {
    padding: theme.space.xxl,
    gap: theme.space.xxl,
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
    backgroundColor: theme.backgroundElement,
  },
  methodOptionSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
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
    padding: theme.space.xxl,
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
  t,
}: {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  t: TFunction;
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
      setInputError(t('profile.tracking.invalidTime'));
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
        <Press
          onPress={handleOpenModal}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t('profile.tracking.manualAdjust')}
          containerStyle={{ flex: 1 }}
          style={styles.timeDisplayButton}>
          <Txt variant="caption" tone="secondary">
            {t('profile.tracking.individualStart')}
          </Txt>
          <Txt variant="display" style={styles.timeValue}>
            {t('profile.tracking.timeValue', { time: value })}
          </Txt>
        </Press>

        {/* Stepper Buttons (-1h / +1h) */}
        <View style={styles.stepper}>
          <Press
            onPress={() => step(-1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('profile.tracking.earlier')}
            style={styles.stepperButton}>
            <Txt variant="body" weight="700">
              {t('profile.tracking.earlierShort')}
            </Txt>
          </Press>
          <Press
            onPress={() => step(1)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('profile.tracking.later')}
            style={styles.stepperButton}>
            <Txt variant="body" weight="700">
              {t('profile.tracking.laterShort')}
            </Txt>
          </Press>
        </View>
      </Surface>

      {/* Schicht-Presets */}
      <View>
        <Txt variant="caption" tone="secondary" style={styles.presetLabel}>
          {t('profile.tracking.presetHint')}
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presets}>
          {TIME_PRESETS.map((preset) => {
            const isSelected = value === preset.label;
            return (
              <Press
                key={preset.hour}
                onPress={() => onChange(preset.label)}
                disabled={disabled}
                style={[styles.preset, isSelected && styles.presetSelected]}>
                <Txt variant="body" weight="700" tone={isSelected ? 'onAccent' : 'primary'}>
                  {preset.label}
                </Txt>
                <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                  {t(`profile.tracking.${preset.tag}`)}
                </Txt>
              </Press>
            );
          })}
        </ScrollView>
      </View>

      {/* Präzise Erklärung */}
      <Txt variant="caption" tone="secondary">
        {value === '00:00'
          ? t('profile.tracking.standardExplanation')
          : t('profile.tracking.customExplanation', { time: value })}
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
              <Txt variant="title">{t('profile.tracking.dayStartTitle')}</Txt>
              <CloseButton
                onPress={() => setModalVisible(false)}
                accessibilityLabel={t('profile.tracking.dayStartClose')}
              />
            </View>

            <View style={styles.modalFields}>
              <TextField
                label={t('profile.tracking.timeLabel')}
                value={inputTime}
                onChangeText={setInputTime}
                placeholder={t('profile.tracking.timePlaceholder')}
                error={inputError ?? undefined}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
              <Txt variant="caption" tone="secondary">
                {t('profile.tracking.timeHint')}
              </Txt>
            </View>

            <View style={styles.modalActions}>
              <Button title={t('profile.tracking.applyTime')} onPress={handleSaveCustomTime} />
              <Button
                title={t('profile.tracking.cancel')}
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
  const { i18n, t } = useTranslation();
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
      title={t('profile.tracking.title')}
      back={{ label: t('profile.tracking.back'), href: '/settings' }}
      backStyle="icon">
      <SettingsGroup title={t('profile.tracking.methodGroup')}>
        <View style={styles.groupContent}>
          <Txt variant="body" tone="secondary">
            {t('profile.tracking.methodHint')}
          </Txt>
          <View style={styles.methodList}>
            {TRACKING_METHODS.map((m) => {
              const isSelected = selectedMethod === m.id;
              const isEnabled = trackingMethodEnabled[m.id];
              return (
                <Fragment key={m.id}>
                  <Press
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
                        {getTrackingMethodLabel(t, m.id)}
                      </Txt>
                      <Txt variant="caption" tone={isSelected ? 'onAccent' : 'secondary'}>
                        {getTrackingMethodDescription(t, m.id)}
                      </Txt>
                    </View>
                    {isSelected ? (
                      <Txt variant="body" weight="700" tone="onAccent">
                        {t('profile.tracking.active')}
                      </Txt>
                    ) : !isEnabled ? (
                      <Txt variant="caption" tone="secondary">
                        {t('profile.tracking.comingSoon')}
                      </Txt>
                    ) : null}
                  </Press>
                  {m.id === 'glp1' && isSelected ? <InjectionPlanSection userId={userId} /> : null}
                </Fragment>
              );
            })}
          </View>
        </View>
      </SettingsGroup>

      {/* 2. Ernährung & Tagesziele (Kalorienziel & Makros) */}
      <SettingsGroup title={t('profile.tracking.calorieGroup')}>
        <View style={styles.groupContentWide}>
          {/* Große Tagesziel-Kachel für Kalorien */}
          <Surface tone="surface" style={styles.metricHero}>
            <Txt variant="caption" tone="secondary">
              {t('profile.tracking.calorieGoal')}
            </Txt>
            <Txt variant="display" style={styles.metricValue}>
              {currentGoal?.daily_kcal
                ? `${new Intl.NumberFormat(i18n.language).format(currentGoal.daily_kcal)} ${t('calorieTracking.units.kcal')}`
                : t('profile.tracking.notSet')}
            </Txt>
          </Surface>

          {/* 3 Makronährstoff-Kacheln (Protein, Carbs, Fett) */}
          <View style={styles.metricRow}>
            <Surface tone="surface" style={[styles.metricCard, styles.macroCard]}>
              <Txt variant="caption" tone="secondary">
                {t('profile.tracking.protein')}
              </Txt>
              <Txt variant="body" weight="700" style={styles.metricValue}>
                {currentGoal?.protein_g !== null && currentGoal?.protein_g !== undefined
                  ? `${new Intl.NumberFormat(i18n.language).format(currentGoal.protein_g)}${t('calorieTracking.units.gramShort')}`
                  : '–'}
              </Txt>
            </Surface>

            <Surface tone="surface" style={[styles.metricCard, styles.macroCard]}>
              <Txt variant="caption" tone="secondary">
                {t('profile.tracking.carbs')}
              </Txt>
              <Txt variant="body" weight="700" style={styles.metricValue}>
                {currentGoal?.carbs_g !== null && currentGoal?.carbs_g !== undefined
                  ? `${new Intl.NumberFormat(i18n.language).format(currentGoal.carbs_g)}${t('calorieTracking.units.gramShort')}`
                  : '–'}
              </Txt>
            </Surface>

            <Surface tone="surface" style={[styles.metricCard, styles.macroCard]}>
              <Txt variant="caption" tone="secondary">
                {t('profile.tracking.fat')}
              </Txt>
              <Txt variant="body" weight="700" style={styles.metricValue}>
                {currentGoal?.fat_g !== null && currentGoal?.fat_g !== undefined
                  ? `${new Intl.NumberFormat(i18n.language).format(currentGoal.fat_g)}${t('calorieTracking.units.gramShort')}`
                  : '–'}
              </Txt>
            </Surface>
          </View>

          {/* Button zum Bearbeiten der Ziele */}
          <Button
            title={t('profile.tracking.editGoals')}
            variant="secondary"
            onPress={() => router.push('/settings/goals')}
          />
        </View>
      </SettingsGroup>

      {/* 3. Tracking-Rhythmus & Zeitfenster (Tagesstart-Uhrzeit) */}
      <SettingsGroup title={t('profile.tracking.rhythmGroup')}>
        <View style={styles.groupContent}>
          <TimePicker
            value={selectedStartTime}
            onChange={handleSelectStartTime}
            disabled={updateStartTimeMutation.isPending}
            t={t}
          />
        </View>
      </SettingsGroup>
    </Screen>
  );
}
