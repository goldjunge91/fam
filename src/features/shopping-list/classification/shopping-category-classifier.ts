import { CLASSIFIER_VERSION } from './classifier-version';
import { NAME_CATEGORY_RULES } from './name-category-rules';
import { normalizeShoppingName } from './normalize-shopping-name';
import { OFF_CATEGORY_RULES } from './off-category-rules';
import { normalizePlacementZoneId } from './placement-taxonomy';
import type { ShoppingCategoryId } from './shopping-category-id';
import type {
  CategoryCandidate,
  CategoryClassification,
  CategoryClassifierInput,
  CategoryTrace,
  RejectedCategoryCandidate,
} from './types';

/** Gematchte OFF-Tag-Kandidaten für die übergebenen `categoryTags`. */
function matchOffTagCandidates(categoryTags: readonly string[]): CategoryCandidate[] {
  const candidates: CategoryCandidate[] = [];
  for (const tag of categoryTags) {
    for (const rule of OFF_CATEGORY_RULES) {
      if (rule.tag === tag) {
        const categoryId = normalizePlacementZoneId(rule.categoryId);
        if (categoryId) {
          candidates.push({
            kind: 'off_tag',
            categoryId,
            value: tag,
            weight: rule.priority,
          });
        }
      }
    }
  }
  return candidates;
}

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
        const categoryId = normalizePlacementZoneId(rule.categoryId);
        if (categoryId) {
          candidates.push({
            kind: 'name_rule',
            categoryId,
            value: rule.value,
            weight: rule.score,
          });
        }
      }
    }
  }
  return candidates;
}

type PhaseResult = {
  /** Pro Kategorie nur das stärkste Signal — Grundlage für Gewinner und Tie-Erkennung. */
  bestByCategory: ReadonlyMap<ShoppingCategoryId, CategoryCandidate>;
  topWeight: number | null;
  winner: CategoryCandidate | null;
  /** Echter Gleichstand: mehrere Kategorien teilen sich das höchste Gewicht. */
  tied: boolean;
};

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

/** Nicht gewonnene Kandidaten einer Phase mit Begründung. */
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

function resolve(input: CategoryClassifierInput): Resolution {
  const nameTokens = normalizeShoppingName(input.name);
  const nameCandidates = matchNameCandidates(nameTokens);
  const namePhase = resolvePhase(nameCandidates);

  const offCandidates = matchOffTagCandidates(input.categoryTags ?? []);
  const offPhase = resolvePhase(offCandidates);

  // Explizite Namens-Marker (z.B. Tiefkühl-/Tiefgefroren-Marker mit score >= 120)
  // schlagen generische OFF-Tags.
  if (namePhase.winner && namePhase.winner.weight >= 120) {
    const candidates = [...offCandidates, ...nameCandidates];
    const rejectedCandidates = [
      ...rejectedCandidatesOf(offCandidates, offPhase, 'lower_priority'),
      ...rejectedCandidatesOf(nameCandidates, namePhase, 'lower_score'),
    ];
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
