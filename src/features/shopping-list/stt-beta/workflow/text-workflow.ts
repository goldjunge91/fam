import { canAutoAssign, shouldAskForAutoAssign } from '../domain/auto-assign';
import { parseNaturalLanguageShoppingInput } from '../domain/parser';
import type { ShoppingListCatalogEntry } from '../domain/routing';
import {
  getLearningProgress,
  recordRoutingConfirmation,
  routeShoppingItem,
} from '../domain/routing';
import type {
  BetaPreviewItem,
  BetaStorageState,
  ConfirmedBetaOutput,
  NaturalLanguageAdditionInput,
  ParseResult,
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
  shouldAskForAutoAssign: boolean;
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
    },
  });
  return { kind: 'preview', preview };
}

export async function createBetaPreview(input: CreateBetaPreviewInput): Promise<TextBetaPreview> {
  const state = await input.storage.load();
  const parseResult = parseNaturalLanguageShoppingInput(input.input.text);
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
      allowAutoAssign: canAutoAssign(state.autoAssign),
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

/** Correct only the selected name; quantities and the original transcript stay intact. */
export function correctBetaPreviewItem(input: {
  preview: TextBetaPreview;
  itemId: string;
  name: string;
  lists: readonly ShoppingListCatalogEntry[];
  state: BetaStorageState;
}): TextBetaPreview {
  const name = input.name.trim();
  if (!name || !/[\p{L}]/u.test(name)) throw new Error('Bitte einen Artikelnamen eingeben.');
  if (input.state.session?.id !== input.preview.session.id) {
    throw new Error('Die Vorschau ist nicht mehr aktuell.');
  }
  if (!input.preview.items.some((entry) => entry.itemId === input.itemId)) {
    throw new Error('Artikel nicht gefunden.');
  }
  return {
    ...input.preview,
    items: input.preview.items.map((entry) => {
      if (entry.itemId !== input.itemId) return entry;
      const item = { ...entry.item, name };
      return {
        ...entry,
        originalName: entry.originalName ?? entry.item.name,
        item,
        routing: routeShoppingItem({
          item,
          lists: input.lists,
          learningRules: input.state.learningRules,
          confirmations: input.state.confirmations,
          allowAutoAssign: canAutoAssign(input.state.autoAssign),
        }),
      };
    }),
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
    !canAutoAssign(state.autoAssign) &&
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
      shouldAskForAutoAssign: false,
    };
  }

  const saveResult = await input.saveConfirmedOutput(output);
  const confirmedAt = input.confirmedAt ?? new Date().toISOString();
  let nextState = state;
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
  }
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
      shouldAskForAutoAssign: false,
    };
  }

  return {
    output,
    saveResult,
    state: nextState,
    shouldAskForAutoAssign: shouldAskForAutoAssign({
      progress: getLearningProgress(nextState.confirmations),
      autoAssign: nextState.autoAssign,
    }),
  };
}
