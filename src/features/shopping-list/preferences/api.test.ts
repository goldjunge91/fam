import { enqueueMutation } from '@/lib/db/outbox';
import {
  findNamePreference,
  findProductPreference,
  resetCategoryPreference,
  resolveCategoryForItem,
  setCategoryPreference,
} from './api';

const mockEnqueueMutation = enqueueMutation as jest.Mock;

type FakeRow = {
  id: string;
  household_id: string;
  key_type: 'product' | 'name';
  normalized_key_value: string;
  category_id: string | null;
  created_by: string | null;
  created_at: string | null;
  deleted_at: number | null;
};

let mockRows: FakeRow[] = [];

jest.mock('@/lib/db/client', () => ({
  getDatabase: jest.fn(async () => ({
    getFirstAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('shopping_category_preferences where id = ?')) {
        const [id] = params as [string];
        const row = mockRows.find((r) => r.id === id);
        return row ? { id: row.id, deleted_at: row.deleted_at } : null;
      }
      const [householdId, keyValue] = params as [string, string];
      const keyType = sql.includes("key_type = 'product'") ? 'product' : 'name';
      const row = mockRows.find(
        (r) =>
          r.household_id === householdId &&
          r.key_type === keyType &&
          r.normalized_key_value === keyValue &&
          r.deleted_at === null,
      );
      return row ?? null;
    }),
    runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
  })),
}));

jest.mock('@/lib/db/outbox', () => ({
  enqueueMutation: jest.fn().mockResolvedValue(undefined),
}));

// Die UUIDv5-Identitaet wird separat getestet; hier genuegt ein deterministischer Adapter.
jest.mock('./preference-identity.expo', () => ({
  preferenceId: jest.fn(
    async ({
      householdId,
      keyType,
      normalizedKeyValue,
    }: {
      householdId: string;
      keyType: string;
      normalizedKeyValue: string;
    }) => `pref:${householdId}:${keyType}:${normalizedKeyValue}`,
  ),
}));

describe('preferences/api', () => {
  beforeEach(() => {
    mockRows = [];
    mockEnqueueMutation.mockClear();
  });

  describe('findProductPreference / findNamePreference', () => {
    it('findet eine aktive Produkt-Praeferenz case-insensitiv', async () => {
      mockRows.push({
        id: 'p1',
        household_id: 'hh-1',
        key_type: 'product',
        normalized_key_value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'dairy',
        created_by: null,
        created_at: null,
        deleted_at: null,
      });

      const result = await findProductPreference('hh-1', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA');
      expect(result?.category_id).toBe('dairy');
    });

    it('ignoriert soft-deletete Produkt-Praeferenzen', async () => {
      mockRows.push({
        id: 'p1',
        household_id: 'hh-1',
        key_type: 'product',
        normalized_key_value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        category_id: 'dairy',
        created_by: null,
        created_at: null,
        deleted_at: 123,
      });

      const result = await findProductPreference('hh-1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      expect(result).toBeNull();
    });

    it('normalisiert den Namen vor der Namens-Suche', async () => {
      mockRows.push({
        id: 'p2',
        household_id: 'hh-1',
        key_type: 'name',
        normalized_key_value: 'hafermilch',
        category_id: 'dairy',
        created_by: null,
        created_at: null,
        deleted_at: null,
      });

      const result = await findNamePreference('hh-1', '  HaferMilch  ');
      expect(result?.category_id).toBe('dairy');
    });

    it('liefert null fuer einen leeren normalisierten Namen, ohne zu suchen', async () => {
      const result = await findNamePreference('hh-1', '   ');
      expect(result).toBeNull();
    });
  });

  describe('resolveCategoryForItem', () => {
    it('nutzt die Produkt-Praeferenz vor der Namens-Praeferenz', async () => {
      mockRows.push(
        {
          id: 'p1',
          household_id: 'hh-1',
          key_type: 'product',
          normalized_key_value: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          category_id: 'deli_meat',
          created_by: null,
          created_at: null,
          deleted_at: null,
        },
        {
          id: 'p2',
          household_id: 'hh-1',
          key_type: 'name',
          normalized_key_value: 'schwein schnitzel',
          category_id: 'beverages',
          created_by: null,
          created_at: null,
          deleted_at: null,
        },
      );

      const result = await resolveCategoryForItem({
        householdId: 'hh-1',
        productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Schwein Schnitzel',
      });

      expect(result).toMatchObject({ categoryId: 'deli_meat', source: 'household_preference' });
    });

    it('faellt ohne Praeferenzen auf die automatische Klassifikation zurueck', async () => {
      const result = await resolveCategoryForItem({
        householdId: 'hh-1',
        name: '2 Schnitzel vom Schwein Spar Fein Küche',
      });

      expect(result.categoryId).toBe('deli_meat');
      expect(result.source).not.toBe('household_preference');
    });
  });

  describe('setCategoryPreference', () => {
    it('legt eine neue Praeferenz per insert an', async () => {
      await setCategoryPreference({
        householdId: 'hh-1',
        keyType: 'name',
        keyValue: '  Hafermilch ',
        categoryId: 'dairy',
        createdBy: 'user-1',
      });

      expect(mockEnqueueMutation).toHaveBeenCalledTimes(1);
      expect(mockEnqueueMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          entity: 'shopping_category_preferences',
          op: 'insert',
          entityId: 'pref:hh-1:name:hafermilch',
          payload: expect.objectContaining({
            normalized_key_value: 'hafermilch',
            category_id: 'dairy',
          }),
        }),
      );
    });

    it('aktualisiert eine bestehende aktive Praeferenz per update, ohne insert', async () => {
      mockRows.push({
        id: 'pref:hh-1:name:hafermilch',
        household_id: 'hh-1',
        key_type: 'name',
        normalized_key_value: 'hafermilch',
        category_id: 'dairy',
        created_by: 'user-1',
        created_at: null,
        deleted_at: null,
      });

      await setCategoryPreference({
        householdId: 'hh-1',
        keyType: 'name',
        keyValue: 'Hafermilch',
        categoryId: 'beverages',
        createdBy: 'user-2',
      });

      expect(mockEnqueueMutation).toHaveBeenCalledTimes(1);
      expect(mockEnqueueMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ op: 'update', entityId: 'pref:hh-1:name:hafermilch' }),
      );
    });

    it('reaktiviert eine lokal bekannte, soft-deletete Praeferenz per restore + update', async () => {
      mockRows.push({
        id: 'pref:hh-1:name:hafermilch',
        household_id: 'hh-1',
        key_type: 'name',
        normalized_key_value: 'hafermilch',
        category_id: null,
        created_by: 'user-1',
        created_at: null,
        deleted_at: 999,
      });

      await setCategoryPreference({
        householdId: 'hh-1',
        keyType: 'name',
        keyValue: 'Hafermilch',
        categoryId: 'dairy',
        createdBy: 'user-2',
      });

      expect(mockEnqueueMutation).toHaveBeenCalledTimes(2);
      expect(mockEnqueueMutation.mock.calls[0][1]).toMatchObject({ op: 'restore' });
      expect(mockEnqueueMutation.mock.calls[1][1]).toMatchObject({
        op: 'update',
        payload: expect.objectContaining({ category_id: 'dairy' }),
      });
    });
  });

  describe('resetCategoryPreference', () => {
    it('loescht eine aktive Praeferenz soft', async () => {
      mockRows.push({
        id: 'pref:hh-1:name:hafermilch',
        household_id: 'hh-1',
        key_type: 'name',
        normalized_key_value: 'hafermilch',
        category_id: 'dairy',
        created_by: 'user-1',
        created_at: null,
        deleted_at: null,
      });

      await resetCategoryPreference({
        householdId: 'hh-1',
        keyType: 'name',
        keyValue: 'Hafermilch',
      });

      expect(mockEnqueueMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ op: 'delete', entityId: 'pref:hh-1:name:hafermilch' }),
      );
    });

    it('tut nichts, wenn keine aktive Praeferenz existiert', async () => {
      await resetCategoryPreference({
        householdId: 'hh-1',
        keyType: 'name',
        keyValue: 'Unbekannt',
      });
      expect(mockEnqueueMutation).not.toHaveBeenCalled();
    });

    it('tut nichts, wenn die Praeferenz bereits soft-deleted ist', async () => {
      mockRows.push({
        id: 'pref:hh-1:name:hafermilch',
        household_id: 'hh-1',
        key_type: 'name',
        normalized_key_value: 'hafermilch',
        category_id: 'dairy',
        created_by: 'user-1',
        created_at: null,
        deleted_at: 999,
      });

      await resetCategoryPreference({
        householdId: 'hh-1',
        keyType: 'name',
        keyValue: 'Hafermilch',
      });
      expect(mockEnqueueMutation).not.toHaveBeenCalled();
    });
  });
});
