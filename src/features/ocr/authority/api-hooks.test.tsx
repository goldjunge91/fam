import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import type { SqlDatabase } from '@/lib/db/types';
import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../../test/node-sqlite-adapter';
import {
  createReceiptItem,
  deleteReceipt,
  receiptAssetSignedUrlQueryKey,
  receiptAssetsQueryKey,
  useConfirmedReceiptItems,
  useConfirmedReceipts,
  useConfirmReceiptItemMutation,
  useConfirmReceiptMutation,
  useCreateReceiptMutation,
  useDeleteReceiptAssetMutation,
  useDeleteReceiptItemMutation,
  useDeleteReceiptMutation,
  useReceipt,
  useReceiptAssets,
  useReceiptItems,
  useReceipts,
  useReopenReceiptMutation,
  useRestoreReceiptItemMutation,
  useRestoreReceiptMutation,
  useUpdateReceiptItemMutation,
  useUpdateReceiptMutation,
} from './api';

let mockDb: SqlDatabase;
let testDatabase: TestDatabase;

const mockQuery = {
  select: () => mockQuery,
  eq: () => mockQuery,
  is: () => mockQuery,
  order: () => mockQuery,
  update: () => mockQuery,
  maybeSingle: async () => ({ data: { id: 'asset-1' }, error: null }),
  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenables.
  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  },
};

const mockSupabase = {
  from: () => mockQuery,
  storage: { from: () => ({ remove: async () => ({ data: [], error: null }) }) },
} as unknown as TypedSupabaseClient;

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: async () => mockDb,
}));
jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => mockSupabase,
}));

describe('receipt authority queries', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  async function loadSuccessfully<TData>(query: () => UseQueryResult<TData, Error>): Promise<void> {
    const hook = await renderHook(query, { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    await hook.unmount();
  }

  async function performMutation<TData, TError, TVariables, TContext>(
    hook: () => UseMutationResult<TData, TError, TVariables, TContext>,
    variables: TVariables,
  ): Promise<void> {
    const mutation = await renderHook(hook, { wrapper });
    await act(async () => {
      await mutation.result.current.mutateAsync(variables);
    });
    await mutation.unmount();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    testDatabase = createTestDatabase();
    await applyLocalSchema(testDatabase);
    mockDb = testDatabase;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    testDatabase.close();
  });

  it('loads local receipt queries and remote asset metadata for an active receipt', async () => {
    await loadSuccessfully(() => useReceipts('household-1'));
    await loadSuccessfully(() => useConfirmedReceipts('household-2'));
    await loadSuccessfully(() => useReceipt('household-3', 'receipt-1'));
    await loadSuccessfully(() => useReceiptItems('household-4', 'receipt-2'));
    await loadSuccessfully(() => useConfirmedReceiptItems('household-5', 'receipt-3'));
    await loadSuccessfully(() => useReceiptAssets('household-6', 'receipt-4'));
  });

  it('keeps receipt detail queries disabled until both ids are present', async () => {
    const readReceipt = jest.spyOn(testDatabase, 'getFirstAsync');
    const detail = await renderHook<
      ReturnType<typeof useReceipt>,
      {
        householdId: string | undefined;
        receiptId: string;
      }
    >(({ householdId, receiptId }) => useReceipt(householdId, receiptId), {
      initialProps: { householdId: undefined as string | undefined, receiptId: 'receipt-1' },
      wrapper,
    });

    expect(readReceipt).not.toHaveBeenCalled();

    await detail.rerender({ householdId: 'household-1', receiptId: 'receipt-1' });
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    expect(readReceipt).toHaveBeenCalledTimes(1);
    await detail.unmount();
  });

  it('applies the local receipt and item mutation sequence', async () => {
    const receiptId = '00000000-0000-0000-0000-000000000101';
    const itemId = '00000000-0000-0000-0000-000000000102';
    const householdId = '00000000-0000-0000-0000-000000000103';
    const userId = '00000000-0000-0000-0000-000000000104';

    await performMutation(useCreateReceiptMutation, {
      id: receiptId,
      householdId,
      createdBy: userId,
      processingStatus: 'needs_review',
    });
    await createReceiptItem(
      { id: itemId, receiptId, householdId, position: 0, name: 'Milch' },
      { db: testDatabase },
    );
    await performMutation(useUpdateReceiptMutation, {
      householdId,
      receiptId,
      changes: { totalCents: 199 },
    });
    expect(
      await testDatabase.getFirstAsync<{ total_cents: number }>(
        'select total_cents from purchase_receipts where id = ?',
        [receiptId],
      ),
    ).toMatchObject({ total_cents: 199 });
    await performMutation(useConfirmReceiptMutation, {
      householdId,
      receiptId,
      confirmedBy: userId,
    });
    await performMutation(useReopenReceiptMutation, { householdId, receiptId });
    await performMutation(useUpdateReceiptItemMutation, {
      householdId,
      itemId,
      changes: { name: 'Hafermilch' },
    });
    expect(
      await testDatabase.getFirstAsync<{ name: string }>(
        'select name from purchase_receipt_items where id = ?',
        [itemId],
      ),
    ).toMatchObject({ name: 'Hafermilch' });
    await performMutation(useConfirmReceiptItemMutation, { householdId, itemId });
    await performMutation(useDeleteReceiptItemMutation, { householdId, itemId });
    expect(
      await testDatabase.getFirstAsync<{ deleted_at: number | null }>(
        'select deleted_at from purchase_receipt_items where id = ?',
        [itemId],
      ),
    ).toMatchObject({ deleted_at: expect.any(Number) });
    await performMutation(useRestoreReceiptItemMutation, { householdId, itemId });
    expect(
      await testDatabase.getFirstAsync<{ deleted_at: number | null }>(
        'select deleted_at from purchase_receipt_items where id = ?',
        [itemId],
      ),
    ).toMatchObject({ deleted_at: null });

    await deleteReceipt({ householdId, receiptId }, { db: testDatabase });
    expect(
      await testDatabase.getFirstAsync<{ deleted_at: number | null }>(
        'select deleted_at from purchase_receipts where id = ?',
        [receiptId],
      ),
    ).toMatchObject({ deleted_at: expect.any(Number) });
    await performMutation(useRestoreReceiptMutation, { householdId, receiptId });
    expect(
      await testDatabase.getFirstAsync<{ deleted_at: number | null }>(
        'select deleted_at from purchase_receipts where id = ?',
        [receiptId],
      ),
    ).toMatchObject({ deleted_at: null });
    await performMutation(useDeleteReceiptMutation, { householdId, receiptId });

    expect(
      await testDatabase.getFirstAsync<{ deleted_at: number | null }>(
        'select deleted_at from purchase_receipts where id = ?',
        [receiptId],
      ),
    ).toMatchObject({ deleted_at: expect.any(Number) });
  });

  it('removes an asset and its cached signed URL after remote deletion', async () => {
    const input = {
      householdId: 'household-1',
      receiptId: 'receipt-1',
      assetId: 'asset-1',
      storagePath: 'household-1/receipt-1/asset-1.jpg',
    };
    const assetsKey = receiptAssetsQueryKey(input.householdId, input.receiptId);
    const signedUrlKey = receiptAssetSignedUrlQueryKey(
      input.householdId,
      input.receiptId,
      input.assetId,
    );
    queryClient.setQueryData(assetsKey, [{ id: input.assetId }]);
    queryClient.setQueryData(signedUrlKey, 'https://signed.example/asset');

    await performMutation(useDeleteReceiptAssetMutation, input);

    expect(queryClient.getQueryData(assetsKey)).toEqual([]);
    expect(queryClient.getQueryData(signedUrlKey)).toBeUndefined();
  });
});
