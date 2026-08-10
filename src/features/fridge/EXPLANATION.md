# Comprehensive Codebase Explanation: `src/features/fridge`

This document provides a line-by-line and section-by-section walkthrough of all non-test source code files in the `/src/features/fridge` directory.

---

## Directory Overview

The `fridge` feature manages household inventory/fridge items. It provides:
1. **Local Database & Offline First Sync**: Querying and updating local SQLite database tables (`fridge_items`, `storage_locations`) with mutations queued to an outbox queue (`use-fridge-items.ts`, `use-fridge-mutations.ts`).
2. **Best-Before Date (MHD) Calculation**: Calculating remaining days, expiry status buckets (`expired`, `critical`, `soon`, `ok`, `none`), and sorting items accordingly (`expiry.ts`).
3. **Expiry Notifications**: Background sync scheduling local push notifications when items are close to expiring (`use-expiry-notifications.ts`).
4. **UI Components**:
   - `FridgeItemRow`: Individual row item displaying MHD ampel color indicator, name, location, expiry badge, and quantity stepper controls.
   - `FridgeTabBar`: Horizontal tab bar allowing users to filter inventory by storage location (e.g., Fridge, Freezer, Pantry).
   - `FridgeScreen`: Main container screen uniting tab filtering, item lists, quantity adjustments, deletion confirmation alerts, and empty states.

---

## Table of Contents
1. [`src/features/fridge/expiry.ts`](#1-srcfeaturesfridgeexpiryts)
2. [`src/features/fridge/use-fridge-items.ts`](#2-srcfeaturesfridgeuse-fridge-itemsts)
3. [`src/features/fridge/use-fridge-mutations.ts`](#3-srcfeaturesfridgeuse-fridge-mutationsts)
4. [`src/features/fridge/use-expiry-notifications.ts`](#4-srcfeaturesfridgeuse-expiry-notificationsts)
5. [`src/features/fridge/components/fridge-item-row.tsx`](#5-srcfeaturesfridgecomponentsfridge-item-rowtsx)
6. [`src/features/fridge/components/fridge-tab-bar.tsx`](#6-srcfeaturesfridgecomponentsfridge-tab-bartsx)
7. [`src/features/fridge/fridge-screen.tsx`](#7-srcfeaturesfridgefridge-screentsx)

---

## 1. `src/features/fridge/expiry.ts`

This module contains utility functions and types for calculating Best Before Date (Mindesthaltbarkeitsdatum / MHD) buckets, human-readable status labels, color mappings, and sorting rules.

### Line-by-Line Breakdown

```typescript
1: import type { ThemeColor } from '@/constants/theme';
```
- **Line 1**: Imports the `ThemeColor` type from `@/constants/theme` so that expiry status results can specify theme palette color keys (e.g., `'danger'`, `'warning'`, `'textSecondary'`).

```typescript
3: export type ExpiryBucket = 'expired' | 'critical' | 'soon' | 'ok' | 'none';
```
- **Line 3**: Exports `ExpiryBucket` type defining 5 urgency categories:
  - `'expired'`: Best-before date has passed (< 0 days).
  - `'critical'`: Best-before date is today or within 1 to 3 days.
  - `'soon'`: Expiring within 4 to 7 days.
  - `'ok'`: Expiring in more than 7 days.
  - `'none'`: Item has no expiry date set.

```typescript
5: export type ExpiryInfo = {
6:   bucket: ExpiryBucket;
7:   /** Tage bis zum MHD. Negativ = bereits abgelaufen. `null`, wenn kein MHD gesetzt ist. */
8:   daysLeft: number | null;
9:   label: string;
10:  themeColor: ThemeColor;
11: };
```
- **Lines 5–11**: Defines `ExpiryInfo` object structure returned by `getExpiryInfo`.
  - `bucket`: Category bucket (`ExpiryBucket`).
  - `daysLeft`: Signed integer count of calendar days until expiration, or `null` if no date is provided.
  - `label`: Human-readable localized German label string.
  - `themeColor`: Palette key for UI styling.

```typescript
13: const MS_PER_DAY = 86_400_000;
```
- **Line 13**: Constant declaring milliseconds in one day ($24 \times 60 \times 60 \times 1000 = 86,400,000$).

```typescript
15: /**
16:  * Tage zwischen zwei Kalendertagen — bewusst ueber die Datumsanteile, nicht
17:  * ueber die Millisekunden-Differenz.
18:  *
19:  * Sonst waere das Ergebnis von der Uhrzeit abhaengig: "heute 23:00" gegen
20:  * "morgen 01:00" sind zwei Stunden, aber ein Kalendertag. Bei einem
21:  * Mindesthaltbarkeitsdatum zaehlt der Tag, nicht der Zeitpunkt.
22:  */
23: function calendarDaysBetween(from: Date, to: Date): number {
24:   const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
25:   const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
26:   return Math.round((b - a) / MS_PER_DAY);
27: }
```
- **Lines 15–27**: `calendarDaysBetween(from, to)` computes the difference between two `Date` objects in calendar days.
  - **Why**: Standard millisecond difference calculation depends on time-of-day (e.g. 23:00 today vs 01:00 tomorrow is only 2 hours, but represents a calendar day transition). By converting year, month, and date parts to UTC timestamps at 00:00:00, it guarantees pure calendar-day calculations regardless of timezones or time of day.

```typescript
29: /**
30:  * Stuft ein Mindesthaltbarkeitsdatum ein (#71).
31:  *
32:  * `today` wird uebergeben statt intern `new Date()` aufzurufen. Nur so ist die
33:  * Funktion deterministisch und ohne Testdoubles pruefbar — und nur so haengt
34:  * das Ergebnis nicht davon ab, wann der Test zufaellig laeuft.
35:  */
36: export function getExpiryInfo(
37:   expiryDate: Date | string | null | undefined,
38:   today: Date,
39: ): ExpiryInfo {
```
- **Lines 29–39**: Exported function `getExpiryInfo`. Accepts flexible input types for `expiryDate` and explicitly accepts `today: Date` as a parameter to ensure pure deterministic calculation without hidden clock side-effects.

```typescript
40:   if (expiryDate === null || expiryDate === undefined || expiryDate === '') {
41:     return { bucket: 'none', daysLeft: null, label: 'ohne MHD', themeColor: 'textSecondary' };
42:   }
```
- **Lines 40–42**: Edge case handler for missing/empty date inputs. Returns `'none'` bucket with `null` `daysLeft` and `'textSecondary'` color.

```typescript
44:   const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
45: 
46:   if (Number.isNaN(date.getTime())) {
47:     return { bucket: 'none', daysLeft: null, label: 'ohne MHD', themeColor: 'textSecondary' };
48:   }
```
- **Lines 44–48**: Parses string inputs into `Date` objects. If parsing yields an invalid date (`NaN` timestamp), safely falls back to `'none'`.

```typescript
50:   const daysLeft = calendarDaysBetween(today, date);
```
- **Line 50**: Computes calendar day difference.

```typescript
52:   if (daysLeft < 0) {
53:     const days = Math.abs(daysLeft);
54:     return {
55:       bucket: 'expired',
56:       daysLeft,
57:       label: days === 1 ? 'seit gestern abgelaufen' : `seit ${days} Tagen abgelaufen`,
58:       themeColor: 'danger',
59:     };
60:   }
```
- **Lines 52–60**: Handles abgelaufene (expired) items (`daysLeft < 0`). Returns `'expired'` bucket with `'danger'` theme color and formatted string (`"seit gestern abgelaufen"` for 1 day, `"seit X Tagen abgelaufen"` for >1 day).

```typescript
62:   if (daysLeft === 0) {
63:     return { bucket: 'critical', daysLeft, label: 'läuft heute ab', themeColor: 'danger' };
64:   }
```
- **Lines 62–64**: Handles items expiring today (`daysLeft === 0`). Returns `'critical'` bucket with `'danger'` theme color.

```typescript
66:   if (daysLeft <= 3) {
67:     return {
68:       bucket: 'critical',
69:       daysLeft,
70:       label: daysLeft === 1 ? 'noch 1 Tag' : `noch ${daysLeft} Tage`,
71:       themeColor: 'warning',
72:     };
73:   }
```
- **Lines 66–73**: Handles items expiring in 1 to 3 days (`daysLeft <= 3`). Returns `'critical'` bucket with `'warning'` theme color.

```typescript
75:   if (daysLeft <= 7) {
76:     return { bucket: 'soon', daysLeft, label: `noch ${daysLeft} Tage`, themeColor: 'warning' };
77:   }
```
- **Lines 75–77**: Handles items expiring in 4 to 7 days (`daysLeft <= 7`). Returns `'soon'` bucket with `'warning'` theme color.

```typescript
79:   return { bucket: 'ok', daysLeft, label: `noch ${daysLeft} Tage`, themeColor: 'textSecondary' };
80: }
```
- **Lines 79–80**: Default case for items expiring in > 7 days. Returns `'ok'` bucket with `'textSecondary'` color.

```typescript
82: /** Sortierreihenfolge: was zuerst verbraucht werden muss, steht oben. */
83: const BUCKET_ORDER: Record<ExpiryBucket, number> = {
84:   expired: 0,
85:   critical: 1,
86:   soon: 2,
87:   ok: 3,
88:   none: 4,
89: };
```
- **Lines 82–89**: Defines bucket priority numerical values to ensure most urgent items appear at the top.

```typescript
91: export function compareByExpiry(a: ExpiryInfo, b: ExpiryInfo): number {
92:   const byBucket = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
93:   if (byBucket !== 0) return byBucket;
94: 
95:   // Innerhalb einer Stufe: das fruehere Datum zuerst. Artikel ohne MHD ans Ende.
96:   if (a.daysLeft === null) return b.daysLeft === null ? 0 : 1;
97:   if (b.daysLeft === null) return -1;
98:   return a.daysLeft - b.daysLeft;
99: }
```
- **Lines 91–99**: `compareByExpiry` sorting comparator. Compares bucket ranks first; if equal, compares `daysLeft` ascending. Items without expiry dates (`null`) are pushed to the end.

---

## 2. `src/features/fridge/use-fridge-items.ts`

This module defines the hook `useFridgeItems` for reading inventory items from SQLite, enriched with JOINed storage location details and seeded with sample data when an empty household is first opened.

### Line-by-Line Breakdown

```typescript
1: import { useQuery } from '@tanstack/react-query';
2: import * as Crypto from 'expo-crypto';
3: 
4: import { getDatabase } from '@/lib/db/client';
5: import { enqueueMutation } from '@/lib/db/outbox';
```
- **Lines 1–5**: Imports React Query's `useQuery`, Expo Crypto for UUID generation, SQLite database getter `getDatabase`, and outbox synchronization utility `enqueueMutation`.

```typescript
7: export type LocalFridgeItem = {
8:   id: string;
9:   household_id: string;
10:  location_id: string | null;
11:  product_id: string | null;
12:  name: string;
13:  quantity: number;
14:  unit: string;
15:  expiry_date: string | null;
16:  added_by: string | null;
17:  created_at: string;
18:  // JOIN-Felder aus storage_locations
19:  location_kind: string | null;
20:  location_name: string | null;
21: };
```
- **Lines 7–21**: Exports `LocalFridgeItem` interface representing the shape of items returned by the SQL query joining `fridge_items` with `storage_locations`.

```typescript
23: /**
24:  * Liest alle Vorrats-Artikel fuer den Haushalt aus SQLite, mit JOIN
25:  * auf `storage_locations` fuer Lagerort-Name und -Kind (#67).
26:  *
27:  * Sortierung: Ablaufdatum aufsteigend, NULL ans Ende — nutzt die
28:  * Bucket-Logik aus `expiry.ts` implizit (kritische Items stehen oben).
29:  */
30: export function useFridgeItems(householdId: string | undefined) {
31:   return useQuery({
32:     queryKey: ['fridge_items', householdId],
33:     queryFn: async (): Promise<LocalFridgeItem[]> => {
34:       if (!householdId) return [];
```
- **Lines 23–34**: Hook definition `useFridgeItems(householdId)`. Queries items using React Query key `['fridge_items', householdId]`. Immediately returns empty array if `householdId` is undefined.

```typescript
36:       const db = await getDatabase();
37:       const items = await db.getAllAsync<LocalFridgeItem>(
38:         `select
39:            fi.id, fi.household_id, fi.location_id, fi.product_id,
40:            fi.name, fi.quantity, fi.unit, fi.expiry_date, fi.added_by, fi.created_at,
41:            sl.kind as location_kind,
42:            sl.name as location_name
43:          from fridge_items fi
44:          left join storage_locations sl on fi.location_id = sl.id
45:          where fi.household_id = ? and fi.deleted_at is null
46:          order by fi.expiry_date asc nulls last`,
47:         [householdId],
48:       );
```
- **Lines 36–48**: Opens SQLite connection and performs SQL query joining `fridge_items` with `storage_locations`. Filters out soft-deleted items (`fi.deleted_at is null`) and sorts by `expiry_date asc nulls last`.

```typescript
50:       if (items.length > 0) return items;
```
- **Line 50**: If items exist, returns them immediately.

```typescript
52:       // Prüfe ob jemals Artikel da waren
53:       const allRows = await db.getAllAsync<{ id: string }>(
54:         'select id from fridge_items where household_id = ? limit 1',
55:         [householdId],
56:       );
```
- **Lines 52–56**: If `items` is empty, checks if any item (including deleted ones) has ever existed for this household to determine if initial sample data seeding is required.

```typescript
58:       if (allRows.length === 0) {
59:         // Hol den ersten Lagerort
60:         const locations = await db.getAllAsync<{ id: string }>(
61:           'select id from storage_locations where household_id = ? and deleted_at is null order by sort_order limit 1',
62:           [householdId],
63:         );
64:         const locationId = locations[0]?.id ?? null;
```
- **Lines 58–64**: If no items ever existed, queries the first active storage location ID for the household to associate with sample items.

```typescript
66:         const sampleItems = [
67:           { name: 'Vollmilch', quantity: 1, unit: 'l', daysOffset: 2 },
68:           { name: 'Bio-Spinat', quantity: 200, unit: 'g', daysOffset: 1 },
69:           { name: 'Griechischer Joghurt', quantity: 500, unit: 'g', daysOffset: 6 },
70:           { name: 'Hähnchenbrust', quantity: 400, unit: 'g', daysOffset: 1 },
71:           { name: 'Gouda', quantity: 180, unit: 'g', daysOffset: 14 },
72:           { name: 'Orangen-Saft', quantity: 1, unit: 'l', daysOffset: 4 },
73:         ];
```
- **Lines 66–73**: Predefines 6 standard sample household items with varying expiration offsets (`daysOffset`).

```typescript
75:         for (const item of sampleItems) {
76:           const id = Crypto.randomUUID();
77:           const now = new Date().toISOString();
78:           const expDate = new Date(Date.now() + item.daysOffset * 86400000)
79:             .toISOString()
80:             .split('T')[0];
```
- **Lines 75–80**: Iterates over sample items, generating a random UUID and calculating ISO date strings formatted as `YYYY-MM-DD`.

```typescript
82:           await enqueueMutation(db, {
83:             entity: 'fridge_items',
84:             entityId: id,
85:             op: 'insert',
86:             payload: {
87:               id,
88:               household_id: householdId,
89:               location_id: locationId,
90:               name: item.name,
91:               quantity: item.quantity,
92:               unit: item.unit,
93:               expiry_date: expDate,
94:               created_at: now,
95:               updated_at: now,
96:             },
97:             applyLocally: async (txn) => {
98:               await txn.runAsync(
99:                 'insert into fridge_items (id, household_id, location_id, name, quantity, unit, expiry_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
100:                [
101:                  id,
102:                  householdId,
103:                  locationId,
104:                  item.name,
105:                  item.quantity,
106:                  item.unit,
107:                  expDate,
108:                  now,
109:                  now,
110:                ],
111:              );
112:            },
113:          });
114:        }
```
- **Lines 82–114**: Enqueues insertion mutations to the outbox for server sync and executes local SQLite insert queries via `applyLocally`.

```typescript
116:        return db.getAllAsync<LocalFridgeItem>(
117:          `select
118:             fi.id, fi.household_id, fi.location_id, fi.product_id,
119:             fi.name, fi.quantity, fi.unit, fi.expiry_date, fi.added_by, fi.created_at,
120:             sl.kind as location_kind,
121:             sl.name as location_name
122:            from fridge_items fi
123:            left join storage_locations sl on fi.location_id = sl.id
124:            where fi.household_id = ? and fi.deleted_at is null
125:            order by fi.expiry_date asc nulls last`,
126:           [householdId],
127:         );
128:       }
```
- **Lines 116–128**: Re-queries SQLite and returns newly seeded sample items.

```typescript
130:       return items;
131:     },
132:     enabled: !!householdId,
133:   });
134: }
```
- **Lines 130–134**: Returns items and sets query `enabled` flag to `!!householdId` so queries execute only when a valid household ID exists.

---

## 3. `src/features/fridge/use-fridge-mutations.ts`

This module exports React Query mutation hooks for creating new fridge items and updating item quantities or soft-deleting items.

### Line-by-Line Breakdown

```typescript
1: import { useMutation, useQueryClient } from '@tanstack/react-query';
2: import * as Crypto from 'expo-crypto';
3: 
4: import { getDatabase } from '@/lib/db/client';
5: import { enqueueMutation } from '@/lib/db/outbox';
6: import { normalizeUnit } from '@/lib/units';
```
- **Lines 1–6**: Imports dependencies for React Query mutations, UUID creation, SQLite access, offline mutation queuing, and unit normalization (`normalizeUnit`).

```typescript
8: export type FridgeItem = {
9:   id: string;
10:  household_id: string;
11:  location_id: string | null;
12:  name: string;
13:  quantity: number;
14:  unit: string;
15:  expiry_date: string | null;
16: };
```
- **Lines 8–16**: Exports `FridgeItem` interface for mutation payloads.

```typescript
18: export function useAddFridgeItemMutation() {
19:   const queryClient = useQueryClient();
20: 
21:   return useMutation({
22:     mutationFn: async (item: Omit<FridgeItem, 'id'>) => {
23:       const db = await getDatabase();
24:       const id = Crypto.randomUUID();
25:       const now = new Date().toISOString();
26:       const normUnit = normalizeUnit(item.unit);
```
- **Lines 18–26**: Hook `useAddFridgeItemMutation()`. Prepares database client, generates item UUID, captures ISO timestamp, and normalizes item unit (e.g. standardizing unit casing/symbols).

```typescript
28:       await enqueueMutation(db, {
29:         entity: 'fridge_items',
30:         entityId: id,
31:         op: 'insert',
32:         payload: {
33:           id,
34:           ...item,
35:           unit: normUnit,
36:           created_at: now,
37:           updated_at: now,
38:         },
39:         applyLocally: async (txn) => {
40:           await txn.runAsync(
41:             'insert into fridge_items (id, household_id, location_id, name, quantity, unit, expiry_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
42:             [
43:               id,
44:               item.household_id,
45:               item.location_id ?? null,
46:               item.name,
47:               item.quantity,
48:               normUnit,
49:               item.expiry_date ?? null,
50:               now,
51:               now,
52:             ],
53:           );
54:         },
55:       });
56: 
57:       return id;
58:     },
```
- **Lines 28–58**: Enqueues insertion mutation to outbox and performs local SQLite insert inside transaction. Returns new item ID.

```typescript
59:     onSuccess: (_, variables) => {
60:       queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
61:       queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
62:       queryClient.invalidateQueries({ queryKey: ['sync-status'] });
63:     },
64:   });
65: }
```
- **Lines 59–65**: `onSuccess` callback invalidates fridge item queries and outbox sync status queries to refresh UI components across the application.

```typescript
67: export function useUpdateFridgeItemQuantityMutation() {
68:   const queryClient = useQueryClient();
69: 
70:   return useMutation({
71:     mutationFn: async ({
72:       id,
73:       household_id,
74:       delta,
75:     }: {
76:       id: string;
77:       household_id: string;
78:       delta: number;
79:     }) => {
```
- **Lines 67–79**: Hook `useUpdateFridgeItemQuantityMutation()`. Accepts `id`, `household_id`, and numerical `delta` (+1, -1, or negative full quantity).

```typescript
80:       const db = await getDatabase();
81:       const now = new Date().toISOString();
82:       const existing = await db.getFirstAsync<{ quantity: number; name: string }>(
83:         'select quantity, name from fridge_items where id = ?',
84:         [id],
85:       );
86:       if (!existing) return;
```
- **Lines 80–86**: Retrieves existing item from SQLite. If non-existent, exits early.

```typescript
88:       const newQty = Math.max(0, existing.quantity + delta);
```
- **Line 88**: Computes new quantity bound to minimum 0 (`Math.max(0, ...)`).

```typescript
90:       if (newQty === 0) {
91:         await enqueueMutation(db, {
92:           entity: 'fridge_items',
93:           entityId: id,
94:           op: 'delete',
95:           payload: { id, household_id, deleted_at: now, updated_at: now },
96:           applyLocally: async (txn) => {
97:             await txn.runAsync(
98:               'update fridge_items set deleted_at = ?, updated_at = ? where id = ?',
99:               [now, now, id],
100:            );
101:          },
102:        });
```
- **Lines 90–102**: When `newQty === 0`, item is considered consumed/deleted. Enqueues `'delete'` mutation to outbox and sets `deleted_at = now` locally in SQLite.

```typescript
103:      } else {
104:        await enqueueMutation(db, {
105:          entity: 'fridge_items',
106:          entityId: id,
107:          op: 'update',
108:          payload: { id, household_id, quantity: newQty, updated_at: now },
109:          applyLocally: async (txn) => {
110:            await txn.runAsync(
111:              'update fridge_items set quantity = ?, updated_at = ? where id = ?',
112:              [newQty, now, id],
113:            );
114:          },
115:        });
116:      }
117:      return { id, newQty };
118:    },
```
- **Lines 103–118**: When `newQty > 0`, enqueues `'update'` mutation with updated quantity and updates SQLite row locally.

```typescript
119:    onSuccess: (_, variables) => {
120:      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
121:      queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.household_id] });
122:      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
123:    },
124:  });
125: }
```
- **Lines 119–125**: Invalidates React Query caches on success.

---

## 4. `src/features/fridge/use-expiry-notifications.ts`

This module provides the `useExpiryNotifications` hook, which monitors fridge items for upcoming or past expiration dates and synchronizes local push notification schedules.

### Line-by-Line Breakdown

```typescript
1: import { useEffect } from 'react';
2: 
3: import { getExpiryInfo } from '@/features/fridge/expiry';
4: import { useFridgeItems } from '@/features/fridge/use-fridge-items';
5: import { getNotificationSettings, scheduleExpiryNotificationReminder } from '@/lib/notifications';
```
- **Lines 1–5**: Imports React's `useEffect`, expiry classification helper `getExpiryInfo`, fridge item hook `useFridgeItems`, and notification system helpers.

```typescript
7: export function useExpiryNotifications(householdId: string | undefined) {
8:   const { data: fridgeItems = [] } = useFridgeItems(householdId);
```
- **Lines 7–8**: Hook declaration taking optional `householdId`. Fetches current fridge items using `useFridgeItems`.

```typescript
10:  useEffect(() => {
11:    if (!householdId || fridgeItems.length === 0) return;
12:
13:    let isMounted = true;
```
- **Lines 10–13**: `useEffect` trigger on `householdId` or `fridgeItems` change. Early returns if no household ID is active or if items list is empty. Sets `isMounted` flag for async safety.

```typescript
15:    async function syncNotifications() {
16:      const settings = await getNotificationSettings();
17:      if (!isMounted || !settings.enabled) return;
```
- **Lines 15–17**: Asynchronous helper `syncNotifications`. Fetches user notification preferences. Exits if unmounted or if notification reminders are disabled in user settings.

```typescript
19:      const now = new Date();
20:      // Filtere Artikel, die in <= daysThreshold Tagen ablaufen oder bereits abgelaufen sind
21:      const expiringCount = fridgeItems.filter((item) => {
22:        if (!item.expiry_date) return false;
23:        const info = getExpiryInfo(item.expiry_date, now);
24:        if (info.bucket === 'expired' || info.bucket === 'critical') return true;
25:        if (info.daysLeft !== null && info.daysLeft <= settings.daysThreshold) {
26:          return true;
27:        }
28:        return false;
29:      }).length;
```
- **Lines 19–29**: Filters `fridgeItems` to count how many items are expired, critical, or expiring within the user-configured `settings.daysThreshold`.

```typescript
31:      await scheduleExpiryNotificationReminder(expiringCount, settings);
32:    }
33:
34:    syncNotifications();
```
- **Lines 31–34**: Schedules or updates system push notification reminders with total `expiringCount`.

```typescript
36:    return () => {
37:      isMounted = false;
38:    };
39:  }, [householdId, fridgeItems]);
40: }
```
- **Lines 36–40**: Cleanup handler setting `isMounted = false`. Dependency array watches `[householdId, fridgeItems]`.

---

## 5. `src/features/fridge/components/fridge-item-row.tsx`

This component renders an individual fridge inventory row item, including a colored MHD status indicator bar on the left, item details, location name, expiry badge, and interactive stepper controls (+ / -).

### Line-by-Line Breakdown

```typescript
1: import { Pressable, StyleSheet, View } from 'react-native';
2: 
3: import { ThemedText } from '@/components/themed-text';
4: import { Spacing } from '@/constants/theme';
5: import { useTheme } from '@/hooks/use-theme';
6: 
7: import { type ExpiryBucket, getExpiryInfo } from '../expiry';
8: import type { LocalFridgeItem } from '../use-fridge-items';
```
- **Lines 1–8**: Imports React Native UI components, theme hooks/tokens, and local domain types (`ExpiryBucket`, `LocalFridgeItem`, `getExpiryInfo`).

```typescript
10: const EXPIRY_LEFT_BORDER: Record<ExpiryBucket, string> = {
11:   expired: '#C62828',
12:   critical: '#C62828',
13:   soon: '#B26A00',
14:   ok: '#1A7F4B',
15:   none: 'transparent',
16: };
```
- **Lines 10–16**: Constant record mapping each expiry bucket to a specific left border color:
  - `expired` & `critical`: Dark Red (`#C62828`)
  - `soon`: Amber/Orange (`#B26A00`)
  - `ok`: Forest Green (`#1A7F4B`)
  - `none`: `transparent`

```typescript
18: interface FridgeItemRowProps {
19:   item: LocalFridgeItem;
20:   onDecrement: () => void;
21:   onIncrement: () => void;
22:   onDelete: () => void;
23: }
```
- **Lines 18–23**: Prop interface definition for `FridgeItemRow`.

```typescript
25: export function FridgeItemRow({ item, onDecrement, onIncrement, onDelete }: FridgeItemRowProps) {
26:   const theme = useTheme();
27:   const expiry = getExpiryInfo(item.expiry_date, new Date());
28:   const borderColor = EXPIRY_LEFT_BORDER[expiry.bucket];
```
- **Lines 25–28**: Component setup. Obtains current theme palette, calculates `expiry` info relative to `new Date()`, and retrieves indicator `borderColor`.

```typescript
30:   return (
31:     <Pressable
32:       onLongPress={onDelete}
33:       accessibilityRole="button"
34:       accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
35:       accessibilityHint="Lang drücken zum Löschen"
36:       style={[styles.itemRow, { borderBottomColor: theme.border }]}>
```
- **Lines 30–36**: Root `Pressable` row container. Supports long press to trigger `onDelete`, provides accessibility labels for screen readers, and styles bottom divider border color dynamically.

```typescript
37:       {/* MHD-Ampel — linker farbiger Streifen */}
38:       <View style={[styles.expiryBar, { backgroundColor: borderColor }]} />
```
- **Lines 37–38**: Vertical 4px left strip (`styles.expiryBar`) showing the MHD status color.

```typescript
40:       {/* Inhalt */}
41:       <View style={styles.itemMain}>
42:         <ThemedText type="smallBold">{item.name}</ThemedText>
43:         <View style={styles.itemMeta}>
44:           {item.location_name ? (
45:             <ThemedText type="small" themeColor="textSecondary">
46:               {item.location_name}
47:             </ThemedText>
48:           ) : null}
```
- **Lines 40–48**: Main row body. Renders item name in `smallBold` font, followed by storage location name (`location_name`) in secondary text color if present.

```typescript
49:           {expiry.bucket !== 'none' ? (
50:             <View style={[styles.mhdBadge, { backgroundColor: `${theme[expiry.themeColor]}22` }]}>
51:               <ThemedText type="small" style={{ color: theme[expiry.themeColor], fontSize: 11 }}>
52:                 {item.expiry_date
53:                   ? new Date(item.expiry_date).toLocaleDateString('de-DE', {
54:                       day: '2-digit',
55:                       month: '2-digit',
56:                       year: 'numeric',
57:                     })
58:                   : ''}
59:                 {' · '}
60:                 {expiry.bucket === 'critical' || expiry.bucket === 'expired' ? 'Kritisch' : 'Bald'}
61:               </ThemedText>
62:             </View>
63:           ) : null}
64:         </View>
65:       </View>
```
- **Lines 49–65**: Conditionally renders MHD badge pill if `expiry.bucket !== 'none'`. Uses semi-transparent background color (`22` hex opacity). Displays formatted date in `de-DE` locale (`DD.MM.YYYY`) alongside urgency text ("Kritisch" or "Bald").

```typescript
67:       {/* Mengen-Stepper */}
68:       <View style={styles.stepper}>
69:         <Pressable
70:           onPress={onDecrement}
71:           accessibilityRole="button"
72:           accessibilityLabel="Menge reduzieren"
73:           hitSlop={8}
74:           style={[styles.stepperButton, { borderColor: theme.border }]}>
75:           <ThemedText style={styles.stepperIcon}>−</ThemedText>
76:         </Pressable>
```
- **Lines 67–76**: Quantity decrement button with minus symbol (`−`), expanded touch area (`hitSlop={8}`), and accessibility accessibilityLabel `"Menge reduzieren"`.

```typescript
78:         <ThemedText type="smallBold" style={styles.quantity}>
79:           {item.quantity} {item.unit}
80:         </ThemedText>
```
- **Lines 78–80**: Displays current item quantity and unit (e.g. "1 l" or "200 g").

```typescript
82:         <Pressable
83:           onPress={onIncrement}
84:           accessibilityRole="button"
85:           accessibilityLabel="Menge erhöhen"
86:           hitSlop={8}
87:           style={[
88:             styles.stepperButton,
89:             styles.stepperButtonPlus,
90:             { borderColor: theme.success, backgroundColor: `${theme.success}18` },
91:           ]}>
92:           <ThemedText style={[styles.stepperIcon, { color: theme.success }]}>+</ThemedText>
93:         </Pressable>
94:       </View>
95:     </Pressable>
96:   );
97: }
```
- **Lines 82–97**: Quantity increment button formatted in green success theme accent with plus symbol (`+`), triggering `onIncrement`.

```typescript
99: const styles = StyleSheet.create({
100:   itemRow: {
101:     flexDirection: 'row',
102:     alignItems: 'center',
103:     paddingRight: Spacing.three,
104:     paddingVertical: Spacing.three,
105:     borderBottomWidth: StyleSheet.hairlineWidth,
106:     gap: Spacing.three,
107:   },
108:   expiryBar: {
109:     width: 4,
110:     height: '100%',
111:     minHeight: 44,
112:     borderRadius: 2,
113:   },
114:   itemMain: {
115:     flex: 1,
116:     gap: Spacing.half,
117:   },
118:   itemMeta: {
119:     flexDirection: 'row',
120:     alignItems: 'center',
121:     gap: Spacing.two,
122:     flexWrap: 'wrap',
123:   },
124:   mhdBadge: {
125:     paddingHorizontal: Spacing.two,
126:     paddingVertical: 2,
127:     borderRadius: 6,
128:   },
129:   stepper: {
130:     flexDirection: 'row',
131:     alignItems: 'center',
132:     gap: Spacing.two,
133:   },
134:   stepperButton: {
135:     width: 30,
136:     height: 30,
137:     borderRadius: 15,
138:     borderWidth: 1,
139:     alignItems: 'center',
140:     justifyContent: 'center',
141:   },
142:   stepperButtonPlus: {
143:     borderWidth: 1,
144:   },
145:   stepperIcon: {
146:     fontSize: 18,
147:     lineHeight: 22,
148:   },
149:   quantity: {
150:     minWidth: 54,
151:     textAlign: 'center',
152:   },
153: });
```
- **Lines 99–153**: Component stylesheet defining layout geometry, flex direction, badge padding, circular stepper button dimensions ($30 \times 30$, `borderRadius: 15`), and text alignment.

---

## 6. `src/features/fridge/components/fridge-tab-bar.tsx`

This component renders a horizontally scrollable tab bar for filtering inventory by storage location (e.g. All, Fridge, Freezer, Pantry).

### Line-by-Line Breakdown

```typescript
1: import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
2: 
3: import { ThemedText } from '@/components/themed-text';
4: import { Spacing } from '@/constants/theme';
5: import type { StorageLocation } from '@/features/inventory/use-storage-locations';
6: import { useTheme } from '@/hooks/use-theme';
7: import type { LocalFridgeItem } from '../use-fridge-items';
```
- **Lines 1–7**: Imports UI primitives, types for storage locations and fridge items, theme hooks, and design system constants.

```typescript
9: export function getIconForLocation(kind?: string | null, name?: string | null): string {
10:   const k = (kind ?? '').toLowerCase();
11:   const n = (name ?? '').toLowerCase();
12:   if (k === 'fridge') return '🫙';
13:   if (k === 'freezer') return '❄️';
14:   if (k === 'pantry') return '🥫';
15:   if (
16:     n.includes('tief') ||
17:     n.includes('frost') ||
18:     n.includes('eis') ||
19:     n.includes('frier') ||
20:     n.includes('freezer')
21:   )
22:     return '❄️';
23:   if (n.includes('kühl') || n.includes('fridge')) return '🫙';
24:   if (n.includes('kammer') || n.includes('schrank') || n.includes('regal') || n.includes('pantry'))
25:     return '🥫';
26:   return '📦';
27: }
```
- **Lines 9–27**: Exported helper `getIconForLocation`. Determines an emoji icon representation for a location based on location `kind` or keyword matching in location `name`:
  - Freezer/Ice keywords (`tief`, `frost`, `eis`, `frier`, `freezer`) $\rightarrow$ ❄️
  - Fridge keywords (`kühl`, `fridge`) $\rightarrow$ 🫙
  - Pantry/Cabinet keywords (`kammer`, `schrank`, `regal`, `pantry`) $\rightarrow$ 🥫
  - Default fallback $\rightarrow$ 📦

```typescript
29: interface FridgeTabBarProps {
30:   activeTab: string; // 'all' or location.id
31:   onTabChange: (id: string) => void;
32:   locations: StorageLocation[];
33:   items: LocalFridgeItem[];
34: }
```
- **Lines 29–34**: Prop interface for `FridgeTabBar`.

```typescript
36: export function FridgeTabBar({ activeTab, onTabChange, locations, items }: FridgeTabBarProps) {
37:   const theme = useTheme();
38: 
39:   return (
40:     <ScrollView
41:       horizontal
42:       showsHorizontalScrollIndicator={false}
43:       contentContainerStyle={[styles.tabBar, { backgroundColor: theme.backgroundElement }]}>
```
- **Lines 36–43**: Component signature and root horizontal `ScrollView` container with hidden scroll indicators.

```typescript
44:       <Pressable
45:         onPress={() => onTabChange('all')}
46:         accessibilityRole="tab"
47:         accessibilityState={{ selected: activeTab === 'all' }}
48:         style={[
49:           styles.tab,
50:           activeTab === 'all' && {
51:             backgroundColor: theme.background,
52:             borderColor: theme.accent,
53:             borderWidth: 1,
54:           },
55:         ]}>
56:         <ThemedText style={styles.tabIcon}>📦</ThemedText>
57:         <ThemedText
58:           type="small"
59:           style={{
60:             color: activeTab === 'all' ? theme.text : theme.textSecondary,
61:             fontWeight: activeTab === 'all' ? '600' : '400',
62:           }}>
63:           Alle
64:         </ThemedText>
65:         {items.length > 0 && (
66:           <View
67:             style={[
68:               styles.tabBadge,
69:               { backgroundColor: activeTab === 'all' ? theme.accent : theme.textSecondary },
70:             ]}>
71:             <ThemedText style={styles.tabBadgeText}>{items.length}</ThemedText>
72:           </View>
73:         )}
74:       </Pressable>
```
- **Lines 44–74**: Renders the "Alle" (All items) tab button. Shows package emoji 📦, total items count badge, and applies active selection border styling when `activeTab === 'all'`.

```typescript
76:       {locations.map((loc) => {
77:         const isActive = activeTab === loc.id;
78:         const icon = getIconForLocation(loc.kind, loc.name);
79:         const count = items.filter((i) => i.location_id === loc.id).length;
```
- **Lines 76–79**: Maps over dynamic `locations` array, evaluating active state, location icon, and filtered item count (`count`).

```typescript
81:         return (
82:           <Pressable
83:             key={loc.id}
84:             onPress={() => onTabChange(loc.id)}
85:             accessibilityRole="tab"
86:             accessibilityState={{ selected: isActive }}
87:             style={[
88:               styles.tab,
89:               isActive && {
90:                 backgroundColor: theme.background,
91:                 borderColor: theme.accent,
92:                 borderWidth: 1,
93:               },
94:             ]}>
95:             <ThemedText style={styles.tabIcon}>{icon}</ThemedText>
96:             <ThemedText
97:               type="small"
98:               style={{
99:                 color: isActive ? theme.text : theme.textSecondary,
100:                fontWeight: isActive ? '600' : '400',
101:              }}>
102:              {loc.name}
103:            </ThemedText>
104:            {count > 0 && (
105:              <View
106:                style={[
107:                  styles.tabBadge,
108:                  { backgroundColor: isActive ? theme.accent : theme.textSecondary },
109:                ]}>
110:                <ThemedText style={styles.tabBadgeText}>{count}</ThemedText>
111:              </View>
112:            )}
113:          </Pressable>
114:        );
115:      })}
116:    </ScrollView>
117:  );
118: }
```
- **Lines 81–118**: Renders tab pressable button for each location with appropriate accessibility role, active styles, icon, location name, and location item count badge.

```typescript
120: const styles = StyleSheet.create({
121:   tabBar: {
122:     flexDirection: 'row',
123:     borderRadius: Spacing.three,
124:     padding: Spacing.half,
125:     gap: Spacing.half,
126:     alignItems: 'center',
127:   },
128:   tab: {
129:     flexDirection: 'row',
130:     alignItems: 'center',
131:     justifyContent: 'center',
132:     gap: Spacing.one,
133:     paddingHorizontal: Spacing.three,
134:     paddingVertical: Spacing.two,
135:     borderRadius: Spacing.two + 2,
136:   },
137:   tabIcon: {
138:     fontSize: 14,
139:   },
140:   tabBadge: {
141:     minWidth: 18,
142:     height: 18,
143:     borderRadius: 9,
144:     alignItems: 'center',
145:     justifyContent: 'center',
146:     paddingHorizontal: 4,
147:   },
148:   tabBadgeText: {
149:     color: '#fff',
150:     fontSize: 11,
151:     fontWeight: '700',
152:   },
153: });
```
- **Lines 120–153**: Stylesheet defining horizontal row tab bar layout, pill shapes, badge dimensions, and typography.

---

## 7. `src/features/fridge/fridge-screen.tsx`

This file implements the main `FridgeScreen` component. It brings together active household data, storage locations, fridge items, tab filtering, step handlers, item deletion confirmation alerts, and empty state fallbacks.

### Line-by-Line Breakdown

```typescript
1: import { useState } from 'react';
2: import { Alert, FlatList, StyleSheet, View } from 'react-native';
3: 
4: import { Card } from '@/components/card';
5: import { EmptyState } from '@/components/empty-state';
6: import { Screen } from '@/components/screen';
7: import { ThemedText } from '@/components/themed-text';
8: import { Spacing } from '@/constants/theme';
9: import { useActiveHousehold } from '@/features/household/active-household-provider';
10: import { useStorageLocations } from '@/features/inventory/use-storage-locations';
11: 
12: import { FridgeItemRow } from './components/fridge-item-row';
13: import { FridgeTabBar } from './components/fridge-tab-bar';
14: import { getExpiryInfo } from './expiry';
15: import { type LocalFridgeItem, useFridgeItems } from './use-fridge-items';
16: import { useUpdateFridgeItemQuantityMutation } from './use-fridge-mutations';
```
- **Lines 1–16**: Imports React state management, React Native UI components (`Alert`, `FlatList`), global UI components (`Screen`, `Card`, `EmptyState`, `ThemedText`), household & location hooks, and fridge feature subcomponents.

```typescript
18: /**
19:  * Vorrat-Bestand, dynamisch gefiltered nach Lagerort (#67).
20:  *
21:  * - Dynamische Tab-Filter basierend auf den Lagerorten aus den Einstellungen
22:  * - Farbiger linker Rand als MHD-Ampel (#71, expiry.ts)
23:  * - MHD-Badge + Stepper (− / + )
24:  * - Lang drücken = Löschen-Bestätigung
25:  */
26: export function FridgeScreen() {
27:   const [activeTab, setActiveTab] = useState<string>('all');
```
- **Lines 18–27**: Declares `FridgeScreen` component and initializes `activeTab` state to `'all'`.

```typescript
29:   const { activeHouseholdId } = useActiveHousehold();
30:   const householdId = activeHouseholdId ?? undefined;
31: 
32:   const { data: locations = [] } = useStorageLocations(householdId);
33:   const { data: allItems = [], isLoading } = useFridgeItems(householdId);
34:   const updateQty = useUpdateFridgeItemQuantityMutation();
```
- **Lines 29–34**: Retrieves current household ID, fetches storage locations and fridge items, and initializes the quantity mutation hook.

```typescript
36:   const expiringCount = allItems.filter((item) => {
37:     if (!item?.expiry_date) return false;
38:     const info = getExpiryInfo(item.expiry_date, new Date());
39:     return info.bucket === 'critical' || info.bucket === 'expired';
40:   }).length;
```
- **Lines 36–40**: Computes `expiringCount` by checking items whose expiry bucket is `'critical'` or `'expired'`.

```typescript
42:   const visibleItems =
43:     activeTab === 'all' ? allItems : allItems.filter((item) => item.location_id === activeTab);
```
- **Lines 42–43**: Filters items displayed in the list according to `activeTab`.

```typescript
45:   function handleDecrement(item: LocalFridgeItem) {
46:     if (!householdId) return;
47:     if (item.quantity <= 1) {
48:       Alert.alert('Artikel verbraucht?', `"${item.name}" aus dem Vorrat entfernen?`, [
49:         { text: 'Behalten', style: 'cancel' },
50:         {
51:           text: 'Entfernen',
52:           style: 'destructive',
53:           onPress: () => updateQty.mutate({ id: item.id, household_id: householdId, delta: -1 }),
54:         },
55:       ]);
56:     } else {
57:       updateQty.mutate({ id: item.id, household_id: householdId, delta: -1 });
58:     }
59:   }
```
- **Lines 45–59**: Decrement button handler `handleDecrement`. If quantity is 1, displays an explicit native confirmation alert asking if the item should be removed. If confirmed or quantity > 1, fires quantity update mutation with `delta: -1`.

```typescript
61:   function handleIncrement(item: LocalFridgeItem) {
62:     if (!householdId) return;
63:     updateQty.mutate({ id: item.id, household_id: householdId, delta: 1 });
64:   }
```
- **Lines 61–64**: Increment button handler `handleIncrement`. Fires quantity update mutation with `delta: 1`.

```typescript
66:   function handleDeletePress(item: LocalFridgeItem) {
67:     if (!householdId) return;
68:     Alert.alert('Artikel löschen', `"${item.name}" sofort aus dem Vorrat entfernen?`, [
69:       { text: 'Abbrechen', style: 'cancel' },
70:       {
71:         text: 'Löschen',
72:         style: 'destructive',
73:         onPress: () =>
74:           updateQty.mutate({
75:             id: item.id,
76:             household_id: householdId,
77:             delta: -item.quantity,
78:           }),
79:       },
80:     ]);
81:   }
```
- **Lines 66–81**: Long press delete handler `handleDeletePress`. Presents confirmation dialog asking to delete item immediately. If confirmed, mutates quantity by `-item.quantity`, reducing total quantity to 0 and triggering soft deletion.

```typescript
83:   if (!householdId) {
84:     return (
85:       <Screen title="Vorrat" subtitle="Für alle im Haushalt sichtbar">
86:         <Card>
87:           <EmptyState
88:             symbol="archivebox"
89:             title="Noch kein Haushalt"
90:             hint="Lege im Profil einen Haushalt an oder tritt einem bei. Danach teilt ihr Vorrat und Einkaufsliste in Echtzeit."
91:           />
92:         </Card>
93:       </Screen>
94:     );
95:   }
```
- **Lines 83–95**: Renders an empty state screen if user has not selected/joined an active household yet.

```typescript
97:   const subtitle =
98:     allItems.length > 0
99:       ? `${allItems.length} Artikel gesamt · Tippe für Nährwerte`
100:      : 'Für alle im Haushalt sichtbar';
101:
102:  const activeLocationName =
103:    activeTab === 'all'
104:      ? 'Vorrat'
105:      : (locations.find((l) => l.id === activeTab)?.name ?? 'Lagerort');
```
- **Lines 97–105**: Computes screen header subtitle text and active storage location name.

```typescript
107:  return (
108:    <Screen
109:      title="Vorrat"
110:      subtitle={subtitle}
111:      action={
112:        expiringCount > 0 ? (
113:          <View style={styles.expiringBadge}>
114:            <ThemedText style={styles.expiringBadgeText}>⚠ {expiringCount} ablaufend</ThemedText>
115:          </View>
116:        ) : undefined
117:      }>
```
- **Lines 107–117**: Primary `Screen` wrapper. Displays title, subtitle, and an action badge (`⚠ X ablaufend`) if items are expiring.

```typescript
118:      {/* Dynamic Tab-Leiste für alle Lagerorte aus den Einstellungen */}
119:      <FridgeTabBar
120:        activeTab={activeTab}
121:        onTabChange={setActiveTab}
122:        locations={locations}
123:        items={allItems}
124:      />
```
- **Lines 118–124**: Renders `FridgeTabBar` for location tab switching.

```typescript
126:      {/* Artikel-Liste des aktiven Tabs */}
127:      {isLoading ? null : visibleItems.length === 0 ? (
128:        <Card style={{ marginTop: Spacing.two }}>
129:          <EmptyState
130:            symbol="archivebox"
131:            title={`${activeLocationName} ist leer`}
132:            hint="Schließe einen Einkauf ab oder füge Artikel manuell hinzu."
133:          />
134:        </Card>
135:      ) : (
136:        <FlatList
137:          data={visibleItems}
138:          keyExtractor={(item) => item.id}
139:          scrollEnabled={false}
140:          style={{ marginTop: Spacing.two }}
141:          renderItem={({ item }) => (
142:            <FridgeItemRow
143:              item={item}
144:              onDecrement={() => handleDecrement(item)}
145:              onIncrement={() => handleIncrement(item)}
146:              onDelete={() => handleDeletePress(item)}
147:            />
148:          )}
149:        />
150:      )}
151:    </Screen>
152:  );
153: }
```
- **Lines 126–153**: Renders main inventory contents: displays an empty state card if no items exist in the active tab, or renders a non-scrollable `FlatList` of `FridgeItemRow` components.

```typescript
155: const styles = StyleSheet.create({
156:   expiringBadge: {
157:     backgroundColor: '#FFF3E0',
158:     paddingHorizontal: Spacing.two,
159:     paddingVertical: Spacing.one,
160:     borderRadius: Spacing.two,
161:   },
162:   expiringBadgeText: {
163:     color: '#B26A00',
164:     fontSize: 12,
165:     fontWeight: '600',
166:   },
167: });
```
- **Lines 155–167**: Stylesheet for the header expiring warning badge container and text.
