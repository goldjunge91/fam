import type { TFunction } from 'i18next';
import type { FeedbackStatus, FeedbackType } from '@/features/feedback/api';

export const FEEDBACK_TYPE_VALUES = [
  'bug',
  'suggestion',
  'other',
] as const satisfies readonly FeedbackType[];
export const FEEDBACK_STATUS_VALUES = [
  'open',
  'in_progress',
  'answered',
  'closed',
] as const satisfies readonly FeedbackStatus[];

export function getFeedbackTypeLabel(t: TFunction, type: FeedbackType): string {
  switch (type) {
    case 'bug':
      return t('feedback.types.bug');
    case 'suggestion':
      return t('feedback.types.suggestion');
    case 'other':
      return t('feedback.types.other');
  }
}

export function getFeedbackStatusLabel(t: TFunction, status: FeedbackStatus): string {
  switch (status) {
    case 'open':
      return t('feedback.statuses.open');
    case 'in_progress':
      return t('feedback.statuses.inProgress');
    case 'answered':
      return t('feedback.statuses.answered');
    case 'closed':
      return t('feedback.statuses.closed');
  }
}

/** Themefarbe je Status, passend zu den Semantiktokens in components/theme/index.ts. */
export const FEEDBACK_STATUS_COLORS: Record<
  FeedbackStatus,
  'textSecondary' | 'warning' | 'success'
> = {
  open: 'textSecondary',
  in_progress: 'warning',
  answered: 'success',
  closed: 'textSecondary',
};
