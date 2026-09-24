import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import type {
  BetaConfirmationEvent,
  BetaLearningRule,
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
    autoAssign: 'unset',
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAutoAssignState(value: unknown): value is BetaStorageState['autoAssign'] {
  return value === 'unset' || value === 'on' || value === 'off';
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

/** Normalize the legacy shape and persist only fields used by the product workflow. */
type PersistedBetaStorageState = {
  version: 1;
  session: BetaSessionState | null;
  learningRules: readonly BetaLearningRule[];
  confirmations: readonly BetaConfirmationEvent[];
  autoAssign?: BetaStorageState['autoAssign'];
  consent?: {
    automaticApplication?: 'undecided' | 'granted' | 'revoked';
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
  if (value.autoAssign !== undefined && !isAutoAssignState(value.autoAssign)) return false;
  if (value.consent !== undefined && !isRecord(value.consent)) return false;

  return (
    value.autoAssign !== undefined ||
    value.consent?.automaticApplication === undefined ||
    value.consent.automaticApplication === 'undecided' ||
    value.consent.automaticApplication === 'granted' ||
    value.consent.automaticApplication === 'revoked'
  );
}

function normalizeBetaStorageState(state: PersistedBetaStorageState): BetaStorageState {
  const legacyAutoAssign = state.consent?.automaticApplication;
  const autoAssign =
    state.autoAssign ??
    (legacyAutoAssign === 'granted' ? 'on' : legacyAutoAssign === 'revoked' ? 'off' : 'unset');

  return {
    version: 1,
    session: state.session,
    learningRules: state.learningRules,
    confirmations: state.confirmations,
    autoAssign,
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
    if (isBetaStorageState(parsedState)) {
      const normalizedState = normalizeBetaStorageState(parsedState);
      try {
        storage.set(BETA_STORAGE_KEY, JSON.stringify(normalizedState));
      } catch {
        // The cleaned in-memory state remains usable if local storage is unavailable.
      }
      return normalizedState;
    }
  } catch {
    // A damaged local snapshot must not open the speech workflow.
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
