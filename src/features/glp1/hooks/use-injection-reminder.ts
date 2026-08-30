import { useEffect } from 'react';
import { calculateInjectionDue } from '@/features/glp1/domain/injection-due';
import { useMedicationLogs } from '@/features/glp1/hooks/glp1-api';
import { useInjectionPlan } from '@/features/glp1/hooks/injection-plan-api';
import { cancelLocalReminder, scheduleLocalReminder } from '@/lib/notifications';

export function injectionReminderIdentifier(userId: string): string {
  return `fam.glp1.injection-due.v1.${userId}`;
}

export function useInjectionReminder(userId: string | undefined): void {
  const planQuery = useInjectionPlan(userId);
  const medicationQuery = useMedicationLogs(userId, null);
  const plan = planQuery.data;
  const latestMedicationAt = medicationQuery.data?.[0]?.administered_at;

  useEffect(() => {
    if (
      !userId ||
      planQuery.isLoading ||
      medicationQuery.isLoading ||
      planQuery.isError ||
      medicationQuery.isError
    ) {
      return;
    }

    const identifier = injectionReminderIdentifier(userId);
    if (!plan?.reminder_enabled) {
      void cancelLocalReminder(identifier);
      return;
    }

    const now = new Date();
    const due = calculateInjectionDue(
      { anchorAt: plan.anchor_at, cadenceDays: plan.cadence_days },
      latestMedicationAt ? { administeredAt: latestMedicationAt } : null,
      now,
    );
    const dueDate = new Date(due.nextDueAt);

    if (dueDate <= now) {
      void cancelLocalReminder(identifier);
      return;
    }

    void scheduleLocalReminder({
      identifier,
      date: dueDate,
      title: 'Injektion fällig',
      body: 'Deine Injektion ist fällig.',
    });
  }, [
    latestMedicationAt,
    medicationQuery.isError,
    medicationQuery.isLoading,
    plan,
    planQuery.isError,
    planQuery.isLoading,
    userId,
  ]);
}
