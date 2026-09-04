import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from '@/constants/ui';
import { calculateInjectionDue } from '@/features/glp1/domain/injection-due';
import { toMedicationUnit } from '@/features/glp1/domain/medication-options';
import {
  InjectionPlanForm,
  type InjectionPlanFormValue,
} from '@/features/glp1/forms/injection-plan-form';
import { useRecentMedicationLogs } from '@/features/glp1/hooks/glp1-api';
import {
  type InjectionPlanRow,
  useCreateInjectionPlanMutation,
  useDeleteInjectionPlanMutation,
  useInjectionPlan,
  useUpdateInjectionPlanMutation,
} from '@/features/glp1/hooks/injection-plan-api';
import { useInjectionReminder } from '@/features/glp1/hooks/use-injection-reminder';

type InjectionPlanSectionProps = {
  userId: string | undefined;
};

const STATUS_CONTENT = {
  upcoming: { label: 'Anstehend', color: 'accent' },
  due_today: { label: 'Heute fällig', color: 'warning' },
  overdue: { label: 'Überfällig', color: 'danger' },
} as const;

function planFormValue(plan: InjectionPlanRow): InjectionPlanFormValue {
  return {
    medicationName: plan.medication_name,
    dose: plan.dose,
    unit: toMedicationUnit(plan.unit),
    cadenceDays: plan.cadence_days,
    anchorAt: plan.anchor_at,
    reminderEnabled: plan.reminder_enabled,
  };
}

export function InjectionPlanSection({ userId }: InjectionPlanSectionProps) {
  useInjectionReminder(userId);
  const [showForm, setShowForm] = useState(false);
  const { data: recentInjectionLogs = [] } = useRecentMedicationLogs(userId);
  const { data: plan, isLoading, isError } = useInjectionPlan(userId);
  const createMutation = useCreateInjectionPlanMutation();
  const updateMutation = useUpdateInjectionPlanMutation();
  const deleteMutation = useDeleteInjectionPlanMutation();

  function save(value: InjectionPlanFormValue) {
    if (!userId) return;
    const input = { userId, ...value };
    const options = { onSuccess: () => setShowForm(false) };
    if (plan) {
      updateMutation.mutate({ id: plan.id, ...input }, options);
    } else {
      createMutation.mutate(input, options);
    }
  }

  if (isLoading) {
    return (
      <Txt variant="caption" tone="secondary">
        Injektionsplan wird geladen...
      </Txt>
    );
  }

  if (isError) {
    return (
      <Txt variant="caption" tone="danger">
        Injektionsplan konnte nicht geladen werden.
      </Txt>
    );
  }

  if (!plan) {
    return showForm ? (
      <InjectionPlanForm mode="create" isPending={createMutation.isPending} onSubmit={save} />
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Injektionsplan anlegen"
        onPress={() => setShowForm(true)}
        className="py-two px-three rounded-xl bg-card border border-border items-center">
        <Txt variant="label" weight="700">
          Injektionsplan anlegen
        </Txt>
      </Pressable>
    );
  }

  const latestInjectionAt = recentInjectionLogs.find(
    (log) =>
      log.medication_name.trim().toLocaleLowerCase('de-DE') ===
      plan.medication_name.trim().toLocaleLowerCase('de-DE'),
  )?.administered_at;
  const due = calculateInjectionDue(
    { anchorAt: plan.anchor_at, cadenceDays: plan.cadence_days },
    latestInjectionAt ? { administeredAt: latestInjectionAt } : null,
    new Date(),
  );
  const status = STATUS_CONTENT[due.status];

  return (
    <View className="gap-two">
      <View className="p-three bg-surface rounded-xl border border-border gap-one">
        <View className="flex-row items-center justify-between">
          <Txt variant="caption" tone="secondary">
            Nächste Injektion
          </Txt>
          <Txt variant="body" weight="700" tone={status.color}>
            {status.label}
          </Txt>
        </View>
        <Txt variant="body" weight="700">
          {new Date(due.nextDueAt).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {plan.medication_name} · {plan.dose} {plan.unit} · alle {plan.cadence_days} Tage
        </Txt>
        <View className="flex-row gap-three pt-one">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Injektionsplan bearbeiten"
            onPress={() => setShowForm((current) => !current)}>
            <Txt variant="caption" tone="primary">
              Bearbeiten
            </Txt>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Injektionsplan entfernen"
            onPress={() =>
              userId &&
              deleteMutation.mutate(
                { id: plan.id, userId },
                { onSuccess: () => setShowForm(false) },
              )
            }>
            <Txt variant="caption" tone="danger">
              Entfernen
            </Txt>
          </Pressable>
        </View>
      </View>

      {showForm ? (
        <InjectionPlanForm
          initialValue={planFormValue(plan)}
          mode="edit"
          isPending={updateMutation.isPending}
          onSubmit={save}
        />
      ) : null}
    </View>
  );
}
