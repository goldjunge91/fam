import { useEffect, useRef } from 'react';
import { calculateInjectionDue } from '@/features/glp1/domain/injection-due';
import { useLatestMedicationLog } from '@/features/glp1/hooks/glp1-api';
import { useInjectionPlan } from '@/features/glp1/hooks/injection-plan-api';
import { cancelLocalReminder, scheduleLocalReminder } from '@/lib/notifications';

export function injectionReminderIdentifier(userId: string): string {
  return `fam.glp1.injection-due.v1.${userId}`;
}

export function useInjectionReminder(userId: string | undefined): void {
  const planQuery = useInjectionPlan(userId);
  const plan = planQuery.data;
  const medicationQuery = useLatestMedicationLog(userId, null, plan?.medication_name);
  const latestInjectionAt = medicationQuery.data?.administered_at;
  const reconciliationQueue = useRef<Promise<void>>(Promise.resolve());
  const previousUserId = useRef(userId);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (!previous || previous === userId) return;

    reconciliationQueue.current = reconciliationQueue.current
      .catch(() => undefined)
      .then(() => cancelLocalReminder(injectionReminderIdentifier(previous)))
      .catch(() => undefined);
  }, [userId]);

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

    const reconcile = async () => {
      const identifier = injectionReminderIdentifier(userId);
      if (!plan?.reminder_enabled) {
        await cancelLocalReminder(identifier);
        return;
      }

      const now = new Date();
      const due = calculateInjectionDue(
        { anchorAt: plan.anchor_at, cadenceDays: plan.cadence_days },
        latestInjectionAt ? { administeredAt: latestInjectionAt } : null,
        now,
      );
      const dueDate = new Date(due.nextDueAt);

      if (dueDate <= now) {
        await cancelLocalReminder(identifier);
        return;
      }

      await scheduleLocalReminder({
        identifier,
        date: dueDate,
        title: 'Injektion fällig',
        body: 'Deine Injektion ist fällig.',
      });
    };

    reconciliationQueue.current = reconciliationQueue.current
      .catch(() => undefined)
      .then(reconcile)
      .catch(() => undefined);
  }, [
    latestInjectionAt,
    medicationQuery.isError,
    medicationQuery.isLoading,
    plan,
    planQuery.isError,
    planQuery.isLoading,
    userId,
  ]);
}
