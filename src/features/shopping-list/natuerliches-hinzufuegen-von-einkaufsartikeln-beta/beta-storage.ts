import { getEncryptedAccountStorage } from '@/lib/storage/account-storage';
import { createEmptyBetaQualityMetrics } from './domain/quality-metrics';
import type {
  BetaClarification,
  BetaConfirmationEvent,
  BetaConflict,
  BetaFeedbackEvent,
  BetaLearningRule,
  BetaQualityMetrics,
  BetaSessionState,
  BetaStorageState,
} from './types';

export const BETA_STORAGE_KEY = 'natural-language-addition-beta.v1';

export function createEmptyNaturalLanguageAdditionBetaState(): BetaStorageState {
  return {
    version: 1,
    session: null,
    learningRules: [],
    confirmations: [],
    conflicts: [],
    clarifications: [],
    consent: {
      qualityMetrics: 'undecided',
      contentData: 'undecided',
      automaticApplication: 'undecided',
    },
    feedback: [],
    qualityMetrics: createEmptyBetaQualityMetrics(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConsentValue(value: unknown): value is 'undecided' | 'granted' | 'revoked' {
  return value === 'undecided' || value === 'granted' || value === 'revoked';
}

function isBetaSessionState(value: unknown): value is BetaSessionState {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.source === 'text' || value.source === 'speech') &&
    typeof value.startedAt === 'string'
  );
}

function isBetaLearningRule(value: unknown): value is BetaLearningRule {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.itemName === 'string' &&
    (value.brand === null || typeof value.brand === 'string') &&
    typeof value.targetListId === 'string' &&
    typeof value.confirmationCount === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isBetaConfirmationEvent(value: unknown): value is BetaConfirmationEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.itemName === 'string' &&
    (value.brand === null || typeof value.brand === 'string') &&
    (value.targetListId === null || typeof value.targetListId === 'string') &&
    (value.result === 'confirmed' || value.result === 'corrected' || value.result === 'deferred') &&
    typeof value.createdAt === 'string'
  );
}

function isBetaConflict(value: unknown): value is BetaConflict {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.itemName === 'string' &&
    (value.brand === null || typeof value.brand === 'string') &&
    Array.isArray(value.candidateListIds) &&
    value.candidateListIds.every((entry) => typeof entry === 'string') &&
    (value.resolution === 'open' || value.resolution === 'resolved') &&
    typeof value.createdAt === 'string'
  );
}

function isBetaClarification(value: unknown): value is BetaClarification {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.itemName === 'string' &&
    Array.isArray(value.candidateListIds) &&
    value.candidateListIds.every((entry) => typeof entry === 'string') &&
    (value.resolution === 'pending' ||
      value.resolution === 'confirmed' ||
      value.resolution === 'deferred') &&
    typeof value.createdAt === 'string'
  );
}

function isBetaFeedbackEvent(value: unknown): value is BetaFeedbackEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    (value.kind === 'accepted' || value.kind === 'corrected' || value.kind === 'skipped') &&
    typeof value.createdAt === 'string'
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isBetaQualityMetrics(value: unknown): value is BetaQualityMetrics {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.confirmedItemCount) &&
    isNonNegativeInteger(value.automaticAssignmentCount) &&
    isNonNegativeInteger(value.correctAutomaticAssignmentCount) &&
    isNonNegativeInteger(value.falseListAssignmentCount) &&
    isNonNegativeInteger(value.manualCorrectionCount) &&
    Array.isArray(value.completionDurationsMs) &&
    value.completionDurationsMs.every(
      (duration) => typeof duration === 'number' && Number.isFinite(duration) && duration >= 0,
    ) &&
    Array.isArray(value.recordedObservationIds) &&
    value.recordedObservationIds.every((id) => typeof id === 'string') &&
    Array.isArray(value.measuredSessionIds) &&
    value.measuredSessionIds.every((id) => typeof id === 'string')
  );
}

type PersistedBetaStorageState = Omit<BetaStorageState, 'consent' | 'qualityMetrics'> & {
  qualityMetrics?: BetaStorageState['qualityMetrics'];
  consent: Omit<BetaStorageState['consent'], 'automaticApplication'> & {
    automaticApplication?: BetaStorageState['consent']['automaticApplication'];
  };
};

function isBetaStorageState(value: unknown): value is PersistedBetaStorageState {
  if (!isRecord(value) || value.version !== 1) return false;
  if (value.session !== null && !isBetaSessionState(value.session)) return false;
  if (!Array.isArray(value.learningRules) || !value.learningRules.every(isBetaLearningRule)) {
    return false;
  }
  if (!Array.isArray(value.confirmations) || !value.confirmations.every(isBetaConfirmationEvent)) {
    return false;
  }
  if (!Array.isArray(value.conflicts) || !value.conflicts.every(isBetaConflict)) return false;
  if (!Array.isArray(value.clarifications) || !value.clarifications.every(isBetaClarification)) {
    return false;
  }
  if (!Array.isArray(value.feedback) || !value.feedback.every(isBetaFeedbackEvent)) return false;
  if (value.qualityMetrics !== undefined && !isBetaQualityMetrics(value.qualityMetrics)) {
    return false;
  }
  if (!isRecord(value.consent)) return false;

  const consent = value.consent;
  return (
    isConsentValue(consent.qualityMetrics) &&
    isConsentValue(consent.contentData) &&
    (consent.automaticApplication === undefined || isConsentValue(consent.automaticApplication))
  );
}

function normalizeBetaStorageState(state: PersistedBetaStorageState): BetaStorageState {
  return {
    ...state,
    qualityMetrics: state.qualityMetrics ?? createEmptyBetaQualityMetrics(),
    consent: {
      ...state.consent,
      automaticApplication: state.consent.automaticApplication ?? 'undecided',
    },
  };
}

export async function getNaturalLanguageAdditionBetaState(
  userId: string,
): Promise<BetaStorageState> {
  const storage = await getEncryptedAccountStorage(userId);
  const serializedState = storage.getString(BETA_STORAGE_KEY);
  if (!serializedState) return createEmptyNaturalLanguageAdditionBetaState();

  try {
    const parsedState: unknown = JSON.parse(serializedState);
    if (isBetaStorageState(parsedState)) return normalizeBetaStorageState(parsedState);
  } catch {
    // Ein beschädigter lokaler Snapshot darf den Beta-Workflow nicht öffnen.
  }

  storage.remove(BETA_STORAGE_KEY);
  return createEmptyNaturalLanguageAdditionBetaState();
}

export async function saveNaturalLanguageAdditionBetaState(
  userId: string,
  state: BetaStorageState,
): Promise<void> {
  const storage = await getEncryptedAccountStorage(userId);
  storage.set(BETA_STORAGE_KEY, JSON.stringify(state));
}

export async function clearNaturalLanguageAdditionBetaState(userId: string): Promise<void> {
  const storage = await getEncryptedAccountStorage(userId);
  storage.remove(BETA_STORAGE_KEY);
}
