import { Host, Switch } from '@expo/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TimeWheelField } from '@/components/forms/time-wheel-field';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import { formatDateTimeInput, parseDateTimeInput } from '@/features/glp1/domain/date-time-input';
import { toMedicationUnit } from '@/features/glp1/domain/medication-options';
import {
  useInjectionPlan,
  useUpdateInjectionPlanMutation,
} from '@/features/glp1/hooks/injection-plan-api';
import { useInjectionReminder } from '@/features/glp1/hooks/use-injection-reminder';

type InjectionReminderSettingsCardProps = {
  userId: string | undefined;
};

export function InjectionReminderSettingsCard({ userId }: InjectionReminderSettingsCardProps) {
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
      setTimeError('Bitte eine gültige Uhrzeit auswählen.');
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
    <Card title="Injektions-Erinnerung">
      {isLoading ? (
        <Txt variant="caption" tone="secondary">
          Injektions-Erinnerung wird geladen...
        </Txt>
      ) : isError ? (
        <Txt variant="caption" tone="danger">
          Injektions-Erinnerung konnte nicht geladen werden.
        </Txt>
      ) : !plan ? (
        <Txt variant="caption" tone="secondary">
          Lege zuerst einen Injektionsplan an, um die Erinnerung zu aktivieren.
        </Txt>
      ) : (
        <View className="gap-two">
          <Txt variant="caption" tone="secondary">
            Erinnert dich vor dem nächsten fälligen Termin aus deinem Injektionsplan.
          </Txt>
          <Host matchContents>
            <Switch
              value={plan.reminder_enabled}
              onValueChange={handleReminderChange}
              label="An fällige Injektion erinnern"
              disabled={updateMutation.isPending}
            />
          </Host>
          <View className="gap-two">
            <TimeWheelField
              label="Uhrzeit der Injektions-Erinnerung"
              value={reminderTime}
              onChange={handleTimeChange}
            />
            {timeError || updateMutation.isError ? (
              <Txt variant="caption" tone="danger">
                {timeError ?? 'Die Uhrzeit konnte nicht gespeichert werden.'}
              </Txt>
            ) : null}
          </View>
        </View>
      )}
    </Card>
  );
}
