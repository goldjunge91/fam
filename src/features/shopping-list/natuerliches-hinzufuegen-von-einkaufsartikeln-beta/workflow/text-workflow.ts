import { debugLogEvent } from '@/lib/observability/debug-log';
import {
  canAutomaticallyApplyLearning,
  recordBetaFeedback,
  shouldAskForAutomaticApplication,
} from '../domain/consent';
import { parseNaturalLanguageShoppingInput } from '../domain/parser';
import {
  type BetaQualityObservation,
  getBetaCompletionDurationMs,
  recordBetaQualityObservations,
} from '../domain/quality-metrics';
import type { ShoppingListCatalogEntry } from '../domain/routing';
import {
  getLearningProgress,
  recordRoutingConfirmation,
  routeShoppingItem,
} from '../domain/routing';
import {
  appendSpeechParseDiagnostic,
  createSpeechParseDiagnosticRecord,
} from '../services/speech-diagnostics';
import type {
  BetaPreviewItem,
  BetaStorageState,
  ConfirmedBetaOutput,
  NaturalLanguageAdditionInput,
  ParseResult,
  QualityFlag,
  ShoppingListSuggestion,
  SpeechInputResult,
} from '../types';

export type TextBetaStorage = {
  load: () => Promise<BetaStorageState>;
  save: (state: BetaStorageState) => Promise<void>;
};

export type TextBetaOutputSaveResult = {
  savedItemCount: number;
  mutationCount: number;
  itemIds: readonly string[];
};

export type TextBetaOutputSaver = (
  output: ConfirmedBetaOutput,
) => Promise<TextBetaOutputSaveResult>;

export type TextBetaPreview = {
  session: NonNullable<BetaStorageState['session']>;
  input: NaturalLanguageAdditionInput;
  parseResult: ParseResult;
  items: readonly BetaPreviewItem[];
  learningProgress: ReturnType<typeof getLearningProgress>;
};

export type CreateTextBetaPreviewInput = {
  text: string;
  betaSessionId: string;
  startedAt: string;
  lists: readonly ShoppingListCatalogEntry[];
  storage: TextBetaStorage;
};

export type CreateSpeechBetaPreviewInput = Omit<CreateTextBetaPreviewInput, 'text'> & {
  speechResult: SpeechInputResult;
};

export type SpeechBetaPreviewResult =
  | { kind: 'preview'; preview: TextBetaPreview }
  | { kind: 'unavailable'; speechResult: SpeechInputResult };

export type TextBetaSelection = {
  itemId: string;
  targetListId: string;
};

export type TextBetaQualitySelection = {
  previewItem: BetaPreviewItem;
  targetListId: string;
};

export function createTextBetaQualityObservations(
  preview: TextBetaPreview,
  selectedItems: readonly TextBetaQualitySelection[],
  confirmedAt: string,
  observationIdPrefix = 'quality',
): readonly BetaQualityObservation[] {
  const durationMs = getBetaCompletionDurationMs(preview.session.startedAt, confirmedAt);

  return selectedItems.map(({ previewItem, targetListId }) => {
    const assignmentWasCorrect =
      previewItem.routing.kind === 'resolved' && previewItem.routing.listId === targetListId;
    const qualityFlags = new Set<QualityFlag>(preview.parseResult.qualityFlags);
    if (previewItem.routing.kind === 'resolved' && !assignmentWasCorrect) {
      qualityFlags.add('incorrect_automatic_assignment');
    }
    if (!assignmentWasCorrect) qualityFlags.add('manual_correction');

    return {
      id: `${preview.session.id}:${observationIdPrefix}:${previewItem.itemId}`,
      sessionId: preview.session.id,
      predictedAutomatically: previewItem.routing.kind === 'resolved',
      assignmentCorrect: assignmentWasCorrect,
      manuallyCorrected: !assignmentWasCorrect,
      durationMs,
      qualityFlags: [...qualityFlags],
    };
  });
}

export type ConfirmTextBetaItemsInput = {
  preview: TextBetaPreview;
  selections: readonly TextBetaSelection[];
  availableTargetListIds?: readonly string[];
  storage: TextBetaStorage;
  saveConfirmedOutput: TextBetaOutputSaver;
  confirmedAt?: string;
};

export type ConfirmTextBetaItemsResult = {
  output: ConfirmedBetaOutput;
  saveResult: TextBetaOutputSaveResult;
  state: BetaStorageState;
  shouldAskForAutomaticApplication: boolean;
};

export type CreateBetaPreviewInput = Omit<CreateTextBetaPreviewInput, 'text'> & {
  input: NaturalLanguageAdditionInput;
};

function suggestionContains(
  suggestions: readonly ShoppingListSuggestion[],
  listId: string,
): boolean {
  return suggestions.some((suggestion) => suggestion.listId === listId);
}

export async function createTextBetaPreview(
  input: CreateTextBetaPreviewInput,
): Promise<TextBetaPreview> {
  return createBetaPreview({
    betaSessionId: input.betaSessionId,
    startedAt: input.startedAt,
    lists: input.lists,
    storage: input.storage,
    input: { source: 'text', text: input.text, locale: null },
  });
}

export async function createSpeechBetaPreview(
  input: CreateSpeechBetaPreviewInput,
): Promise<SpeechBetaPreviewResult> {
  const speechResult = input.speechResult;
  if (speechResult.status !== 'transcript') {
    return { kind: 'unavailable', speechResult };
  }
  const hasOnDeviceRecognition = Boolean(speechResult.onDevice);
  if (!hasOnDeviceRecognition) {
    return {
      kind: 'unavailable',
      speechResult: {
        status: 'capability-unavailable',
        text: null,
        locale: speechResult.locale,
        onDevice: false,
        error: 'On-Device-Spracherkennung ist für diesen Workflow erforderlich.',
        errorCode: 'on-device-required',
      },
    };
  }

  const preview = await createBetaPreview({
    betaSessionId: input.betaSessionId,
    startedAt: input.startedAt,
    lists: input.lists,
    storage: input.storage,
    input: {
      source: 'speech',
      text: speechResult.text,
      locale: speechResult.locale,
      onDevice: speechResult.onDevice,
      ...(speechResult.segments ? { segments: speechResult.segments } : {}),
    },
  });
  return { kind: 'preview', preview };
}

export async function createBetaPreview(input: CreateBetaPreviewInput): Promise<TextBetaPreview> {
  const state = await input.storage.load();
  const parseResult = parseNaturalLanguageShoppingInput(input.input.text);
  if (input.input.source === 'speech') {
    const diagnostic = createSpeechParseDiagnosticRecord({
      correlationId: input.betaSessionId,
      input: input.input,
      parseResult,
    });
    debugLogEvent('shopping-list.natural-language.parse.completed', diagnostic);
    appendSpeechParseDiagnostic(diagnostic);
  }
  const session = {
    id: input.betaSessionId,
    source: input.input.source,
    startedAt: input.startedAt,
  };
  const nextState: BetaStorageState = { ...state, session };
  await input.storage.save(nextState);

  const items = parseResult.items.map((item, index) => ({
    itemId: `${session.id}:item:${index}`,
    item,
    routing: routeShoppingItem({
      item,
      lists: input.lists,
      learningRules: state.learningRules,
      confirmations: state.confirmations,
      allowAutomaticApplication: canAutomaticallyApplyLearning(state.consent),
    }),
    reviewState: 'pending' as const,
  }));

  return {
    session,
    input: input.input,
    parseResult,
    items,
    learningProgress: getLearningProgress(state.confirmations),
  };
}

export async function confirmTextBetaItems(
  input: ConfirmTextBetaItemsInput,
): Promise<ConfirmTextBetaItemsResult> {
  const state = await input.storage.load();
  if (state.session?.id !== input.preview.session.id) {
    throw new Error('The Beta preview session is no longer active');
  }
  if (
    !canAutomaticallyApplyLearning(state.consent) &&
    input.preview.items.some((entry) => entry.routing.automatic === true)
  ) {
    throw new Error(
      'Die automatische Zuordnung wurde widerrufen. Bitte prüfe die Vorschau erneut.',
    );
  }

  const selectedIds = new Set<string>();
  const availableTargetListIds = new Set(input.availableTargetListIds ?? []);
  const selectedItems = input.selections.map((selection) => {
    if (selectedIds.has(selection.itemId)) {
      throw new Error(`Beta item selected twice: ${selection.itemId}`);
    }
    selectedIds.add(selection.itemId);

    const targetListId = selection.targetListId.trim();
    const previewItem = input.preview.items.find((entry) => entry.itemId === selection.itemId);
    if (!previewItem || !targetListId) {
      throw new Error('Beta confirmations require a preview item and target list');
    }
    const targetIsSuggested = suggestionContains(previewItem.routing.suggestions, targetListId);
    const targetIsAvailable = availableTargetListIds.has(targetListId);
    if (!targetIsSuggested && !targetIsAvailable) {
      throw new Error('Beta confirmation target must be one of the preview suggestions');
    }

    return {
      previewItem,
      targetListId,
    };
  });

  const output: ConfirmedBetaOutput = {
    betaSessionId: input.preview.session.id,
    source: input.preview.session.source,
    items: selectedItems.map(({ previewItem, targetListId }) => ({
      confirmation: 'confirmed' as const,
      item: previewItem.item,
      targetListId,
    })),
  };

  if (output.items.length === 0) {
    return {
      output,
      saveResult: { savedItemCount: 0, mutationCount: 0, itemIds: [] },
      state,
      shouldAskForAutomaticApplication: false,
    };
  }

  const saveResult = await input.saveConfirmedOutput(output);
  const confirmedAt = input.confirmedAt ?? new Date().toISOString();
  let nextState = state;
  const selectedItemIds = new Set(selectedItems.map(({ previewItem }) => previewItem.itemId));
  for (const { previewItem, targetListId } of selectedItems) {
    const assignmentWasCorrect =
      previewItem.routing.kind === 'resolved' && previewItem.routing.listId === targetListId;
    const result = assignmentWasCorrect ? 'confirmed' : 'corrected';
    nextState = recordRoutingConfirmation({
      state: nextState,
      eventId: `${input.preview.session.id}:confirmation:${previewItem.itemId}`,
      sessionId: input.preview.session.id,
      item: previewItem.item,
      targetListId,
      result,
      createdAt: confirmedAt,
    }).state;
    nextState = recordBetaFeedback(nextState, {
      id: `${input.preview.session.id}:feedback:${previewItem.itemId}`,
      sessionId: input.preview.session.id,
      kind: result === 'confirmed' ? 'accepted' : 'corrected',
      createdAt: confirmedAt,
    });
  }
  for (const previewItem of input.preview.items) {
    if (selectedItemIds.has(previewItem.itemId)) continue;
    nextState = recordBetaFeedback(nextState, {
      id: `${input.preview.session.id}:feedback:${previewItem.itemId}`,
      sessionId: input.preview.session.id,
      kind: 'skipped',
      createdAt: confirmedAt,
    });
  }
  nextState = recordBetaQualityObservations(
    nextState,
    createTextBetaQualityObservations(input.preview, selectedItems, confirmedAt),
  );
  // The shopping-list adapter is the durable user-visible commit. A failed
  // learning-state write must not make the user retry the same output and
  // merge the items a second time.
  try {
    await input.storage.save(nextState);
  } catch {
    return {
      output,
      saveResult,
      state,
      shouldAskForAutomaticApplication: false,
    };
  }

  return {
    output,
    saveResult,
    state: nextState,
    shouldAskForAutomaticApplication: shouldAskForAutomaticApplication({
      progress: getLearningProgress(nextState.confirmations),
      consent: nextState.consent,
    }),
  };
}
