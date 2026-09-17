import type {
  BetaConfirmationEvent,
  BetaLearningRule,
  BetaStorageState,
  ParsedShoppingItem,
  RoutingDecision,
  ShoppingListSuggestion,
} from '../types';

export type ShoppingListCatalogEntry = {
  listId: string;
  listName: string;
  knownBrands: readonly string[];
};

export type RouteShoppingItemInput = {
  item: ParsedShoppingItem;
  lists: readonly ShoppingListCatalogEntry[];
  learningRules: readonly BetaLearningRule[];
  confirmations: readonly BetaConfirmationEvent[];
};

const KNOWN_BRAND_CONFIDENCE = 0.95;
const ALTERNATIVE_CONFIDENCE = 0.25;
const LEARNED_CONFIDENCE = 0.85;

export const MIN_UNIQUE_ASSIGNMENTS_FOR_LEARNING = 10;
export const MIN_SEPARATE_CONFIRMATIONS_FOR_RULE = 3;

export type ShoppingLearningProgress = {
  uniqueAssignments: number;
  thresholdReached: boolean;
};

export type RecordRoutingConfirmationInput = {
  state: BetaStorageState;
  eventId: string;
  sessionId: string;
  item: ParsedShoppingItem;
  targetListId: string | null;
  result: BetaConfirmationEvent['result'];
  createdAt: string;
};

export type RecordRoutingConfirmationResult = {
  state: BetaStorageState;
  learningRule: BetaLearningRule | null;
  progress: ShoppingLearningProgress;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE');
}

function assignmentKey(itemName: string, brand: string | null): string {
  return `${normalize(itemName)}\u0000${brand ? normalize(brand) : ''}`;
}

function isCountableConfirmation(event: BetaConfirmationEvent): boolean {
  return event.targetListId !== null && event.result !== 'deferred';
}

function countDistinctTargetSessions(
  confirmations: readonly BetaConfirmationEvent[],
): readonly { targetListId: string; count: number }[] {
  const sessionsByTarget = new Map<string, Set<string>>();
  for (const confirmation of confirmations) {
    if (!isCountableConfirmation(confirmation) || !confirmation.targetListId) continue;
    const sessions = sessionsByTarget.get(confirmation.targetListId) ?? new Set<string>();
    sessions.add(confirmation.sessionId);
    sessionsByTarget.set(confirmation.targetListId, sessions);
  }

  return [...sessionsByTarget.entries()]
    .map(([targetListId, sessions]) => ({ targetListId, count: sessions.size }))
    .sort(
      (left, right) =>
        right.count - left.count || left.targetListId.localeCompare(right.targetListId),
    );
}

function matchingConfirmations(
  item: ParsedShoppingItem,
  confirmations: readonly BetaConfirmationEvent[],
): readonly BetaConfirmationEvent[] {
  const itemName = normalize(item.name);
  const brand = item.brand ? normalize(item.brand) : null;
  return confirmations.filter(
    (confirmation) =>
      isCountableConfirmation(confirmation) &&
      normalize(confirmation.itemName) === itemName &&
      (brand === null || (confirmation.brand !== null && normalize(confirmation.brand) === brand)),
  );
}

function suggestion(list: ShoppingListCatalogEntry, confidence: number): ShoppingListSuggestion {
  return { listId: list.listId, listName: list.listName, confidence };
}

function uncertainDecision(
  item: ParsedShoppingItem,
  suggestions: readonly ShoppingListSuggestion[],
  kind: 'uncertain' | 'conflict' = 'uncertain',
): RoutingDecision {
  return {
    kind,
    item,
    listId: null,
    confidence: suggestions[0]?.confidence ?? 0,
    bestMatch: suggestions[0] ?? null,
    suggestions,
    needsClarification: true,
  };
}

function candidateDecision(
  input: RouteShoppingItemInput,
  candidates: readonly { targetListId: string; count: number }[],
  canResolve: boolean,
): RoutingDecision | null {
  const suggestions = candidates.flatMap((candidate) => {
    const list = input.lists.find((entry) => entry.listId === candidate.targetListId);
    return list ? [suggestion(list, LEARNED_CONFIDENCE)] : [];
  });
  if (suggestions.length === 0) return null;

  const [best, second] = candidates;
  if (canResolve && best && (!second || best.count > second.count)) {
    const bestMatch = suggestions[0];
    return {
      kind: 'resolved',
      item: input.item,
      listId: bestMatch.listId,
      confidence: bestMatch.confidence,
      bestMatch,
      suggestions,
      needsClarification: false,
    };
  }

  return uncertainDecision(
    input.item,
    suggestions,
    candidates.length > 1 ? 'conflict' : 'uncertain',
  );
}

function routeFromConfirmationHistory(input: RouteShoppingItemInput): RoutingDecision | null {
  const confirmations = matchingConfirmations(input.item, input.confirmations);
  if (confirmations.length === 0) return null;
  const candidates = countDistinctTargetSessions(confirmations);
  const progress = getLearningProgress(input.confirmations);
  return candidateDecision(
    input,
    candidates,
    progress.thresholdReached && candidates[0]?.count >= 3,
  );
}

function routeFromLearningRules(input: RouteShoppingItemInput): RoutingDecision | null {
  const itemName = normalize(input.item.name);
  const brand = input.item.brand ? normalize(input.item.brand) : null;
  const candidates = input.learningRules
    .filter(
      (rule) =>
        rule.confirmationCount >= MIN_SEPARATE_CONFIRMATIONS_FOR_RULE &&
        normalize(rule.itemName) === itemName &&
        (brand === null || (rule.brand !== null && normalize(rule.brand) === brand)),
    )
    .map((rule) => ({ targetListId: rule.targetListId, count: rule.confirmationCount }));
  return candidateDecision(input, candidates, true);
}

export function getLearningProgress(
  confirmations: readonly BetaConfirmationEvent[],
): ShoppingLearningProgress {
  const uniqueAssignments = new Set(
    confirmations
      .filter(isCountableConfirmation)
      .map((confirmation) => assignmentKey(confirmation.itemName, confirmation.brand)),
  ).size;
  return {
    uniqueAssignments,
    thresholdReached: uniqueAssignments >= MIN_UNIQUE_ASSIGNMENTS_FOR_LEARNING,
  };
}

function deriveLearningRules(
  state: BetaStorageState,
  confirmations: readonly BetaConfirmationEvent[],
  createdAt: string,
): readonly BetaLearningRule[] {
  const progress = getLearningProgress(confirmations);
  const assignments = new Map<string, { itemName: string; brand: string | null }>();
  for (const confirmation of confirmations) {
    if (isCountableConfirmation(confirmation)) {
      assignments.set(assignmentKey(confirmation.itemName, confirmation.brand), {
        itemName: confirmation.itemName,
        brand: confirmation.brand,
      });
    }
  }

  const derivedRules: BetaLearningRule[] = [];
  for (const [key, assignment] of assignments) {
    const related = confirmations.filter(
      (confirmation) =>
        isCountableConfirmation(confirmation) &&
        assignmentKey(confirmation.itemName, confirmation.brand) === key,
    );
    const [best, second] = countDistinctTargetSessions(related);
    if (
      !progress.thresholdReached ||
      !best ||
      best.count < MIN_SEPARATE_CONFIRMATIONS_FOR_RULE ||
      (second !== undefined && best.count <= second.count)
    ) {
      continue;
    }

    const existing = state.learningRules.find(
      (rule) =>
        assignmentKey(rule.itemName, rule.brand) === key && rule.targetListId === best.targetListId,
    );
    derivedRules.push({
      id: existing?.id ?? `natural-language-addition-beta-rule:${key}:${best.targetListId}`,
      itemName: assignment.itemName,
      brand: assignment.brand,
      targetListId: best.targetListId,
      confirmationCount: best.count,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt: createdAt,
    });
  }

  const knownKeys = new Set(assignments.keys());
  return [
    ...state.learningRules.filter(
      (rule) => !knownKeys.has(assignmentKey(rule.itemName, rule.brand)),
    ),
    ...derivedRules,
  ];
}

export function recordRoutingConfirmation(
  input: RecordRoutingConfirmationInput,
): RecordRoutingConfirmationResult {
  if (input.result === 'deferred' && input.targetListId !== null) {
    throw new Error('Deferred routing confirmations must not have a target list');
  }
  if (input.result !== 'deferred' && input.targetListId === null) {
    throw new Error('Confirmed routing confirmations require a target list');
  }

  const event: BetaConfirmationEvent = {
    id: input.eventId,
    sessionId: input.sessionId,
    itemName: input.item.name,
    brand: input.item.brand,
    targetListId: input.targetListId,
    result: input.result,
    createdAt: input.createdAt,
  };
  const confirmations = [...input.state.confirmations, event];
  const state: BetaStorageState = {
    ...input.state,
    confirmations,
    learningRules: deriveLearningRules(input.state, confirmations, input.createdAt),
  };
  const learningRule = state.learningRules.find(
    (rule) =>
      assignmentKey(rule.itemName, rule.brand) === assignmentKey(input.item.name, input.item.brand),
  );

  return {
    state,
    learningRule: learningRule ?? null,
    progress: getLearningProgress(confirmations),
  };
}

export function routeShoppingItem(input: RouteShoppingItemInput): RoutingDecision {
  const historyDecision = routeFromConfirmationHistory(input);
  if (historyDecision?.kind === 'conflict' || historyDecision?.kind === 'resolved') {
    return historyDecision;
  }

  const learnedRuleDecision = routeFromLearningRules(input);
  if (learnedRuleDecision?.kind === 'conflict' || learnedRuleDecision?.kind === 'resolved') {
    return learnedRuleDecision;
  }

  const brand = input.item.brand ? normalize(input.item.brand) : null;
  const brandMatches = brand
    ? input.lists.filter((list) =>
        list.knownBrands.some((knownBrand) => normalize(knownBrand) === brand),
      )
    : [];

  if (brandMatches.length === 1) {
    const bestMatch = suggestion(brandMatches[0], KNOWN_BRAND_CONFIDENCE);
    return {
      kind: 'resolved',
      item: input.item,
      listId: bestMatch.listId,
      confidence: bestMatch.confidence,
      bestMatch,
      suggestions: [bestMatch],
      needsClarification: false,
    };
  }

  if (brandMatches.length > 1) {
    return uncertainDecision(
      input.item,
      brandMatches.map((list) => suggestion(list, KNOWN_BRAND_CONFIDENCE)),
      'conflict',
    );
  }

  if (historyDecision) return historyDecision;
  if (learnedRuleDecision) return learnedRuleDecision;

  return uncertainDecision(
    input.item,
    input.lists.map((list) => suggestion(list, ALTERNATIVE_CONFIDENCE)),
  );
}
