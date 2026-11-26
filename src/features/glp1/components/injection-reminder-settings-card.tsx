import { Host, Switch } from '@expo/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { TimeWheelField } from '@/components/forms/time-wheel-field';
import { ContentCard } from '@/components/ui/content-card';
import { Txt } from '@/constants/ui';
import { formatDateTimeInput, parseDateTimeInput } from '@/features/glp1/domain/date-time-input';
import { toMedicationUnit } from '@/features/glp1/domain/medication-options';
import {
  useInjectionPlan,
  useUpdateInjectionPlanMutation,
} from '@/features/glp1/hooks/injection-plan-api';
import { useInjectionReminder } from '@/features/glp1/hooks/use-injection-reminder';

const styles = StyleSheet.create((theme) => ({
  content: {
    gap: theme.space.sm,
  },
  timeGroup: {
    gap: theme.space.sm,
  },
}));

type InjectionReminderSettingsCardProps = {
  userId: string | undefined;
};

export function InjectionReminderSettingsCard({ userId }: InjectionReminderSettingsCardProps) {
  const { t } = useTranslation();
  useInjectionReminder(userId);
  const { data: plan, isLoading, isError } = useInjectionPlan(userId);
  const updateMutation = useUpdateInjectionPlanMutation();
  const [reminderTime, setReminderTime] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);

  useEffect(() => {
    setReminderTime(plan ? formatDateTimeInput(plan.anchor_at).slice(11) : '');
    setTimeError(null);
  }, [plan]);

  function handleReminderChange(reminderEnabled: boolean) {
    if (!userId || !plan) return;
    updateMutation.mutate({
      id: plan.id,
      userId,
      medicationName: plan.medication_name,
      dose: plan.dose,
      unit: toMedicationUnit(plan.unit),
      cadenceDays: plan.cadence_days,
      anchorAt: plan.anchor_at,
      reminderEnabled,
    });
  }

  function handleTimeChange(time: string) {
    if (!userId || !plan) return;
    const anchorAt = parseDateTimeInput(
      `${formatDateTimeInput(plan.anchor_at).slice(0, 10)} ${time}`,
    );
    if (!anchorAt) {
      setTimeError(t('glp1.reminder.invalidTime'));
      return;
    }
    setReminderTime(time);
    setTimeError(null);
    updateMutation.mutate({
      id: plan.id,
      userId,
      medicationName: plan.medication_name,
      dose: plan.dose,
      unit: toMedicationUnit(plan.unit),
      cadenceDays: plan.cadence_days,
      anchorAt,
      reminderEnabled: plan.reminder_enabled,
    });
  }

  return (
    <ContentCard title={t('glp1.reminder.title')}>
      {isLoading ? (
        <Txt variant="caption" tone="secondary">
          {t('glp1.reminder.loading')}
        </Txt>
      ) : isError ? (
        <Txt variant="caption" tone="danger">
          {t('glp1.reminder.error')}
        </Txt>
      ) : !plan ? (
        <Txt variant="caption" tone="secondary">
          {t('glp1.reminder.noPlan')}
        </Txt>
      ) : (
        <View style={styles.content}>
          <Txt variant="caption" tone="secondary">
            {t('glp1.reminder.hint')}
          </Txt>
          <Host matchContents>
            <Switch
              value={plan.reminder_enabled}
              onValueChange={handleReminderChange}
              label={t('glp1.reminder.toggle')}
              disabled={updateMutation.isPending}
            />
          </Host>
          <View style={styles.timeGroup}>
            <TimeWheelField
              label={t('glp1.reminder.time')}
              value={reminderTime}
              onChange={handleTimeChange}
            />
            {timeError || updateMutation.isError ? (
              <Txt variant="caption" tone="danger">
                {timeError ?? t('glp1.reminder.saveError')}
              </Txt>
            ) : null}
          </View>
        </View>
      )}
    </ContentCard>
  );
}
