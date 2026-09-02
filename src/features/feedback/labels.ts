import type { FeedbackStatus, FeedbackType } from '@/features/feedback/api';

/** Deutsche Anzeigetexte fuer die Feedback-Typen, geteilt zwischen Formular und Liste. */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Fehler',
  suggestion: 'Anregung',
  other: 'Sonstiges',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  answered: 'Beantwortet',
  closed: 'Geschlossen',
};

/** Themefarbe je Status — passend zu den Semantiktokens in constants/theme.ts. */
export const FEEDBACK_STATUS_COLORS: Record<
  FeedbackStatus,
  'textSecondary' | 'warning' | 'success'
> = {
  open: 'textSecondary',
  in_progress: 'warning',
  answered: 'success',
  closed: 'textSecondary',
};
