import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Card, Txt } from '@/constants/ui';
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
  upcoming: { key: 'glp1.plan.upcoming', color: 'accent' },
  due_today: { key: 'glp1.plan.dueToday', color: 'warning' },
  overdue: { key: 'glp1.plan.overdue', color: 'danger' },
} as const;

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.sm,
  },
  planCard: {
    gap: theme.space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space.lg,
    paddingTop: theme.space.xs,
  },
}));

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
  const { i18n, t } = useTranslation();
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
        {t('glp1.plan.loading')}
      </Txt>
    );
  }

  if (isError) {
    return (
      <Txt variant="caption" tone="danger">
        {t('glp1.plan.error')}
      </Txt>
    );
  }

  if (!plan) {
    return showForm ? (
      <InjectionPlanForm mode="create" isPending={createMutation.isPending} onSubmit={save} />
    ) : (
      <Button
        title={t('glp1.plan.create')}
        variant="secondary"
        haptic="light"
        full
        onPress={() => setShowForm(true)}
      />
    );
  }

  const latestInjectionAt = recentInjectionLogs.find(
    (log) =>
      log.medication_name.trim().toLocaleLowerCase(i18n.language) ===
      plan.medication_name.trim().toLocaleLowerCase(i18n.language),
  )?.administered_at;
  const due = calculateInjectionDue(
    { anchorAt: plan.anchor_at, cadenceDays: plan.cadence_days },
    latestInjectionAt ? { administeredAt: latestInjectionAt } : null,
    new Date(),
  );
  const status = STATUS_CONTENT[due.status];

  return (
    <View style={styles.root}>
      <Card style={styles.planCard}>
        <View style={styles.header}>
          <Txt variant="caption" tone="secondary">
            {t('glp1.plan.next')}
          </Txt>
          <Txt variant="body" weight="700" tone={status.color}>
            {t(status.key)}
          </Txt>
        </View>
        <Txt variant="body" weight="700">
          {new Date(due.nextDueAt).toLocaleString(i18n.language, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {t('glp1.plan.details', {
            medication: plan.medication_name,
            dose: plan.dose,
            unit: plan.unit,
            days: plan.cadence_days,
          })}
        </Txt>
        <View style={styles.actions}>
          <Button
            title={t('glp1.plan.edit')}
            variant="link"
            size="sm"
            haptic="light"
            accessibilityLabel={t('glp1.plan.editAccessibility')}
            onPress={() => setShowForm((current) => !current)}
          />
          <Button
            title={t('glp1.plan.remove')}
            variant="danger"
            size="sm"
            flat
            haptic="light"
            accessibilityLabel={t('glp1.plan.removeAccessibility')}
            onPress={() =>
              userId &&
              deleteMutation.mutate(
                { id: plan.id, userId },
                { onSuccess: () => setShowForm(false) },
              )
            }
          />
        </View>
      </Card>

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
