import { createReceiptCaptureDraft } from '../domain/actions';
import type { ReceiptCaptureDraft, ReceiptCapturePage } from '../domain/types';
import {
  createReceiptCapturePersistence,
  type ReceiptCaptureMetadataStorage,
} from './receipt-capture-persistence';

const mockGetEncryptedAccountStorage = jest.fn();
jest.mock('@/lib/storage/account-storage', () => ({
  getEncryptedAccountStorage: (accountId: string) => mockGetEncryptedAccountStorage(accountId),
}));

type FakeStorage = ReceiptCaptureMetadataStorage & { values: Map<string, string> };

function storage(): FakeStorage {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key),
  };
}

function page(id: string): ReceiptCapturePage {
  return {
    id,
    localUri: `file:///documents/receipt-captures/capture-1/${id}.jpg`,
    mimeType: 'image/jpeg',
    byteSize: 120_000,
  };
}

function draft(): ReceiptCaptureDraft {
  return createReceiptCaptureDraft({
    id: 'capture-1',
    source: 'camera',
    pages: [page('page-1')],
    createdAt: '2026-09-21T10:00:00.000Z',
  });
}

describe('receipt capture persistence', () => {
  beforeEach(() => mockGetEncryptedAccountStorage.mockReset());

  it('does not load a stale draft while another persistence instance discards it', async () => {
    const metadata = storage();
    let releaseDelete!: () => void;
    const deleteStarted = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const deletingFile = new Promise<void>((resolve) => {
      void deleteStarted.then(() => resolve());
    });
    const first = createReceiptCapturePersistence('account-a', {
      storage: metadata,
      fileSystem: {
        deleteLocalFile: async () => deletingFile,
      },
    });
    const second = createReceiptCapturePersistence('account-a', { storage: metadata });

    await first.save(draft());
    const discardPromise = first.discard();
    const loadPromise = second.load();

    await Promise.resolve();
    expect(metadata.values.size).toBe(1);

    releaseDelete();
    await discardPromise;

    await expect(loadPromise).resolves.toBeNull();
  });

  it('does not resurrect a draft from a save that started before discard', async () => {
    const metadata = storage();
    const persistence = createReceiptCapturePersistence('account-a', { storage: metadata });

    await persistence.save(draft());
    const staleSave = persistence.save({
      ...draft(),
      updatedAt: '2026-09-21T10:02:00.000Z',
    });
    const discard = persistence.discard();

    await Promise.all([staleSave, discard]);

    await expect(persistence.load()).resolves.toBeNull();
  });

  it('resolves the encrypted account store from the active account id', async () => {
    const metadata = storage();
    mockGetEncryptedAccountStorage.mockResolvedValue(metadata);

    await createReceiptCapturePersistence('account-a').save(draft());

    expect(mockGetEncryptedAccountStorage).toHaveBeenCalledWith('account-a');
    expect(metadata.values.size).toBe(1);
  });

  it('survives a new persistence instance with only resumable metadata', async () => {
    const metadata = storage();
    const first = createReceiptCapturePersistence('account-a', {
      storage: metadata,
    });
    const candidate = {
      ...draft(),
      ocrText: 'must-not-be-persisted',
      lineEvidence: [{ text: 'must-not-be-persisted' }],
    } as ReceiptCaptureDraft & { ocrText: string; lineEvidence: unknown[] };

    await first.save(candidate);

    const resumed = await createReceiptCapturePersistence('account-a', {
      storage: metadata,
    }).load();

    expect(resumed).toMatchObject({ id: 'capture-1', phase: 'normalized' });
    expect(resumed?.pages.map(({ id }) => id)).toEqual(['page-1']);
    expect(JSON.stringify([...metadata.values.values()])).not.toContain('must-not-be-persisted');
  });

  it('persists the structured review state without persisting OCR evidence', async () => {
    const metadata = storage();
    const persistence = createReceiptCapturePersistence('account-a', { storage: metadata });
    const candidate = {
      ...draft(),
      review: {
        source: {
          market: {
            value: 'EDEKA',
            confidence: 0.99,
            sourceLineIndex: 0,
            evidence: 'EDEKA',
            needsReview: false,
          },
          purchaseDate: {
            value: '2026-09-20',
            confidence: 0.98,
            sourceLineIndex: 1,
            evidence: '20.09.2026',
            needsReview: false,
          },
          totalCents: {
            value: 3914,
            confidence: 0.97,
            sourceLineIndex: 12,
            evidence: 'SUMME 39,14',
            needsReview: false,
          },
          items: [
            {
              id: 'line-2',
              name: 'Milch',
              quantity: 1,
              unit: 'piece',
              lineTotalCents: {
                value: 199,
                confidence: 0.96,
                sourceLineIndex: 2,
                evidence: 'Milch 1,99',
                needsReview: false,
              },
              unitPriceCents: null,
              confidence: 0.96,
              sourceLineIndex: 2,
              evidence: 'Milch 1,99',
              needsReview: false,
            },
          ],
        },
        state: {
          market: 'EDEKA',
          purchaseDate: '2026-09-20',
          totalCents: '39,14',
          storeId: 'store-edeka',
          marketNeedsReview: false,
          dateNeedsReview: false,
          totalNeedsReview: false,
          items: [
            {
              id: 'line-2',
              name: 'Milch',
              quantity: '1',
              lineTotalCents: '1,99',
              needsReview: false,
            },
          ],
        },
      },
    };

    await persistence.save(candidate);

    const resumed = await persistence.load();
    expect(resumed?.review).toEqual(candidate.review);
    expect(JSON.stringify([...metadata.values.values()])).not.toContain('boundingBox');
  });

  it('rejects a draft whose page URI could contain embedded image bytes', async () => {
    const persistence = createReceiptCapturePersistence('account-a', { storage: storage() });

    await expect(
      persistence.save({
        ...draft(),
        pages: [{ ...page('page-1'), localUri: 'data:image/jpeg;base64,private-bytes' }],
      }),
    ).rejects.toThrow('receipt-captures');
  });

  it('rejects arbitrary local files outside the receipt-captures ownership scope', async () => {
    const persistence = createReceiptCapturePersistence('account-a', { storage: storage() });

    await expect(
      persistence.save({
        ...draft(),
        pages: [{ ...page('page-1'), localUri: 'file:///documents/other-feature/page-1.jpg' }],
      }),
    ).rejects.toThrow('receipt-captures');
  });

  it('keeps account drafts isolated when each account resolves its own encrypted store', async () => {
    const accounts = new Map<string, FakeStorage>();
    const persistenceFor = (accountId: string) => {
      const accountStorage = accounts.get(accountId) ?? storage();
      accounts.set(accountId, accountStorage);
      return createReceiptCapturePersistence(accountId, { storage: accountStorage });
    };

    await persistenceFor('account-a').save(draft());

    await expect(persistenceFor('account-b').load()).resolves.toBeNull();
    await expect(persistenceFor('account-a').load()).resolves.toMatchObject({ id: 'capture-1' });
  });

  it('appends pages in stable order and rejects a page already in the draft', async () => {
    const persistence = createReceiptCapturePersistence('account-a', { storage: storage() });
    await persistence.save(draft());

    const appended = await persistence.appendPages({
      pages: [page('page-2'), page('page-3')],
      updatedAt: '2026-09-21T10:01:00.000Z',
    });

    expect(appended.pages.map(({ id }) => id)).toEqual(['page-1', 'page-2', 'page-3']);
    await expect(
      persistence.appendPages({
        pages: [page('page-2')],
        updatedAt: '2026-09-21T10:02:00.000Z',
      }),
    ).rejects.toThrow('can only appear once');
  });

  it('persists the failed phase and retries from that phase without changing pages', async () => {
    const metadata = storage();
    const persistence = createReceiptCapturePersistence('account-a', { storage: metadata });
    await persistence.save(draft());

    const failed = await persistence.fail({
      phase: 'processing',
      failure: { code: 'ocr_failed', message: 'OCR failed.' },
      updatedAt: '2026-09-21T10:01:00.000Z',
    });
    expect(failed).toMatchObject({ status: 'failed', phase: 'processing' });
    expect(failed.failure).toMatchObject({ code: 'ocr_failed', phase: 'processing' });

    const resumed = await createReceiptCapturePersistence('account-a', {
      storage: metadata,
    }).load();
    expect(resumed).toMatchObject({ status: 'failed', phase: 'processing' });

    const retried = await persistence.retry('2026-09-21T10:02:00.000Z');
    expect(retried).toMatchObject({ status: 'pending', phase: 'processing', failure: null });
    expect(retried.pages.map(({ id }) => id)).toEqual(['page-1']);
  });

  it('discards metadata and only the persisted owned page files', async () => {
    const metadata = storage();
    const deleted: string[] = [];
    const persistence = createReceiptCapturePersistence('account-a', {
      storage: metadata,
      fileSystem: {
        deleteLocalFile: async (localUri) => {
          deleted.push(localUri);
        },
      },
    });
    await persistence.save(draft());

    await persistence.discard();

    expect(deleted).toEqual(['file:///documents/receipt-captures/capture-1/page-1.jpg']);
    expect(await persistence.load()).toBeNull();
    expect(metadata.values.size).toBe(0);
  });
});
