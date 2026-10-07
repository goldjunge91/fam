const DECIMAL_GB_BYTES = 1_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type StorageAsset = {
  key: string;
  bytes: number;
};

export type StorageBudgetSnapshot = {
  budgetBytes: number | null;
  occupiedBytes: number;
  reservedBytes: number;
  additionallyNeededBytes: number;
  requiredBytes: number;
  remainingBudgetBytes: number | null;
};

export type StorageBudgetOptions = {
  budgetBytes?: number;
  existingAssets?: readonly StorageAsset[];
};

export const STORAGE_BUDGET_EXCEEDED = 'STORAGE_BUDGET_EXCEEDED';

function assertBytes(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} muss eine nichtnegative ganze Bytezahl sein.`);
  }
  return value;
}

function assertBudget(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return assertBytes(value, 'Das Speicherbudget');
}

export function decimalGbToBytes(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Das Speicherbudget muss eine nichtnegative Dezimalzahl sein.');
  }
  const bytes = value * DECIMAL_GB_BYTES;
  return assertBytes(bytes, 'Das Speicherbudget');
}

export class StorageBudgetExceededError extends Error {
  readonly code = STORAGE_BUDGET_EXCEEDED;

  constructor(
    readonly key: string,
    readonly requestedBytes: number,
    readonly budgetBytes: number,
    readonly occupiedBytes: number,
    readonly reservedBytes: number,
  ) {
    super(
      `Speicherbudget überschritten für ${key}: ${occupiedBytes + reservedBytes + requestedBytes} von ${budgetBytes} Bytes benötigt.`,
    );
    this.name = 'StorageBudgetExceededError';
  }
}

/**
 * Prozessweiter Budgetzustand für vorhandene Assets und neue Writes.
 * Dieser Zustand schützt nur Aufrufer innerhalb desselben Prozesses. Gegen
 * andere Writer ist ohne zusätzliche Koordination kein globaler Schutz möglich.
 */
export class StorageBudget {
  private readonly existingAssets = new Map<string, number>();
  private readonly reservations = new Map<string, number>();
  readonly budgetBytes: number | undefined;

  constructor(options: StorageBudgetOptions = {}) {
    this.budgetBytes = assertBudget(options.budgetBytes);
    for (const asset of options.existingAssets ?? []) {
      this.markExisting(asset.key, asset.bytes);
    }
  }

  get occupiedBytes(): number {
    return [...this.existingAssets.values()].reduce((sum, bytes) => sum + bytes, 0);
  }

  get reservedBytes(): number {
    return [...this.reservations.values()].reduce((sum, bytes) => sum + bytes, 0);
  }

  hasExistingAsset(key: string): boolean {
    return this.existingAssets.has(key);
  }

  /** Marks an object present and removes any reservation for the same key. */
  markExisting(key: string, bytes: number): void {
    assertBytes(bytes, `Asset ${key}`);
    this.reservations.delete(key);
    const previous = this.existingAssets.get(key) ?? 0;
    this.existingAssets.set(key, Math.max(previous, bytes));
  }

  /** Removes stale inventory knowledge after a definitive missing result. */
  markMissing(key: string): void {
    this.existingAssets.delete(key);
  }

  reserve(key: string, bytes: number): StorageReservation {
    assertBytes(bytes, `Write ${key}`);
    if (this.existingAssets.has(key) || this.reservations.has(key)) {
      return new StorageReservation(this, key, bytes, false);
    }

    const occupiedBytes = this.occupiedBytes;
    const reservedBytes = this.reservedBytes;
    if (
      this.budgetBytes !== undefined &&
      occupiedBytes + reservedBytes + bytes > this.budgetBytes
    ) {
      throw new StorageBudgetExceededError(
        key,
        bytes,
        this.budgetBytes,
        occupiedBytes,
        reservedBytes,
      );
    }

    this.reservations.set(key, bytes);
    return new StorageReservation(this, key, bytes, true);
  }

  snapshot(): StorageBudgetSnapshot {
    const occupiedBytes = this.occupiedBytes;
    const reservedBytes = this.reservedBytes;
    const requiredBytes = occupiedBytes + reservedBytes;
    return {
      budgetBytes: this.budgetBytes ?? null,
      occupiedBytes,
      reservedBytes,
      additionallyNeededBytes: reservedBytes,
      requiredBytes,
      remainingBudgetBytes:
        this.budgetBytes === undefined ? null : this.budgetBytes - requiredBytes,
    };
  }

  commitReservation(key: string, reservedBytes: number, actualBytes: number): void {
    if (this.reservations.get(key) !== reservedBytes) return;
    this.reservations.delete(key);
    this.markExisting(key, actualBytes);
  }

  releaseReservation(key: string, reservedBytes: number): void {
    if (this.reservations.get(key) === reservedBytes) {
      this.reservations.delete(key);
    }
  }
}

export class StorageReservation {
  private settled = false;

  constructor(
    private readonly budget: StorageBudget,
    readonly key: string,
    readonly bytes: number,
    readonly countsAgainstBudget: boolean,
  ) {}

  commit(actualBytes = this.bytes): void {
    if (this.settled) return;
    this.settled = true;
    if (this.countsAgainstBudget) {
      this.budget.commitReservation(
        this.key,
        this.bytes,
        assertBytes(actualBytes, `Asset ${this.key}`),
      );
    }
  }

  /** Only use before a write starts. Unknown write outcomes must stay reserved. */
  release(): void {
    if (this.settled) return;
    this.settled = true;
    if (this.countsAgainstBudget) {
      this.budget.releaseReservation(this.key, this.bytes);
    }
  }
}

export function createStorageBudget(options: StorageBudgetOptions = {}): StorageBudget {
  return new StorageBudget(options);
}

export type RetentionBrochure = {
  id: string;
  validUntil?: string | null;
  assetKeys: readonly string[];
};

export type ExpiredBrochure = {
  id: string;
  validUntil: string;
  expiresAt: string;
  assetKeys: string[];
};

export type RetentionAssetReference = {
  key: string;
  bytes: number | null;
  brochureIds: string[];
};

export type RetentionCandidate = {
  key: string;
  bytes: number | null;
  eligibleForCleanup: boolean;
  reason: 'no-retained-reference' | 'reference-basis-incomplete';
};

export type RetentionReport = {
  generatedAt: string;
  retentionGraceDays: number;
  referenceBasisComplete: boolean;
  budgetBytes: number | null;
  occupiedBytes: number;
  additionallyNeededBytes: number;
  requiredBytes: number;
  remainingBudgetBytes: number | null;
  expiredBrochures: ExpiredBrochure[];
  referencedAssets: RetentionAssetReference[];
  cleanupCandidates: RetentionCandidate[];
  potentiallyReleasableBytes: number;
  cleanupApplied: false;
  notes: string[];
};

function snapshotForReport(
  budget: StorageBudget | StorageBudgetSnapshot | undefined,
  assets: readonly StorageAsset[],
  additionallyNeededBytes: number,
): StorageBudgetSnapshot {
  if (budget instanceof StorageBudget) return budget.snapshot();
  if (budget) return budget;

  const occupiedBytes = assets.reduce(
    (sum, asset) => sum + assertBytes(asset.bytes, `Asset ${asset.key}`),
    0,
  );
  const additional = assertBytes(additionallyNeededBytes, 'Zusätzlich benötigte Bytes');
  return {
    budgetBytes: null,
    occupiedBytes,
    reservedBytes: additional,
    additionallyNeededBytes: additional,
    requiredBytes: occupiedBytes + additional,
    remainingBudgetBytes: null,
  };
}

export function createRetentionReport(options: {
  assets: readonly StorageAsset[];
  brochures: readonly RetentionBrochure[];
  retentionGraceDays: number;
  referenceBasisComplete: boolean;
  candidateKeyPrefix?: string;
  budget?: StorageBudget | StorageBudgetSnapshot;
  additionallyNeededBytes?: number;
  now?: Date;
}): RetentionReport {
  const graceDays = options.retentionGraceDays;
  if (!Number.isSafeInteger(graceDays) || graceDays < 0) {
    throw new Error('Die Aufbewahrungsnachfrist muss eine nichtnegative ganze Zahl sein.');
  }
  const now = options.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new Error('Der Berichtszeitpunkt ist ungültig.');

  const assetsByKey = new Map<string, number>();
  for (const asset of options.assets) {
    assertBytes(asset.bytes, `Asset ${asset.key}`);
    assetsByKey.set(asset.key, Math.max(assetsByKey.get(asset.key) ?? 0, asset.bytes));
  }

  const expiredBrochures: ExpiredBrochure[] = [];
  const retainedReferences = new Map<string, Set<string>>();
  const expiredReferences = new Set<string>();

  for (const brochure of options.brochures) {
    const assetKeys = [...new Set(brochure.assetKeys.filter(Boolean))];
    const validUntil = brochure.validUntil?.trim();
    const validUntilMs = validUntil ? Date.parse(validUntil) : Number.NaN;
    const expiresAtMs = Number.isNaN(validUntilMs) ? Number.NaN : validUntilMs + graceDays * DAY_MS;
    const expired = !Number.isNaN(expiresAtMs) && expiresAtMs <= now.getTime();

    if (expired && validUntil) {
      expiredBrochures.push({
        id: brochure.id,
        validUntil,
        expiresAt: new Date(expiresAtMs).toISOString(),
        assetKeys,
      });
      for (const key of assetKeys) expiredReferences.add(key);
      continue;
    }

    for (const key of assetKeys) {
      const references = retainedReferences.get(key) ?? new Set<string>();
      references.add(brochure.id);
      retainedReferences.set(key, references);
    }
  }

  const referencedAssets = [...retainedReferences.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, brochureIds]) => ({
      key,
      bytes: assetsByKey.get(key) ?? null,
      brochureIds: [...brochureIds].sort(),
    }));

  const candidateKeys = new Set<string>();
  const isCandidateKey = (key: string): boolean =>
    options.candidateKeyPrefix === undefined || key.startsWith(options.candidateKeyPrefix);
  if (options.referenceBasisComplete) {
    for (const key of assetsByKey.keys()) {
      if (isCandidateKey(key) && !retainedReferences.has(key)) candidateKeys.add(key);
    }
  } else {
    for (const key of expiredReferences) {
      if (isCandidateKey(key)) candidateKeys.add(key);
    }
  }

  const cleanupCandidates = [...candidateKeys].sort().map((key) => ({
    key,
    bytes: assetsByKey.get(key) ?? null,
    eligibleForCleanup: options.referenceBasisComplete,
    reason: options.referenceBasisComplete
      ? ('no-retained-reference' as const)
      : ('reference-basis-incomplete' as const),
  }));

  const snapshot = snapshotForReport(
    options.budget,
    options.assets,
    options.additionallyNeededBytes ?? 0,
  );
  const potentiallyReleasableBytes = options.referenceBasisComplete
    ? cleanupCandidates.reduce((sum, candidate) => sum + (candidate.bytes ?? 0), 0)
    : 0;

  const notes = [
    'Keine automatische Löschung wurde ausgeführt; Kandidaten geben kein Budget frei.',
    'Das Budget schützt nur Writer innerhalb dieses Prozesses. Für globale Sicherheit einen einzelnen Writer verwenden.',
  ];
  if (!options.referenceBasisComplete) {
    notes.push(
      'Die Referenzbasis ist unvollständig. Kandidaten sind nicht als löschbar bestätigt.',
    );
  }

  return {
    generatedAt: now.toISOString(),
    retentionGraceDays: graceDays,
    referenceBasisComplete: options.referenceBasisComplete,
    budgetBytes: snapshot.budgetBytes,
    occupiedBytes: snapshot.occupiedBytes,
    additionallyNeededBytes: snapshot.additionallyNeededBytes,
    requiredBytes: snapshot.requiredBytes,
    remainingBudgetBytes: snapshot.remainingBudgetBytes,
    expiredBrochures,
    referencedAssets,
    cleanupCandidates,
    potentiallyReleasableBytes,
    cleanupApplied: false,
    notes,
  };
}
