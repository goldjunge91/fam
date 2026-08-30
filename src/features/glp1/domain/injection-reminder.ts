import { calculateInjectionDue } from '@/features/glp1/domain/injection-due';

export const INJECTION_REMINDER_TITLE = 'Injektion fällig';
export const INJECTION_REMINDER_BODY = 'Deine Injektion ist fällig.';

export type InjectionReminderPlan = {
  anchorAt: string;
  cadenceDays: number;
  reminderEnabled: boolean;
};

type InjectionReminderInput = {
  identifier: string;
  plan: InjectionReminderPlan | null;
  latestInjectionAt: string | null | undefined;
  now: Date;
};

export type InjectionReminderAction =
  | { kind: 'cancel'; identifier: string }
  | {
      kind: 'schedule';
      identifier: string;
      date: Date;
      title: string;
      body: string;
    };

export function resolveInjectionReminder({
  identifier,
  plan,
  latestInjectionAt,
  now,
}: InjectionReminderInput): InjectionReminderAction {
  if (!plan?.reminderEnabled) {
    return { kind: 'cancel', identifier };
  }

  const due = calculateInjectionDue(
    { anchorAt: plan.anchorAt, cadenceDays: plan.cadenceDays },
    latestInjectionAt ? { administeredAt: latestInjectionAt } : null,
    now,
  );
  const date = new Date(due.nextDueAt);

  if (!Number.isFinite(date.getTime()) || date <= now) {
    return { kind: 'cancel', identifier };
  }

  return {
    kind: 'schedule',
    identifier,
    date,
    title: INJECTION_REMINDER_TITLE,
    body: INJECTION_REMINDER_BODY,
  };
}
