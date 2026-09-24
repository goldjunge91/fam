import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  confirmReceipt,
  confirmReceiptItem,
  createReceipt,
  createReceiptAssetSignedUrl,
  createReceiptItem,
  deleteReceiptAsset,
  deleteReceiptPermanently,
  getReceipt,
  getReceiptItems,
  listReceiptAssets,
  updateReceiptItem,
} from '@/features/ocr/authority/api';
import type { Database } from '@/lib/database.types';
import { pullHousehold } from '@/lib/sync/pull';
import { pushOutbox } from '@/lib/sync/push';
import {
  assertLocalSupabase,
  type Device,
  makeClient,
  setupTwoDevices,
} from '../../../../test/setup-two-devices';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function randomId(): string {
  return crypto.randomUUID();
}

async function currentUserId(device: Device): Promise<string> {
  const { data, error } = await device.client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Testnutzer fehlt.');
  return data.user.id;
}

async function createOutsider(): Promise<{
  client: SupabaseClient<Database>;
  userId: string;
  cleanup: () => Promise<void>;
}> {
  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt.');
  const admin = createClient<Database>(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const email = `receipt-outsider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'langgenug1';
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;

  const client = makeClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw signInError;
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return {
    client,
    userId: data.user.id,
    cleanup: async () => {
      await admin.auth.admin.deleteUser(data.user.id);
    },
  };
}

async function pullReceipts(device: Device, householdId: string) {
  return pullHousehold({
    db: device.db,
    supabase: device.client,
    householdIds: [householdId],
    entities: ['purchase_receipts', 'purchase_receipt_items'],
    clockCeilingMs: Date.now(),
  });
}

describe('receipt-authority über Server, Local Mirror, Outbox und Storage', () => {
  beforeAll(assertLocalSupabase);

  it('konvergiert für Mitglieder und sperrt einen Außenstehenden', async () => {
    const { deviceA, deviceB, householdId, teardown } = await setupTwoDevices('receipt-authority');
    let outsider: Awaited<ReturnType<typeof createOutsider>> | undefined;
    const userId = await currentUserId(deviceA);
    const receiptId = randomId();
    const firstItemId = randomId();
    const secondItemId = randomId();
    const assetIds = [randomId(), randomId()];
    const assetPaths = assetIds.map((assetId) => `${householdId}/${receiptId}/${assetId}.jpg`);

    try {
      await createReceipt(
        {
          id: receiptId,
          householdId,
          createdBy: userId,
          currency: 'EUR',
          totalCents: 2599,
          processingStatus: 'needs_review',
        },
        { db: deviceA.db },
      );
      await createReceiptItem(
        {
          id: firstItemId,
          receiptId,
          householdId,
          position: 0,
          name: 'Milch',
          categoryId: 'dairy',
          quantity: 1,
          unit: 'piece',
          lineTotalCents: 199,
        },
        { db: deviceA.db },
      );
      await createReceiptItem(
        {
          id: secondItemId,
          receiptId,
          householdId,
          position: 1,
          name: 'Brot',
          categoryId: 'bakery',
          quantity: 1,
          unit: 'piece',
          lineTotalCents: 299,
        },
        { db: deviceA.db },
      );

      const firstPush = await pushOutbox({ db: deviceA.db, supabase: deviceA.client });
      expect(firstPush.outcomes.some((outcome) => outcome.kind === 'pushed')).toBe(true);
      await pullReceipts(deviceB, householdId);
      expect(await getReceipt(deviceB.db, householdId, receiptId)).toMatchObject({
        id: receiptId,
        processing_status: 'needs_review',
        _dirty: 0,
      });
      expect(
        (await getReceiptItems(deviceB.db, householdId, receiptId)).map((item) => item.id),
      ).toEqual([firstItemId, secondItemId]);

      await confirmReceipt({ householdId, receiptId, confirmedBy: userId }, { db: deviceB.db });
      await confirmReceiptItem({ householdId, itemId: firstItemId }, { db: deviceB.db });
      await pushOutbox({ db: deviceB.db, supabase: deviceB.client });

      await updateReceiptItem(
        {
          householdId,
          itemId: firstItemId,
          changes: { name: 'Hafermilch', lineTotalCents: 249 },
        },
        { db: deviceB.db },
      );
      await pushOutbox({ db: deviceB.db, supabase: deviceB.client });
      const remoteItem = await deviceA.client
        .from('purchase_receipt_items')
        .select('name, review_status')
        .eq('id', firstItemId)
        .single();
      expect(remoteItem.error).toBeNull();
      expect(remoteItem.data).toMatchObject({ name: 'Hafermilch', review_status: 'needs_review' });

      const imageBytes = new Uint8Array([1, 2, 3]);
      for (const path of assetPaths) {
        const { error } = await deviceA.client.storage
          .from('receipt-images')
          .upload(path, imageBytes, { contentType: 'image/jpeg', upsert: false });
        expect(error).toBeNull();
      }
      const { error: assetInsertError } = await deviceA.client.from('receipt_assets').insert(
        assetIds.map((assetId, index) => ({
          id: assetId,
          receipt_id: receiptId,
          household_id: householdId,
          storage_path: assetPaths[index] as string,
          mime_type: 'image/jpeg',
          byte_size: imageBytes.byteLength,
          sort_order: index,
          created_by: userId,
        })),
      );
      expect(assetInsertError).toBeNull();

      const assets = await listReceiptAssets(
        { householdId, receiptId },
        { supabase: deviceA.client },
      );
      expect(assets.map((asset) => asset.id)).toEqual(assetIds);
      for (const asset of assets) {
        await expect(
          createReceiptAssetSignedUrl(
            { householdId, receiptId, storagePath: asset.storage_path },
            { supabase: deviceA.client },
          ),
        ).resolves.toMatch(/^http/);
      }

      for (const [index, assetId] of assetIds.entries()) {
        await deleteReceiptAsset(
          {
            householdId,
            receiptId,
            assetId,
            storagePath: assetPaths[index] as string,
          },
          { supabase: deviceA.client },
        );
      }
      expect(
        await listReceiptAssets({ householdId, receiptId }, { supabase: deviceA.client }),
      ).toEqual([]);
      expect(await getReceipt(deviceB.db, householdId, receiptId)).toMatchObject({ id: receiptId });
      expect(await getReceiptItems(deviceB.db, householdId, receiptId)).toHaveLength(2);

      outsider = await createOutsider();
      const outsiderRead = await outsider.client
        .from('purchase_receipts')
        .select('id')
        .eq('id', receiptId);
      expect(outsiderRead.error).toBeNull();
      expect(outsiderRead.data).toEqual([]);

      const outsiderAssetInsert = await outsider.client.from('receipt_assets').insert({
        receipt_id: receiptId,
        household_id: householdId,
        storage_path: `${householdId}/${receiptId}/${randomId()}.jpg`,
        mime_type: 'image/jpeg',
        byte_size: 3,
        created_by: outsider.userId,
      });
      expect(outsiderAssetInsert.error).not.toBeNull();
    } finally {
      await outsider?.cleanup();
      await teardown();
    }
  }, 120_000);

  it('entfernt beim Receipt-Löschen alle Storage-Bilder und synchronisiert Tombstones', async () => {
    const { deviceA, householdId, teardown } = await setupTwoDevices('receipt-delete');
    const userId = await currentUserId(deviceA);
    const receiptId = randomId();
    const itemId = randomId();
    const assetId = randomId();
    const storagePath = `${householdId}/${receiptId}/${assetId}.jpg`;

    try {
      await createReceipt(
        {
          id: receiptId,
          householdId: householdId,
          createdBy: userId,
          processingStatus: 'confirmed',
          totalCents: 1299,
        },
        { db: deviceA.db },
      );
      await createReceiptItem(
        {
          id: itemId,
          receiptId,
          householdId,
          position: 0,
          name: 'Milch',
          lineTotalCents: 199,
          reviewStatus: 'confirmed',
        },
        { db: deviceA.db },
      );
      await pushOutbox({ db: deviceA.db, supabase: deviceA.client });

      const { error: uploadError } = await deviceA.client.storage
        .from('receipt-images')
        .upload(storagePath, new Uint8Array([1, 2, 3]), {
          contentType: 'image/jpeg',
          upsert: false,
        });
      expect(uploadError).toBeNull();
      const { error: assetInsertError } = await deviceA.client.from('receipt_assets').insert({
        id: assetId,
        receipt_id: receiptId,
        household_id: householdId,
        storage_path: storagePath,
        mime_type: 'image/jpeg',
        byte_size: 3,
        created_by: userId,
      });
      expect(assetInsertError).toBeNull();

      await deleteReceiptPermanently(
        { householdId, receiptId },
        { db: deviceA.db, supabase: deviceA.client },
      );
      await pushOutbox({ db: deviceA.db, supabase: deviceA.client });

      expect(
        await listReceiptAssets({ householdId, receiptId }, { supabase: deviceA.client }),
      ).toEqual([]);
      const storageListing = await deviceA.client.storage
        .from('receipt-images')
        .list(`${householdId}/${receiptId}`);
      expect(storageListing.error).toBeNull();
      expect(storageListing.data?.filter((entry) => entry.id !== null)).toEqual([]);

      const remoteReceipt = await deviceA.client
        .from('purchase_receipts')
        .select('deleted_at')
        .eq('id', receiptId)
        .single();
      expect(remoteReceipt.error).toBeNull();
      expect(remoteReceipt.data?.deleted_at).not.toBeNull();

      const remoteItem = await deviceA.client
        .from('purchase_receipt_items')
        .select('deleted_at')
        .eq('id', itemId)
        .single();
      expect(remoteItem.error).toBeNull();
      expect(remoteItem.data?.deleted_at).not.toBeNull();
    } finally {
      await teardown();
    }
  }, 120_000);
});
