import type { TFunction } from 'i18next';

import { calculateInjectionDue } from '@/features/glp1/domain/injection-due';

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
  t: TFunction;
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
  t,
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
    title: t('glp1.reminderNotification.title'),
    body: t('glp1.reminderNotification.body'),
  };
}
