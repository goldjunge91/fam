export type BetaInputSource = 'text' | 'speech';

/** Eingabe, die der gemeinsame Beta-Workflow an den Parser übergibt. */
export type NaturalLanguageAdditionInput =
  | {
      source: 'text';
      text: string;
      locale: string | null;
    }
  | {
      source: 'speech';
      text: string;
      locale: string | null;
      onDevice: true;
    };

export type SpeechInputResult =
  | {
      status: 'transcript';
      text: string;
      locale: string | null;
      onDevice: true;
      error: null;
    }
  | {
      status:
        | 'capability-unavailable'
        | 'permission-denied'
        | 'consent-required'
        | 'cancelled'
        | 'error';
      text: null;
      locale: string | null;
      onDevice: false;
      error: string;
      errorCode?: string;
    };

export type ParsedShoppingItem = {
  name: string;
  quantity: number;
  unit: string | null;
  brand: string | null;
};

export type ParseResult = {
  items: readonly ParsedShoppingItem[];
  unparsedText: string | null;
};

export type ShoppingListSuggestion = {
  listId: string;
  listName: string;
  confidence: number;
};

export type RoutingDecision =
  | {
      kind: 'resolved';
      item: ParsedShoppingItem;
      listId: string;
      confidence: number;
      bestMatch: ShoppingListSuggestion;
      suggestions: readonly ShoppingListSuggestion[];
      needsClarification: false;
      /** True when the resolved target came from a learned mapping. */
      automatic?: boolean;
    }
  | {
      kind: 'uncertain' | 'conflict';
      item: ParsedShoppingItem;
      listId: null;
      confidence: number;
      bestMatch: ShoppingListSuggestion | null;
      suggestions: readonly ShoppingListSuggestion[];
      needsClarification: true;
      automatic?: boolean;
    };

export type BetaItemReviewState = 'pending' | 'confirmed' | 'deferred';

export type BetaPreviewItem = {
  itemId: string;
  item: ParsedShoppingItem;
  routing: RoutingDecision;
  reviewState: BetaItemReviewState;
};

/** Die einzige Form, die der produktive Shopping-List-Adapter akzeptiert. */
export type ConfirmedBetaItem = {
  confirmation: 'confirmed';
  item: ParsedShoppingItem;
  targetListId: string;
};

export type ConfirmedBetaOutput = {
  betaSessionId: string;
  source: BetaInputSource;
  items: readonly ConfirmedBetaItem[];
};

export type BetaSessionState = {
  id: string;
  source: BetaInputSource;
  startedAt: string;
};

export type BetaLearningRule = {
  id: string;
  itemName: string;
  brand: string | null;
  targetListId: string;
  confirmationCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BetaConfirmationEvent = {
  id: string;
  sessionId: string;
  itemName: string;
  brand: string | null;
  targetListId: string | null;
  result: 'confirmed' | 'corrected' | 'deferred';
  createdAt: string;
};

export type BetaConsentState = {
  /** Per-user permission to apply learned household mappings automatically. */
  automaticApplication: 'undecided' | 'granted' | 'revoked';
};

export type BetaStorageState = {
  version: 1;
  session: BetaSessionState | null;
  learningRules: readonly BetaLearningRule[];
  confirmations: readonly BetaConfirmationEvent[];
  consent: BetaConsentState;
};
