import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Crypto from 'expo-crypto';
import type React from 'react';
import { saveShoppingItemAtomically } from '@/features/shopping-list/preferences/save-shopping-item';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/local-client';
import { enqueueMutation, enqueueMutations } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import * as sharedMutations from './use-shopping-list-mutations';
import * as androidMutations from './use-shopping-list-mutations.android';

const implementations: readonly (readonly [string, typeof sharedMutations])[] = [
  ['shared', sharedMutations],
  ['Android', androidMutations],
];

const mockDbRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockLocalTxn: SqlDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: (source, params) => mockDbRunAsync(source, params),
  getAllAsync: async <T,>() => [] as T[],
  getFirstAsync: async () => null,
  withExclusiveTransactionAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: jest.fn() }));

jest.mock('@/lib/db/local-client', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockDbRunAsync(...args),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  }),
}));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'generated-item-id') }));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn().mockResolvedValue(undefined),
  enqueueMutations: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/shopping-list/preferences/save-shopping-item', () => ({
  saveShoppingItemAtomically: jest.fn().mockResolvedValue({
    preferenceId: null,
    preferenceChanged: false,
    mutationCount: 1,
  }),
}));

for (const [platform, mutations] of implementations) {
  describe(`use-shopping-list-mutations (${platform})`, () => {
    const {
      useAddShoppingItem,
      useDeleteShoppingItem,
      useMoveShoppingItems,
      useToggleShoppingItem,
      useUpdateShoppingItem,
    } = mutations;
    let queryClient: QueryClient;

    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    beforeEach(() => {
      jest.clearAllMocks();
      onlineManager.setOnline(true);
      queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
          mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        },
      });
    });

    afterEach(() => {
      onlineManager.setOnline(true);
      queryClient.clear();
    });

    it('schreibt einen Einkaufslistenwechsel auch offline in die lokale Outbox', async () => {
      onlineManager.setOnline(false);
      const { result } = await renderHook(() => useToggleShoppingItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'item-offline',
          household_id: 'hh-1',
          checked_at: '2026-09-27T10:00:00Z',
          checked_by: 'user-1',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(enqueueMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entity: 'shopping_list_items', entityId: 'item-offline' }),
      );
    });

    it('toggelt den checked-Status eines Eintrags', async () => {
      const { result } = await renderHook(() => useToggleShoppingItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'item-1',
          household_id: 'hh-1',
          checked_at: '2026-08-20T12:00:00Z',
          checked_by: 'user-1',
        });
      });

      // TanStack Query veroeffentlicht den sichtbaren Mutation-Status asynchron.
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(enqueueMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entity: 'shopping_list_items',
          op: 'update',
          entityId: 'item-1',
        }),
      );
    });

    it('löscht einen Eintrag per Soft-Delete', async () => {
      const { result } = await renderHook(() => useDeleteShoppingItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'item-1',
          household_id: 'hh-1',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(enqueueMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entity: 'shopping_list_items',
          op: 'delete',
          entityId: 'item-1',
        }),
      );
      const mutation = jest.mocked(enqueueMutation).mock.calls[0]?.[1];
      if (!mutation) throw new Error('Die Outbox-Mutation fehlt.');
      await mutation.applyLocally(mockLocalTxn);
      expect(mockDbRunAsync).toHaveBeenCalled();
    });

    it('aktualisiert Name und Menge eines Eintrags', async () => {
      const { result } = await renderHook(() => useUpdateShoppingItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'item-1',
          household_id: 'hh-1',
          name: 'Haferflocken Großpackung',
          quantity: 1000,
          unit: 'g',
          package_size: 1,
          package_size_unit: 'Liter',
          category_id: null,
          category_source: 'store_preference',
          category_classifier_version: null,
          store_id: null,
          price_estimate: null,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(saveShoppingItemAtomically).toHaveBeenCalledWith(
        expect.objectContaining({
          itemMutation: expect.objectContaining({
            entity: 'shopping_list_items',
            op: 'update',
            entityId: 'item-1',
            payload: expect.objectContaining({
              category_source: 'store_preference',
              package_size_unit: 'l',
            }),
          }),
        }),
      );
      const saveInput = jest.mocked(saveShoppingItemAtomically).mock.calls[0]?.[0];
      if (!saveInput) throw new Error('Der atomare Speicheraufruf fehlt.');
      await saveInput.itemMutation.applyLocally(mockLocalTxn);
      expect(mockDbRunAsync).toHaveBeenCalled();
    });

    it('verschiebt mehrere Einträge als eine Outbox-Transaktion', async () => {
      const { result } = await renderHook(() => useMoveShoppingItems(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          household_id: 'hh-1',
          item_ids: ['item-1', 'item-2'],
          store_id: 'store-2',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(enqueueMutations).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            entity: 'shopping_list_items',
            entityId: 'item-1',
            payload: expect.objectContaining({ store_id: 'store-2' }),
          }),
          expect.objectContaining({
            entity: 'shopping_list_items',
            entityId: 'item-2',
            payload: expect.objectContaining({ store_id: 'store-2' }),
          }),
        ]),
      );
      const mutations = jest.mocked(enqueueMutations).mock.calls[0]?.[1];
      if (!mutations) throw new Error('Die Outbox-Mutationen fehlen.');
      await Promise.all(mutations.map((mutation) => mutation.applyLocally(mockLocalTxn)));
      expect(mockDbRunAsync).toHaveBeenCalledTimes(2);
    });

    it('fügt einen Artikel mit einer generierten ID hinzu', async () => {
      const { result } = await renderHook(() => useAddShoppingItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          household_id: 'hh-1',
          name: 'Hafermilch',
          quantity: 1,
          unit: 'piece',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
      expect(enqueueMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entityId: 'generated-item-id', op: 'insert' }),
      );
    });

    it('reicht optionale Vorgaben und Feedback an den atomaren Save weiter', async () => {
      const { result } = await renderHook(() => useAddShoppingItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          household_id: 'hh-1',
          name: 'Hafermilch',
          quantity: 1,
          unit: 'piece',
          preference: {
            type: 'set',
            input: {
              householdId: 'hh-1',
              keyType: 'name',
              keyValue: 'Hafermilch',
              categoryId: 'cold_drinks',
              createdBy: 'user-1',
            },
          },
          feedback: {
            eventId: 'feedback-1',
            eventType: 'manual_reassign',
            inputMethod: 'add_form',
            householdId: 'hh-1',
            actorUserId: 'user-1',
            productName: 'Hafermilch',
            preferenceScope: 'household',
            oldPlacementZone: 'cold_drinks',
            newPlacementZone: 'cold_drinks',
            predictedPlacementZone: 'cold_drinks',
            oldCategorySource: 'name_fallback',
            newCategorySource: 'user',
            predictedProductFamily: 'milk',
            predictedProductForm: 'drink',
            classifierVersion: 'v1',
            platform: 'android',
            appVersion: '1.0.0',
            buildChannel: 'test',
            clientCreatedAt: '2026-10-10T10:00:00Z',
          },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(saveShoppingItemAtomically).toHaveBeenCalledWith(
        expect.objectContaining({
          preference: expect.objectContaining({ type: 'set' }),
          feedback: expect.objectContaining({
            eventId: 'feedback-1',
            shoppingListItemId: 'generated-item-id',
          }),
          itemMutation: expect.objectContaining({ entityId: 'generated-item-id' }),
        }),
      );
    });

    it('reicht Vorgaben ohne Feedback an den atomaren Save weiter', async () => {
      const { result } = await renderHook(() => useAddShoppingItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          household_id: 'hh-1',
          name: 'Hafermilch',
          quantity: 1,
          unit: 'piece',
          product_id: 'product-1',
          preference: {
            type: 'set',
            input: {
              householdId: 'hh-1',
              keyType: 'name',
              keyValue: 'Hafermilch',
              categoryId: 'cold_drinks',
              createdBy: 'user-1',
            },
          },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(saveShoppingItemAtomically).toHaveBeenCalledWith(
        expect.objectContaining({ feedback: undefined }),
      );
    });

    it.each([new Error('Speichern fehlgeschlagen'), 'unbekannter Fehler'])(
      'reicht atomare Speicherfehler unverändert weiter: %s',
      async (error) => {
        jest.mocked(saveShoppingItemAtomically).mockRejectedValueOnce(error);
        const { result } = await renderHook(() => useAddShoppingItem(), { wrapper });

        await act(async () => {
          await expect(
            result.current.mutateAsync({
              household_id: 'hh-1',
              name: 'Hafermilch',
              quantity: 1,
              unit: 'piece',
              product_id: 'product-1',
              preference: {
                type: 'set',
                input: {
                  householdId: 'hh-1',
                  keyType: 'name',
                  keyValue: 'Hafermilch',
                  categoryId: 'cold_drinks',
                  createdBy: 'user-1',
                },
              },
            }),
          ).rejects.toBe(error);
        });
        await waitFor(() => expect(result.current.isError).toBe(true));
      },
    );

    it('reicht einen leeren Verschiebeauftrag ohne Datenbankzugriff durch', async () => {
      const { result } = await renderHook(() => useMoveShoppingItems(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ household_id: 'hh-1', item_ids: [], store_id: null });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getDatabase).not.toHaveBeenCalled();
    });

    it('schreibt das logische Gegenstück zum Abhaken in die Outbox', async () => {
      const { result } = await renderHook(() => useToggleShoppingItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'item-1',
          household_id: 'hh-1',
          checked_at: null,
          checked_by: null,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(enqueueMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entityId: 'item-1',
          payload: expect.objectContaining({ checked_at: null, checked_by: null }),
        }),
      );
      expect(trackAnalyticsEvent).toHaveBeenCalledWith('shopping_item.uncheck.completed');
      const mutation = jest.mocked(enqueueMutation).mock.calls[0]?.[1];
      if (!mutation) throw new Error('Die Outbox-Mutation fehlt.');
      await mutation.applyLocally(mockLocalTxn);
      expect(mockDbRunAsync).toHaveBeenCalled();
    });

    it('gibt einen Fehler beim Laden der Datenbank zurück', async () => {
      jest.mocked(getDatabase).mockRejectedValueOnce(new Error('database unavailable'));
      const { result } = await renderHook(() => useAddShoppingItem(), { wrapper });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            household_id: 'hh-1',
            name: 'Hafermilch',
            quantity: 1,
            unit: 'piece',
          });
        }),
      ).rejects.toThrow('database unavailable');
    });
  });
}
