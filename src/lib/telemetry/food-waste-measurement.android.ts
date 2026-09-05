export type WasteMeasurementDimension = 'mass' | 'volume' | 'count' | 'package' | 'portion';
export type WasteMeasurementUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'package' | 'portion';

export type WasteQuantity = {
  quantity: number;
  unit: WasteMeasurementUnit;
};

export type WasteOutcomeObservation = {
  /** Opaque internal grouping key; never send this value as telemetry. */
  outcomeKey: string;
  consumed: WasteQuantity | null;
  wasted: WasteQuantity | null;
};

export type WasteOutcomeMetrics = {
  primaryRescueRatio: number | null;
  rescueRatioByDimension: Partial<Record<WasteMeasurementDimension, number>>;
  knownOutcomeLotCount: number;
  rescuedLotCount: number;
  plausibilityRatio: number | null;
};

const MEASUREMENT_DEFINITIONS: ReadonlyMap<
  WasteMeasurementUnit,
  { dimension: WasteMeasurementDimension; factor: number }
> = new Map([
  ['g', { dimension: 'mass', factor: 1 }],
  ['kg', { dimension: 'mass', factor: 1_000 }],
  ['ml', { dimension: 'volume', factor: 1 }],
  ['l', { dimension: 'volume', factor: 1_000 }],
  ['piece', { dimension: 'count', factor: 1 }],
  ['package', { dimension: 'package', factor: 1 }],
  ['portion', { dimension: 'portion', factor: 1 }],
]);

type ComparableQuantity = {
  dimension: WasteMeasurementDimension;
  value: number;
};

function comparableQuantity(quantity: WasteQuantity | null): ComparableQuantity | null {
  if (quantity === null || !Number.isFinite(quantity.quantity) || quantity.quantity <= 0) {
    return null;
  }

  const definition = MEASUREMENT_DEFINITIONS.get(quantity.unit);
  if (definition === undefined) return null;

  const value = quantity.quantity * definition.factor;
  return Number.isFinite(value) ? { dimension: definition.dimension, value } : null;
}

/** Calculates outcome metrics without estimating unknown quantities or mixing dimensions. */
export function calculateWasteOutcomeMetrics(
  observations: readonly WasteOutcomeObservation[],
): WasteOutcomeMetrics {
  const consumedByDimension = new Map<WasteMeasurementDimension, number>();
  const wastedByDimension = new Map<WasteMeasurementDimension, number>();
  const outcomesByLot = new Map<string, { known: boolean; consumed: boolean; wasteReported: boolean }>();
  let hasIncompatibleDimension = false;

  for (const observation of observations) {
    const consumed = comparableQuantity(observation.consumed);
    const wasted = comparableQuantity(observation.wasted);
    const lot = outcomesByLot.get(observation.outcomeKey) ?? {
      known: false, consumed: false, wasteReported: false,
    };
    lot.known ||= consumed !== null || wasted !== null;
    lot.consumed ||= consumed !== null;
    // Invalid reported waste is unknown, not evidence that nothing was wasted.
    lot.wasteReported ||= observation.wasted !== null && observation.wasted.quantity !== 0;
    outcomesByLot.set(observation.outcomeKey, lot);

    if (consumed !== null && wasted !== null && consumed.dimension !== wasted.dimension) {
      hasIncompatibleDimension = true;
      continue;
    }
    if (consumed !== null) {
      consumedByDimension.set(
        consumed.dimension,
        (consumedByDimension.get(consumed.dimension) ?? 0) + consumed.value,
      );
    }
    if (wasted !== null) {
      wastedByDimension.set(
        wasted.dimension,
        (wastedByDimension.get(wasted.dimension) ?? 0) + wasted.value,
      );
    }
  }

  const rescueRatioByDimension: Partial<Record<WasteMeasurementDimension, number>> = {};
  for (const dimension of new Set([...consumedByDimension.keys(), ...wastedByDimension.keys()])) {
    const consumed = consumedByDimension.get(dimension) ?? 0;
    const wasted = wastedByDimension.get(dimension) ?? 0;
    const denominator = consumed + wasted;
    if (denominator > 0) rescueRatioByDimension[dimension] = consumed / denominator;
  }

  const dimensions = Object.keys(rescueRatioByDimension) as WasteMeasurementDimension[];
  const knownLots = [...outcomesByLot.values()].filter((lot) => lot.known);
  const knownOutcomeLotCount = knownLots.length;
  const rescuedLotCount = knownLots.filter((lot) => lot.consumed && !lot.wasteReported).length;
  return {
    primaryRescueRatio:
      !hasIncompatibleDimension && dimensions.length === 1
        ? (rescueRatioByDimension[dimensions[0]] ?? null)
        : null,
    rescueRatioByDimension,
    knownOutcomeLotCount,
    rescuedLotCount,
    plausibilityRatio: knownOutcomeLotCount === 0 ? null : rescuedLotCount / knownOutcomeLotCount,
  };
}
