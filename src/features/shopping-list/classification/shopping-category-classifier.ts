import { CLASSIFIER_VERSION } from './classifier-version';
import { NAME_CATEGORY_RULES } from './name-category-rules';
import { normalizeShoppingName } from './normalize-shopping-name';
import { OFF_CATEGORY_RULES } from './off-category-rules';
import type { ShoppingCategoryId } from './shopping-category-id';
import type {
  CategoryCandidate,
  CategoryClassification,
  CategoryClassifierInput,
  CategoryTrace,
  RejectedCategoryCandidate,
} from './types';

function matchOffTagCandidates(categoryTags: readonly string[]): CategoryCandidate[] {
  const candidates: CategoryCandidate[] = [];
  for (const tag of categoryTags) {
    for (const rule of OFF_CATEGORY_RULES) {
      if (rule.tag === tag) {
        candidates.push({
          kind: 'off_tag',
          categoryId: rule.categoryId,
          value: tag,
          weight: rule.priority,
        });
      }
    }
  }
  return candidates;
}

/** Präfix- und Suffixregeln matchen nur echt längere Tokens. */
function matchNameCandidates(tokens: readonly string[]): CategoryCandidate[] {
  const candidates: CategoryCandidate[] = [];
  for (const token of tokens) {
    for (const rule of NAME_CATEGORY_RULES) {
      const isLonger = token.length > rule.value.length;
      const matches =
        rule.match === 'word'
          ? token === rule.value
          : rule.match === 'word-start'
            ? isLonger && token.startsWith(rule.value)
            : isLonger && token.endsWith(rule.value);
      if (matches) {
        candidates.push({
          kind: 'name_rule',
          categoryId: rule.categoryId,
          value: rule.value,
          weight: rule.score,
        });
      }
    }
  }
  return candidates;
}

type PhaseResult = {
  bestByCategory: ReadonlyMap<ShoppingCategoryId, CategoryCandidate>;
  topWeight: number | null;
  winner: CategoryCandidate | null;
  tied: boolean;
};

/** Bei gleichem Höchstgewicht verschiedener Kategorien gibt es keinen Gewinner. */
function resolvePhase(candidates: readonly CategoryCandidate[]): PhaseResult {
  const bestByCategory = new Map<ShoppingCategoryId, CategoryCandidate>();
  for (const candidate of candidates) {
    const current = bestByCategory.get(candidate.categoryId);
    if (!current || candidate.weight > current.weight) {
      bestByCategory.set(candidate.categoryId, candidate);
    }
  }

  const ranked = [...bestByCategory.values()].sort((a, b) => b.weight - a.weight);
  const [top, runnerUp] = ranked;
  if (!top) return { bestByCategory, topWeight: null, winner: null, tied: false };

  const tied = runnerUp !== undefined && runnerUp.weight === top.weight;
  return { bestByCategory, topWeight: top.weight, winner: tied ? null : top, tied };
}

function rejectedCandidatesOf(
  candidates: readonly CategoryCandidate[],
  phase: PhaseResult,
  lowerReason: 'lower_priority' | 'lower_score',
): RejectedCategoryCandidate[] {
  return candidates
    .filter((candidate) => candidate !== phase.winner)
    .map((candidate) => ({
      ...candidate,
      reason: candidate.weight === phase.topWeight ? 'tie' : lowerReason,
    }));
}

function describeTie(phase: PhaseResult, label: string): string {
  const tiedCategories = [...phase.bestByCategory.values()]
    .filter((candidate) => candidate.weight === phase.topWeight)
    .map((candidate) => candidate.categoryId);
  return `${label} mehrdeutig: ${tiedCategories.join(' vs. ')} (Gewicht ${phase.topWeight})`;
}

type Resolution = {
  classification: CategoryClassification;
  candidates: CategoryCandidate[];
  rejectedCandidates: RejectedCategoryCandidate[];
  conflictReason: string | null;
};

/** Der Namens-Fallback läuft nur ohne eindeutigen OFF-Gewinner. */
function resolve(input: CategoryClassifierInput): Resolution {
  const offCandidates = matchOffTagCandidates(input.categoryTags ?? []);
  const offPhase = resolvePhase(offCandidates);

  if (offPhase.winner) {
    return {
      classification: {
        categoryId: offPhase.winner.categoryId,
        source: 'off_taxonomy',
        classifierVersion: CLASSIFIER_VERSION,
        evidence: { kind: 'off_tag', value: offPhase.winner.value },
      },
      candidates: offCandidates,
      rejectedCandidates: rejectedCandidatesOf(offCandidates, offPhase, 'lower_priority'),
      conflictReason: null,
    };
  }

  const nameTokens = normalizeShoppingName(input.name);
  const nameCandidates = matchNameCandidates(nameTokens);
  const namePhase = resolvePhase(nameCandidates);
  const candidates = [...offCandidates, ...nameCandidates];
  const rejectedCandidates = [
    ...rejectedCandidatesOf(offCandidates, offPhase, 'lower_priority'),
    ...rejectedCandidatesOf(nameCandidates, namePhase, 'lower_score'),
  ];

  if (namePhase.winner) {
    return {
      classification: {
        categoryId: namePhase.winner.categoryId,
        source: 'name_fallback',
        classifierVersion: CLASSIFIER_VERSION,
        evidence: { kind: 'name_rule', value: namePhase.winner.value },
      },
      candidates,
      rejectedCandidates,
      conflictReason: null,
    };
  }

  const conflictReason = offPhase.tied
    ? describeTie(offPhase, 'OFF-Tags')
    : namePhase.tied
      ? describeTie(namePhase, 'Namens-Fallback')
      : null;

  return {
    classification: { categoryId: null, source: null, classifierVersion: CLASSIFIER_VERSION },
    candidates,
    rejectedCandidates,
    conflictReason,
  };
}

export function classifyCategory(input: CategoryClassifierInput): CategoryClassification {
  return resolve(input).classification;
}

/** Liefert zusätzlich die Entscheidungskette für Diagnosewerkzeuge. */
export function explainCategory(input: CategoryClassifierInput): CategoryTrace {
  const { classification, candidates, rejectedCandidates, conflictReason } = resolve(input);
  const normalizedTokens = normalizeShoppingName(input.name);

  return {
    classifierVersion: CLASSIFIER_VERSION,
    input: {
      source: input.source ?? null,
      dataVersion: input.dataVersion ?? null,
      categoryTags: input.categoryTags ?? [],
      normalizedName: normalizedTokens.length > 0 ? normalizedTokens.join(' ') : null,
    },
    candidates,
    rejectedCandidates,
    winner: classification,
    conflictReason,
  };
}
