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

/**
 * Gematchte Namens-Kandidaten über alle Tokens. `word` verlangt Gleichheit,
 * `word-start`/`word-end` verlangen ein echt längeres Token (sonst würde ein
 * exaktes Token doppelt sowohl als `word` als auch als `word-start` zählen).
 */
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

/**
 * Wertet eine Kandidatenliste einer Phase (OFF-Tags oder Namens-Fallback)
 * aus: pro Kategorie zählt nur ihr stärkstes Signal, gewonnen hat die
 * eindeutig höchste Kategorie. Bei Gleichstand des höchsten Gewichts
 * zwischen mehreren Kategorien gibt es keinen Gewinner — siehe Abschnitt
 * 7/8 des Plans.
 */
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

/**
 * Zentrale Auswertung, von der sich sowohl {@link classifyCategory} als auch
 * {@link explainCategory} ableiten. Namens-Fallback wird nur ausgeführt, wenn
 * die OFF-Taxonomie kein eindeutiges Ergebnis liefert (Abschnitt 3 des
 * Plans) — der Trace bildet exakt diesen tatsächlichen Auswertungspfad ab,
 * keine hypothetische Zusatzauswertung.
 */
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

/**
 * Reine, automatische Klassifikationspipeline (OFF-Taxonomie → Namens-Fallback
 * → „Sonstiges"). Deckt ausschließlich die Schritte 4–6 der Auflösungsreihenfolge
 * aus `docs/issue#223_V2.md` Abschnitt 3 ab — manuelle Auswahl und
 * Haushaltspräferenzen (Schritte 1–3) liegen bewusst in `preferences/`.
 */
export function classifyCategory(input: CategoryClassifierInput): CategoryClassification {
  return resolve(input).classification;
}

/**
 * Wie {@link classifyCategory}, liefert aber zusätzlich die vollständige
 * Entscheidungskette (Kandidaten, verworfene Kandidaten, Konfliktgrund) für
 * Tests, Debugger und CLI. Nicht für Sync oder Speicherung gedacht.
 */
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
