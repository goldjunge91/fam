export type InjectionDueStatus = 'upcoming' | 'due_today' | 'overdue';

type InjectionPlanForDue = {
  anchorAt: string;
  cadenceDays: number;
};

type MedicationLogForDue = {
  administeredAt: string;
};

export type InjectionDue = {
  nextDueAt: string;
  status: InjectionDueStatus;
};

function localDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateInjectionDue(
  plan: InjectionPlanForDue,
  latestMedication: MedicationLogForDue | null,
  now: Date,
): InjectionDue {
  const nextDue = new Date(latestMedication?.administeredAt ?? plan.anchorAt);
  if (latestMedication) {
    nextDue.setDate(nextDue.getDate() + plan.cadenceDays);
  }

  const dueDay = localDayNumber(nextDue);
  const currentDay = localDayNumber(now);
  const status: InjectionDueStatus =
    currentDay === dueDay ? 'due_today' : currentDay > dueDay ? 'overdue' : 'upcoming';

  return { nextDueAt: nextDue.toISOString(), status };
}
