import { useEffect, useRef } from 'react';
import { resolveInjectionReminder } from '@/features/glp1/domain/injection-reminder';
import { useLatestMedicationLog } from '@/features/glp1/hooks/glp1-api';
import { useInjectionPlan } from '@/features/glp1/hooks/injection-plan-api';
import { cancelLocalReminder, scheduleLocalReminder } from '@/lib/notifications';

export function injectionReminderIdentifier(userId: string): string {
  return `fam.glp1.injection-due.v1.${userId}`;
}

export function useInjectionReminder(userId: string | undefined): void {
  const planQuery = useInjectionPlan(userId);
  const plan = planQuery.data;
  const planMedicationName = plan?.medication_name;
  const planAnchorAt = plan?.anchor_at;
  const planCadenceDays = plan?.cadence_days;
  const planReminderEnabled = plan?.reminder_enabled;
  const medicationQuery = useLatestMedicationLog(userId, null, planMedicationName);
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
      const action = resolveInjectionReminder({
        identifier,
        plan:
          planAnchorAt && planCadenceDays !== undefined && planReminderEnabled !== undefined
            ? {
                anchorAt: planAnchorAt,
                cadenceDays: planCadenceDays,
                reminderEnabled: planReminderEnabled,
              }
            : null,
        latestInjectionAt,
        now: new Date(),
      });

      if (action.kind === 'cancel') {
        await cancelLocalReminder(identifier);
        return;
      }

      await scheduleLocalReminder({
        identifier: action.identifier,
        date: action.date,
        title: action.title,
        body: action.body,
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
    planAnchorAt,
    planCadenceDays,
    planReminderEnabled,
    planQuery.isError,
    planQuery.isLoading,
    userId,
  ]);
}
