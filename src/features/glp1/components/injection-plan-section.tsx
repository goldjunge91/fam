import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { calculateInjectionDue } from '@/features/glp1/domain/injection-due';
import { toMedicationUnit } from '@/features/glp1/domain/medication-options';
import {
  InjectionPlanForm,
  type InjectionPlanFormValue,
} from '@/features/glp1/forms/injection-plan-form';
import {
  type InjectionPlanRow,
  useCreateInjectionPlanMutation,
  useDeleteInjectionPlanMutation,
  useInjectionPlan,
  useUpdateInjectionPlanMutation,
} from '@/features/glp1/hooks/injection-plan-api';

type InjectionPlanSectionProps = {
  userId: string | undefined;
  latestInjectionAt?: string;
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

export function InjectionPlanSection({ userId, latestInjectionAt }: InjectionPlanSectionProps) {
  const [showForm, setShowForm] = useState(false);
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
      <ThemedText type="caption" themeColor="textSecondary">
        Injektionsplan wird geladen...
      </ThemedText>
    );
  }

  if (isError) {
    return (
      <ThemedText type="caption" themeColor="danger">
        Injektionsplan konnte nicht geladen werden.
      </ThemedText>
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
        <ThemedText type="labelBold">Injektionsplan anlegen</ThemedText>
      </Pressable>
    );
  }

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
          <ThemedText type="caption" themeColor="textSecondary">
            Nächste Injektion
          </ThemedText>
          <ThemedText type="smallBold" themeColor={status.color}>
            {status.label}
          </ThemedText>
        </View>
        <ThemedText type="smallBold">
          {new Date(due.nextDueAt).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {plan.medication_name} · {plan.dose} {plan.unit} · alle {plan.cadence_days} Tage
        </ThemedText>
        <View className="flex-row gap-three pt-one">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Injektionsplan bearbeiten"
            onPress={() => setShowForm((current) => !current)}>
            <ThemedText type="caption" themeColor="accent">
              Bearbeiten
            </ThemedText>
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
            <ThemedText type="caption" themeColor="danger">
              Entfernen
            </ThemedText>
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
