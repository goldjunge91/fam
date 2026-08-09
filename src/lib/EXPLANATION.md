# Codebase Documentation: `src/lib`

This document provides complete, section-by-section and line-by-line technical documentation of all 35 non-test TypeScript source files in `src/lib` (including subdirectories `db` and `sync`).

---

## Table of Contents
- [Root Level Modules](#root-level-modules)
  1. [`src/lib/auth-deep-link-state.ts`](#1-srclibauth-deep-link-statets)
  2. [`src/lib/auth-deep-link.ts`](#2-srclibauth-deep-linkts)
  3. [`src/lib/chunked-storage.ts`](#3-srclibchunked-storagets)
  4. [`src/lib/database.types.ts`](#4-srclibdatabase-typests)
  5. [`src/lib/env.ts`](#5-srclibenvts)
  6. [`src/lib/notifications.ts`](#6-srclibnotificationsts)
  7. [`src/lib/open-food-facts.ts`](#7-srclibopen-food-factsts)
  8. [`src/lib/pending-invite.ts`](#8-srclibpending-invitets)
  9. [`src/lib/query-client.ts`](#9-srclibquery-clientts)
  10. [`src/lib/supabase.ts`](#10-srclibsupabasets)
  11. [`src/lib/units.ts`](#11-srclibunitsts)
- [Database Layer (`src/lib/db/`)](#database-layer-srclibdb)
  12. [`src/lib/db/client.ts`](#12-srclibdbclientts)
  13. [`src/lib/db/entities.ts`](#13-srclibdbentitiests)
  14. [`src/lib/db/index.ts`](#14-srclibdbindexts)
  15. [`src/lib/db/migrations.ts`](#15-srclibdbmigrationsts)
  16. [`src/lib/db/migrator.ts`](#16-srclibdbmigratorts)
  17. [`src/lib/db/outbox-retry.ts`](#17-srclibdboutbox-retryts)
  18. [`src/lib/db/outbox.ts`](#18-srclibdboutboxts)
  19. [`src/lib/db/sync-state.ts`](#19-srclibdbsync-statets)
  20. [`src/lib/db/types.ts`](#20-srclibdbtypests)
- [Sync Engine (`src/lib/sync/`)](#sync-engine-srclibsync)
  21. [`src/lib/sync/background-sync.ts`](#21-srclibsyncbackground-syncts)
  22. [`src/lib/sync/backoff.ts`](#22-srclibsyncbackoffts)
  23. [`src/lib/sync/coalesce.ts`](#23-srclibsynccoalescets)
  24. [`src/lib/sync/cursor.ts`](#24-srclibsynccursorts)
  25. [`src/lib/sync/engine.ts`](#25-srclibsyncenginets)
  26. [`src/lib/sync/mirror-write.ts`](#26-srclibsyncmirror-writets)
  27. [`src/lib/sync/network-trigger.ts`](#27-srclibsyncnetwork-triggerts)
  28. [`src/lib/sync/pull.ts`](#28-srclibsyncpullts)
  29. [`src/lib/sync/push.ts`](#29-srclibsyncpushts)
  30. [`src/lib/sync/realtime.ts`](#30-srclibsyncrealtimets)
  31. [`src/lib/sync/reconnect.ts`](#31-srclibsyncreconnectts)
  32. [`src/lib/sync/resolve.ts`](#32-srclibsyncresolvets)
  33. [`src/lib/sync/server-clock.ts`](#33-srclibsyncserver-clockts)
  34. [`src/lib/sync/sync-runner.ts`](#34-srclibsyncsync-runnerts)
  35. [`src/lib/sync/sync-status.ts`](#35-srclibsyncsync-statusts)

---

## Root Level Modules

### 1. `src/lib/auth-deep-link-state.ts`

Manages state for auth deep link failure errors. Stores the error in module state so cold-start deep link failures (e.g. from `Linking.getInitialURL()`) are preserved before React UI components mount and subscribe.

```typescript
1: /**
...
15:  */
16: type Listener = (error: string | null) => void;
17: 
18: let lastError: string | null = null;
19: const listeners = new Set<Listener>();
20: 
21: export function setAuthDeepLinkError(error: string | null): void {
22:   lastError = error;
23:   for (const listener of listeners) listener(error);
24: }
25: 
26: export function getAuthDeepLinkError(): string | null {
27:   return lastError;
28: }
29: 
30: /**
...
33:  */
34: export function subscribeAuthDeepLinkError(listener: Listener): () => void {
35:   listeners.add(listener);
36:   listener(lastError);
37:   return () => {
38:     listeners.delete(listener);
39:   };
40: }
41: 
42: /** Nach dem Anzeigen aufraeumen, damit der Fehler nicht bei der naechsten
43:  *  Registrierung erneut auftaucht. */
44: export function clearAuthDeepLinkError(): void {
45:   setAuthDeepLinkError(null);
46: }
```

- **Lines 1–15**: Documentation explaining why a module-level state store is required instead of a React Context. Deep links received during a cold start arrive before any React component mounts.
- **Line 16**: Defines `Listener` type signature taking `error: string | null`.
- **Lines 18–19**: `lastError` holds the recorded error message. `listeners` Set maintains active subscriber callbacks.
- **Lines 21–24**: `setAuthDeepLinkError()` sets `lastError` and immediately notifies all registered listeners.
- **Lines 26–28**: `getAuthDeepLinkError()` synchronously returns `lastError`.
- **Lines 34–40**: `subscribeAuthDeepLinkError()` registers a listener, immediately invokes it with `lastError` to deliver cold-start errors, and returns an unsubscribe function.
- **Lines 44–46**: `clearAuthDeepLinkError()` resets the error state to `null` after the UI banner presents it to the user.

---

### 2. `src/lib/auth-deep-link.ts`

Parses access tokens or error payloads embedded in the URL fragment (`#`) of authentication deep links.

```typescript
1: /**
...
13:  */
14: export interface AuthDeepLinkTokens {
15:   accessToken: string;
16:   refreshToken: string;
17: }
18: 
19: export function parseAuthTokensFromUrl(url: string): AuthDeepLinkTokens | null {
20:   const hashIndex = url.indexOf('#');
21:   if (hashIndex === -1) return null;
22: 
23:   const params = new URLSearchParams(url.slice(hashIndex + 1));
24:   const accessToken = params.get('access_token');
25:   const refreshToken = params.get('refresh_token');
26:   if (!accessToken || !refreshToken) return null;
27: 
28:   return { accessToken, refreshToken };
29: }
30: 
31: /**
...
34:  */
35: export function parseAuthErrorFromUrl(url: string): string | null {
36:   const hashIndex = url.indexOf('#');
37:   if (hashIndex === -1) return null;
38: 
39:   const params = new URLSearchParams(url.slice(hashIndex + 1));
40:   const description = params.get('error_description');
41:   return description ? description.replace(/\+/g, ' ') : params.get('error_code');
42: }
```

- **Lines 1–13**: Explains Supabase's implicit auth flow (`flowType: 'implicit'`). Tokens are passed in URL fragments (`#access_token=...&refresh_token=...`) so sensitive tokens are not sent to server logs.
- **Lines 14–17**: `AuthDeepLinkTokens` structure holding `accessToken` and `refreshToken`.
- **Lines 19–29**: `parseAuthTokensFromUrl()` finds `#`, extracts URL hash parameters via `URLSearchParams`, and returns valid tokens or `null`.
- **Lines 35–42**: `parseAuthErrorFromUrl()` extracts `error_description` (replacing `+` spaces) or `error_code` if an auth link has expired or failed.

---

### 3. `src/lib/chunked-storage.ts`

Storage adapter that transparently splits values larger than 1024 bytes into indexed chunk entries (`key.0`, `key.1`, ...). Solves the ~2048-byte per-entry limit on iOS `expo-secure-store`.

```typescript
1: /**
...
17:  */
18: 
19: export type KeyValueStore = {
20:   getItem(key: string): Promise<string | null>;
21:   setItem(key: string, value: string): Promise<void>;
22:   removeItem(key: string): Promise<void>;
23: };
24: 
25: export const DEFAULT_CHUNK_SIZE = 1024;
26: const CHUNK_PREFIX = '__chunked__:';
27: 
28: export function createChunkedStorage(
29:   store: KeyValueStore,
30:   chunkSize: number = DEFAULT_CHUNK_SIZE,
31: ): KeyValueStore {
32:   if (chunkSize <= 0) {
33:     throw new Error('chunkSize muss groesser als 0 sein');
34:   }
...
43:   const chunkKey = (key: string, index: number) => `${key}.${index}`;
44: 
45:   async function removeChunks(key: string, count: number): Promise<void> {
46:     for (let i = 0; i < count; i++) {
47:       await store.removeItem(chunkKey(key, i));
48:     }
49:   }
...
51:   return {
52:     async getItem(key) {
53:       const head = await store.getItem(key);
54:       if (head === null) return null;
55: 
56:       if (!head.startsWith(CHUNK_PREFIX)) {
57:         return head;
58:       }
59: 
60:       const count = Number.parseInt(head.slice(CHUNK_PREFIX.length), 10);
61:       if (!Number.isInteger(count) || count < 0) return null;
62: 
63:       const parts: string[] = [];
64:       for (let i = 0; i < count; i++) {
65:         const part = await store.getItem(chunkKey(key, i));
66:         if (part === null) return null;
67:         parts.push(part);
68:       }
69: 
70:       return parts.join('');
71:     },
...
76:     async setItem(key, value) {
77:       const previous = await store.getItem(key);
78:       if (previous?.startsWith(CHUNK_PREFIX)) {
79:         const previousCount = Number.parseInt(previous.slice(CHUNK_PREFIX.length), 10);
80:         if (Number.isInteger(previousCount)) {
81:           await removeChunks(key, previousCount);
82:         }
83:       }
84: 
85:       if (value.length <= chunkSize) {
86:         await store.setItem(key, value);
87:         return;
88:       }
89: 
90:       const parts: string[] = [];
91:       for (let i = 0; i < value.length; i += chunkSize) {
92:         parts.push(value.slice(i, i + chunkSize));
93:       }
94: 
95:       for (const [index, part] of parts.entries()) {
96:         await store.setItem(chunkKey(key, index), part);
97:       }
98:       await store.setItem(key, `${CHUNK_PREFIX}${parts.length}`);
99:     },
...
105:     async removeItem(key) {
106:       const head = await store.getItem(key);
107: 
108:       if (head?.startsWith(CHUNK_PREFIX)) {
109:         const count = Number.parseInt(head.slice(CHUNK_PREFIX.length), 10);
110:         if (Number.isInteger(count)) {
111:           await removeChunks(key, count);
112:         }
113:       }
114: 
115:       await store.removeItem(key);
116:     },
117:   };
118: }
```

- **Lines 19–23**: Abstract `KeyValueStore` interface decoupling storage logic from native implementation for unit testing.
- **Line 30**: `DEFAULT_CHUNK_SIZE = 1024` conservative size safely below iOS 2048-byte limit.
- **Line 33**: `CHUNK_PREFIX = '__chunked__:'` marker prefix.
- **Lines 35–41**: Validates chunk size > 0.
- **Lines 45–49**: `removeChunks()` deletes `key.0` through `key.(count-1)`.
- **Lines 52–74**: `getItem()` reads key header. If direct value, returns it. If prefixed, parses chunk count and stitches parts. Returns `null` if any chunk is missing.
- **Lines 76–103**: `setItem()` removes leftover chunks from any previous longer value, then writes chunks before setting the header key `${CHUNK_PREFIX}${count}`.
- **Lines 105–116**: `removeItem()` cleans up all chunk subkeys and primary key.

---

### 4. `src/lib/database.types.ts`

TypeScript database definitions automatically generated from the Supabase PostgreSQL schema.

- **Lines 1–8**: `Json` recursive type definition.
- **Lines 9–796**: `Database` type defining table row, insert, update schemas for `child_profiles`, `food_entries`, `fridge_items`, `household_invites`, `household_members`, `households`, `products`, `profiles`, `shopping_history`, `shopping_list_items`, `storage_locations`, `user_goals`, `weight_entries`, plus RPC functions `create_household` and `redeem_invite`.
- **Lines 798–914**: Supabase helper generic types `Tables<T>`, `TablesInsert<T>`, `TablesUpdate<T>`, `Enums<T>`, `CompositeTypes<T>`.
- **Lines 915–923**: `Constants` object export.

---

### 5. `src/lib/env.ts`

Centralized environment variable loader and validator with descriptive error messages.

```typescript
15: export class MissingEnvError extends Error {
16:   constructor(readonly variableName: string) {
17:     super(
18:       `Umgebungsvariable ${variableName} fehlt.\n\n` +
19:         'Lege eine .env (oder .env.development / .env.local) im Projekt-Root an und trage die Werte ein. ' +
20:         'Fuer die lokale Supabase-Instanz liefert `supabase status` die passenden Werte, ' +
21:         'fuer ein gehostetes Projekt das Supabase-Dashboard unter Project Settings > API.\n' +
22:         'Details stehen im README unter "Umgebungsvariablen".',
23:     );
24:     this.name = 'MissingEnvError';
25:   }
26: }
27: 
28: export function requireEnv(variableName: string, value: string | undefined | null): string {
29:   if (value === undefined || value === null || value.trim() === '') {
30:     throw new MissingEnvError(variableName);
31:   }
32:   return value.trim();
33: }
34: 
35: export const env = {
36:   get supabaseUrl(): string {
37:     return requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
38:   },
39:   get supabaseKey(): string {
40:     return requireEnv('EXPO_PUBLIC_SUPABASE_KEY', process.env.EXPO_PUBLIC_SUPABASE_KEY);
41:   },
42:   get forceOnboarding(): boolean {
43:     const val = process.env.EXPO_PUBLIC_FORCE_ONBOARDING?.trim().toLowerCase();
44:     return val === 'true' || val === '1';
45:   },
46: };
```

- **Lines 15–26**: Custom `MissingEnvError` class providing setup guidance if missing env variables are encountered.
- **Lines 32–37**: `requireEnv()` pure function validating non-empty string.
- **Lines 39–50**: `env` object exposing lazy getters for `supabaseUrl`, `supabaseKey`, and `forceOnboarding`.

---

### 6. `src/lib/notifications.ts`

Local push notification management and settings storage with defensive wrappers for Expo Go / web compatibility.

```typescript
3: const NOTIF_SETTINGS_KEY = 'fam_notification_settings_v1';
4: 
5: export type NotificationSettings = {
6:   enabled: boolean;
7:   daysThreshold: number;
8:   reminderHour: number;
9:   reminderMinute: number;
10: };
...
21: let AsyncStorageModule: any = null;
22: try {
23:   AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
24: } catch {
25:   AsyncStorageModule = null;
26: }
27: 
28: let NotificationsModule: any = null;
29: try {
30:   NotificationsModule = require('expo-notifications');
31:   if (NotificationsModule?.setNotificationHandler) {
32:     NotificationsModule.setNotificationHandler({
33:       handleNotification: async () => ({
34:         shouldShowBanner: true,
35:         shouldPlaySound: true,
36:         shouldSetBadge: true,
37:         shouldShowList: true,
38:       }),
39:     });
40:   }
41: } catch {
42:   NotificationsModule = null;
43: }
```

- **Lines 21–26**: Defensive require of `@react-native-async-storage/async-storage`.
- **Lines 28–46**: Defensive require of `expo-notifications` configuring banner, sound, badge, and list notification behaviors.
- **Lines 50–71**: Fallback storage implementation using in-memory `Map` if native storage is unavailable.
- **Lines 76–95**: `getNotificationSettings()` & `saveNotificationSettings()`.
- **Lines 100–122**: `requestNotificationPermissions()` requests notification permissions on native platforms.
- **Lines 127–158**: `scheduleExpiryNotificationReminder()` schedules daily local push notifications for expiring inventory items.
- **Lines 168–209**: `sendTestNotification()` sends an immediate test notification for live debugging.

---

### 7. `src/lib/open-food-facts.ts`

Client integration with Open Food Facts API for barcode lookup and term search.

```typescript
18: export function parseQuantityAndUnit(rawQuantity?: string): { quantity: number; unit: string } {
19:   if (!rawQuantity) return { quantity: 1, unit: 'piece' };
20: 
21:   const match = rawQuantity.trim().match(/^([\d.,]+)\s*([a-zA-ZäöüÄÖÜµ]+)/);
22:   if (!match) return { quantity: 1, unit: 'piece' };
23: 
24:   const num = parseFloat(match[1].replace(',', '.'));
25:   const rawUnit = match[2].toLowerCase();
26: 
27:   let unit = 'piece';
28:   if (['g', 'gramm', 'gram'].includes(rawUnit)) unit = 'g';
29:   else if (['kg', 'kilogramm'].includes(rawUnit)) unit = 'kg';
30:   else if (['l', 'liter'].includes(rawUnit)) unit = 'l';
31:   else if (['ml', 'milliliter'].includes(rawUnit)) unit = 'ml';
32:   else if (['stk', 'stück', 'stk.', 'pcs', 'piece'].includes(rawUnit)) unit = 'piece';
33:   else if (['pkg', 'packung', 'pck', 'pack'].includes(rawUnit)) unit = 'pack';
34: 
35:   return { quantity: Number.isNaN(num) ? 1 : num, unit };
36: }
...
42: export function formatOFFProduct(raw: any): OpenFoodFactsProduct | null {
43:   if (!raw) return null;
...
53:   return {
54:     barcode: raw.code || raw._id || '',
55:     name: name.trim(),
56:     brand: raw.brands ? raw.brands.split(',')[0].trim() : undefined,
57:     category: raw.categories ? raw.categories.split(',')[0].trim() : undefined,
58:     quantity,
59:     unit,
60:     imageUrl: raw.image_front_small_url || raw.image_front_url || undefined,
61:     caloriesPer100g: nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal_value'],
62:     proteinsPer100g: nutriments.proteins_100g ?? nutriments.proteins_value,
63:     carbsPer100g: nutriments.carbohydrates_100g ?? nutriments.carbohydrates_value,
64:     fatPer100g: nutriments.fat_100g ?? nutriments.fat_value,
65:   };
66: }
```

- **Lines 18–36**: `parseQuantityAndUnit()` parses raw text like `"500 g"` or `"1.5 L"` into structured numeric quantities and normalized unit strings.
- **Lines 42–66**: `formatOFFProduct()` converts raw Open Food Facts JSON payloads into normalized `OpenFoodFactsProduct` schema objects.
- **Lines 71–98**: `searchOpenFoodFacts()` queries search terms via Open Food Facts REST API.
- **Lines 103–125**: `fetchProductByBarcode()` fetches product data by EAN barcode string.

---

### 8. `src/lib/pending-invite.ts`

Manages household invitation tokens stored across app lifecycle events.

```typescript
5: export async function savePendingInviteToken(token: string): Promise<void> {
6:   try {
7:     if (token) {
8:       await AsyncStorage.setItem(PENDING_INVITE_KEY, token.trim());
9:     }
10:   } catch (err) {
11:     console.error('Fehler beim Speichern des Einladungs-Tokens:', err);
12:   }
13: }
14: 
15: export async function consumePendingInviteToken(): Promise<string | null> {
16:   try {
17:     const token = await AsyncStorage.getItem(PENDING_INVITE_KEY);
18:     if (token) {
19:       await AsyncStorage.removeItem(PENDING_INVITE_KEY);
20:       return token;
21:     }
22:     return null;
23:   } catch (err) {
24:     console.error('Fehler beim Lesen des Einladungs-Tokens:', err);
25:     return null;
26:   }
27: }
28: 
29: export async function peekPendingInviteToken(): Promise<string | null> {
30:   try {
31:     return await AsyncStorage.getItem(PENDING_INVITE_KEY);
32:   } catch {
33:     return null;
34:   }
35: }
36: 
37: export async function clearPendingInviteToken(): Promise<void> {
38:   try {
39:     await AsyncStorage.removeItem(PENDING_INVITE_KEY);
40:   } catch (err) {
41:     console.error('Fehler beim Löschen des Einladungs-Tokens:', err);
42:   }
43: }
```

- **Lines 5–13**: `savePendingInviteToken()` stores token in `AsyncStorage`.
- **Lines 15–27**: `consumePendingInviteToken()` retrieves and deletes token atomically.
- **Lines 29–35**: `peekPendingInviteToken()` inspects token without deleting it.
- **Lines 45–51**: `clearPendingInviteToken()` explicitly removes pending token after successful household join.

---

### 9. `src/lib/query-client.ts`

Configures `@tanstack/react-query` for React Native with AppState focus tracking and Expo Network state synchronization.

```typescript
21: export const queryClient = new QueryClient({
22:   defaultOptions: {
23:     queries: {
24:       staleTime: 30_000,
25:       retry: 2,
26:       refetchOnWindowFocus: Platform.OS === 'web',
27:     },
28:     mutations: {
29:       retry: 0,
30:     },
31:   },
32: });
33: 
34: export function startQueryEnvironmentSync(): () => void {
35:   if (Platform.OS === 'web') return () => {};
36: 
37:   const appStateSubscription = AppState.addEventListener('change', (status: AppStateStatus) => {
38:     focusManager.setFocused(status === 'active');
39:   });
40: 
41:   onlineManager.setEventListener((setOnline) => {
42:     const subscription = Network.addNetworkStateListener((state) => {
43:       setOnline(state.isInternetReachable ?? state.isConnected ?? true);
44:     });
45: 
46:     return () => subscription.remove();
47:   });
48: 
49:   return () => {
50:     appStateSubscription.remove();
51:   };
52: }
```

- **Lines 21–36**: Initializes `queryClient` (`staleTime: 30s`, `retry: 2` for queries).
- **Lines 43–68**: `startQueryEnvironmentSync()` binds React Native `AppState` to `focusManager` and `Network` status to `onlineManager` using `isInternetReachable ?? isConnected ?? true`.

---

### 10. `src/lib/supabase.ts`

Initializes typed Supabase client with chunked secure store integration and auto-refresh handlers.

```typescript
58: function loadSecureStore() {
59:   try {
60:     return require('expo-secure-store') as typeof import('expo-secure-store');
61:   } catch {
62:     throw new Error(REBUILD_HINT);
63:   }
64: }
65: 
66: const secureStoreAdapter: KeyValueStore = {
67:   getItem: (key) => loadSecureStore().getItemAsync(key),
68:   setItem: (key, value) => loadSecureStore().setItemAsync(key, value),
69:   removeItem: (key) => loadSecureStore().deleteItemAsync(key),
70: };
...
80: export function getSupabase(): TypedSupabaseClient {
81:   if (client) return client;
82: 
83:   client = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
84:     auth: {
85:       storage: Platform.OS === 'web' ? undefined : createChunkedStorage(secureStoreAdapter),
86:       autoRefreshToken: true,
87:       persistSession: true,
88:       detectSessionInUrl: false,
89:     },
90:   });
91: 
92:   return client;
93: }
...
103: export function startSupabaseAutoRefresh(): () => void {
104:   if (Platform.OS === 'web') return () => {};
...
114:   const subscription = AppState.addEventListener('change', (state) => {
115:     if (state === 'active') {
116:       supabase.auth.startAutoRefresh();
117:     } else {
118:       supabase.auth.stopAutoRefresh();
119:     }
120:   });
121: 
122:   return () => subscription.remove();
123: }
```

- **Lines 58–64**: Lazy loader `loadSecureStore()` prevents module import crashes when native builds lack `expo-secure-store`.
- **Lines 66–70**: `secureStoreAdapter` adapts Expo SecureStore to `KeyValueStore`.
- **Lines 80–94**: `getSupabase()` creates client instance configured with `chunkedStorage` and `detectSessionInUrl: false`.
- **Lines 103–123**: `startSupabaseAutoRefresh()` manages token refresh timers based on `AppState` transitions.

---

### 11. `src/lib/units.ts`

Standardizes measurement unit strings.

```typescript
1: export function normalizeUnit(rawUnit: string | undefined | null): string {
2:   if (!rawUnit) return 'piece';
3:   const u = rawUnit.toLowerCase().trim();
4:   if (u === 'l' || u === 'liter' || u === 'litre') return 'l';
5:   if (u === 'g' || u === 'gramm' || u === 'gram') return 'g';
6:   if (u === 'kg' || u === 'kilogramm' || u === 'kilo') return 'kg';
7:   if (u === 'ml' || u === 'milliliter') return 'ml';
8:   if (u === 'piece' || u === 'stk' || u === 'stk.' || u === 'stück' || u === 'stueck')
9:     return 'piece';
10:   if (u === 'package' || u === 'packung' || u === 'pkg') return 'package';
11:   if (u === 'portion' || u === 'pck') return 'portion';
12:   if (['g', 'kg', 'ml', 'l', 'piece', 'package', 'portion'].includes(u)) return u;
13:   return 'piece';
14: }
```

- Maps inputs (`'liter'`, `'gramm'`, `'stk'`) to canonical values (`'l'`, `'g'`, `'kg'`, `'ml'`, `'piece'`, `'package'`, `'portion'`).

---

## Database Layer (`src/lib/db/`)

### 12. `src/lib/db/client.ts`

Exclusive wrapper around `expo-sqlite`. Not re-exported in `db/index.ts` to prevent native module loading during unit tests.

```typescript
30: function loadSQLite(): typeof import('expo-sqlite') {
31:   try {
32:     return require('expo-sqlite') as typeof import('expo-sqlite');
33:   } catch {
34:     throw new Error(REBUILD_HINT);
35:   }
36: }
...
52: function toPort(db: import('expo-sqlite').SQLiteDatabase): SqlDatabase {
53:   return {
54:     execAsync: (source) => db.execAsync(source),
55:     runAsync: (source, params) => db.runAsync(source, [...(params ?? [])]),
56:     getAllAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
57:       db.getAllAsync<T>(source, [...(params ?? [])]),
58:     getFirstAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
59:       db.getFirstAsync<T>(source, [...(params ?? [])]),
60:     withExclusiveTransactionAsync: (task) =>
61:       db.withExclusiveTransactionAsync((txn) => task(toPort(txn))),
62:   };
63: }
...
69: async function open(): Promise<SqlDatabase> {
70:   const SQLite = loadSQLite();
71:   rawDatabase = await SQLite.openDatabaseAsync(DATABASE_NAME);
72:   const db = toPort(rawDatabase);
73: 
74:   await db.execAsync('PRAGMA journal_mode = WAL');
75:   await runMigrations(db, MIGRATIONS);
76:   return db;
77: }
...
90: export function getDatabase(): Promise<SqlDatabase> {
91:   if (database) return Promise.resolve(database);
92: 
93:   if (!opening) {
94:     opening = open()
95:       .then((db) => {
96:         database = db;
97:         return db;
98:       })
99:       .finally(() => {
100:         opening = null;
101:       });
102:   }
103: 
104:   return opening;
105: }
...
114: export async function deleteLocalDatabase(): Promise<void> {
115:   const SQLite = loadSQLite();
...
129:   try {
130:     await SQLite.deleteDatabaseAsync(DATABASE_NAME);
131:   } catch (e) {
132:     console.warn('[db] Fehler beim Löschen der Datenbank:', e);
133:   }
134: }
...
144: export async function ensureDatabaseBelongsTo(userId: string): Promise<SqlDatabase> {
145:   let db = await getDatabase();
146: 
147:   const row = await db.getFirstAsync<{ value: string }>(
148:     'select value from app_meta where key = ?',
149:     ['user_id'],
150:   );
151: 
152:   if (row?.value === userId) return db;
153: 
154:   if (row?.value !== undefined && row.value !== userId) {
155:     await deleteLocalDatabase();
156:     db = await getDatabase();
157:   }
158: 
159:   await db.runAsync('insert or replace into app_meta (key, value) values (?, ?)', [
160:     'user_id',
161:     userId,
162:   ]);
163: 
164:   return db;
165: }
```

- **Lines 30–36**: Lazy dynamic require of `expo-sqlite`.
- **Lines 52–63**: `toPort()` translates `SQLiteDatabase` to abstract `SqlDatabase` port.
- **Lines 69–81**: `open()` configures WAL mode (`PRAGMA journal_mode = WAL`) and runs schema migrations.
- **Lines 90–105**: `getDatabase()` uses an `opening` promise lock preventing concurrent migration execution (`database is locked`).
- **Lines 114–134**: `deleteLocalDatabase()` closes connection and deletes SQLite database on logout.
- **Lines 144–165**: `ensureDatabaseBelongsTo()` wipes and resets local DB when user switches accounts.

---

### 13. `src/lib/db/entities.ts`

Static metadata registry defining table schema parameters for offline sync entities.

```typescript
11: export type EntityMeta = {
12:   entity: Entity;
13:   table: Entity;
14:   hasServerTombstone: boolean;
15:   householdScoped: boolean;
16:   columns: readonly string[];
17: };
18: 
19: export const ENTITIES: Readonly<Record<Entity, EntityMeta>> = {
20:   storage_locations: {
21:     entity: 'storage_locations',
22:     table: 'storage_locations',
23:     hasServerTombstone: true,
24:     householdScoped: true,
25:     columns: ['id', 'household_id', 'name', 'kind', 'sort_order', 'created_at'],
26:   },
27:   fridge_items: { ... },
28:   shopping_list_items: { ... },
29:   products: { ... },
30: };
```

- Defines entity flags (`hasServerTombstone`, `householdScoped`) and column lists for `storage_locations`, `fridge_items`, `shopping_list_items`, and `products`.

---

### 14. `src/lib/db/index.ts`

Public API barrel for database layer. Excludes `client.ts` by design to allow unit tests to run under Node environment without native dependencies.

---

### 15. `src/lib/db/migrations.ts`

SQL migration scripts defining SQLite mirror tables, indexes, outbox queue, sync state, and shopping history tables.

- **`V1_MIRRORS`**: Defines local tables (`storage_locations`, `fridge_items`, `shopping_list_items`, `products`) with epoch ms timestamps (`updated_at`, `deleted_at`) and local `_dirty` status flags.
- **`V1_OUTBOX`**: Creates `outbox` table with `AUTOINCREMENT` primary key and backoff tracking columns (`next_attempt_at`, `attempts`, `last_error`).
- **`V1_STATE`**: Defines `sync_state` cursor storage and `app_meta` key-value pairs.
- **`V2_SHOPPING_HISTORY`**: Defines local mirror table for `shopping_history`.

---

### 16. `src/lib/db/migrator.ts`

Migration execution runner managing `PRAGMA user_version`.

```typescript
20: export function assertMigrationSequence(migrations: readonly Migration[]): void { ... }
44: export function planMigrations(currentVersion: number, migrations: readonly Migration[]): readonly Migration[] { ... }
52: export async function readUserVersion(db: SqlDatabase): Promise<number> { ... }
71: export async function runMigrations(db: SqlDatabase, migrations: readonly Migration[]): Promise<number> {
...
81:     await db.withExclusiveTransactionAsync(async (txn) => {
82:       for (const statement of migration.statements) {
83:         await txn.execAsync(statement);
84:       }
85:       await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
86:     });
...
89: }
```

- Executes each pending migration inside an exclusive transaction, incrementing `PRAGMA user_version` atomically.

---

### 17. `src/lib/db/outbox-retry.ts`

Recovery utilities for failed outbox mutations.

```typescript
8: export async function retryFailedOutboxEntries(
9:   db: SqlDatabase,
10:   nowMs = Date.now(),
11: ): Promise<number> {
12:   const entries = await db.getAllAsync<{ id: number; payload: string }>(
13:     'select id, payload from outbox where payload like \'%"unit":"L"%\' or payload like \'%"unit":"LITER"%\'',
14:   );
15: 
16:   for (const entry of entries) {
17:     const fixedPayload = entry.payload
18:       .replace(/"unit":"L"/g, '"unit":"l"')
19:       .replace(/"unit":"LITER"/g, '"unit":"l"');
20:     await db.runAsync('update outbox set payload = ? where id = ?', [fixedPayload, entry.id]);
21:   }
22: 
23:   const result = await db.runAsync(
24:     "update outbox set attempts = 0, next_attempt_at = ? where attempts >= ? or last_error like '%unit%'",
25:     [nowMs, MAX_ATTEMPTS],
26:   );
27: 
28:   return result.changes;
29: }
```

- Repairs legacy uppercase unit values in JSON payloads and resets attempt counters (`attempts = 0`) to re-queue stuck mutations.

---

### 18. `src/lib/db/outbox.ts`

Atomic outbox write primitives enforcing local write + mutation queueing inside exclusive SQLite transactions.

```typescript
22: export function parseOutboxEntry(entry: OutboxEntry): Record<string, unknown> { ... }
66: export async function enqueueMutation(db: SqlDatabase, input: EnqueueMutationInput): Promise<void> {
67:   const createdAt = input.now ?? Date.now();
68:   const payloadJson = JSON.stringify(input.payload);
69: 
70:   await db.withExclusiveTransactionAsync(async (txn) => {
71:     await input.applyLocally(txn);
72: 
73:     await txn.runAsync(
74:       'insert into outbox (entity, entity_id, op, payload, created_at, attempts, next_attempt_at) values (?, ?, ?, ?, ?, 0, 0)',
75:       [input.entity, input.entityId, input.op, payloadJson, createdAt],
76:     );
77:   });
78: }
87: export async function loadDueOutboxEntries(db: SqlDatabase, nowMs: number): Promise<OutboxEntry[]> { ... }
95: export async function deleteOutboxEntries(db: SqlDatabase, ids: readonly number[]): Promise<void> { ... }
109: export async function recordOutboxOutcome(db: SqlDatabase, ids: readonly number[], outcome: OutboxOutcome): Promise<void> { ... }
```

- `enqueueMutation()` writes local mirror table (`applyLocally`) and inserts outbox record atomically in the same transaction.

---

### 19. `src/lib/db/sync-state.ts`

Cursor and error tracking for incremental pull synchronization.

```typescript
24: export async function readSyncState(db: SqlDatabase, entity: Entity, scope = DEFAULT_SCOPE) { ... }
50: export async function writeSyncCursor(txn: SqlDatabase, entity: Entity, cursor: SyncCursor, lastRunAtMs: number, scope = DEFAULT_SCOPE) { ... }
70: export async function recordSyncError(db: SqlDatabase, entity: Entity, error: string, scope = DEFAULT_SCOPE) { ... }
```

- Stores raw Postgres timestamp strings in `sync_state` table to preserve exact server clock microsecond positions.

---

### 20. `src/lib/db/types.ts`

Abstract `SqlDatabase` port definition and sync type signatures.

```typescript
38: export type SqlDatabase = {
39:   execAsync(source: string): Promise<void>;
40:   runAsync(source: string, params?: readonly SqlParam[]): Promise<SqlRunResult>;
41:   getAllAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T[]>;
42:   getFirstAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T | null>;
43:   withExclusiveTransactionAsync(task: (txn: SqlDatabase) => Promise<void>): Promise<void>;
44: };
```

- Decouples sync engine logic from native `expo-sqlite` drivers, enabling integration testing using `node:sqlite`.

---

## Sync Engine (`src/lib/sync/`)

### 21. `src/lib/sync/background-sync.ts`

Integrates Expo `TaskManager` and `BackgroundTask` for background sync processing.

---

### 22. `src/lib/sync/backoff.ts`

Exponential backoff calculation and error classification.

```typescript
11: export const MAX_ATTEMPTS = 5;
13: const DELAYS_MS = [1_000, 5_000, 15_000, 60_000, 300_000] as const;
23: export function backoffDelayMs(attempts: number): number { ... }
46: export function classifyError(status: number | null): ErrorKind {
47:   if (status === null) return 'transient';
48:   if (status === 408 || status === 429) return 'transient';
49:   if (status >= 500) return 'transient';
50:   return 'permanent';
51: }
```

- Classifies network errors (`null`, HTTP 408/429/500+) as `transient` (retryable) and client/auth errors (e.g. 401/403 RLS) as `permanent`.

---

### 23. `src/lib/sync/coalesce.ts`

Folds multiple sequential local mutations per record into a single optimized push operation.

```typescript
75: export function coalesce(entries: readonly OutboxEntry[]): CoalesceResult { ... }
```

- Coalesces operations:
  - `update + update` $\rightarrow$ merged `update`.
  - `insert + update` $\rightarrow$ merged `insert`.
  - `insert + delete` $\rightarrow$ deleted locally without network push (`discardable`).
  - `update + delete` $\rightarrow$ single `delete`.

---

### 24. `src/lib/sync/cursor.ts`

Parses PostgREST ISO `timestamptz` strings into numeric epoch milliseconds.

```typescript
31: export function toEpochMs(pgTimestamp: string): number { ... }
```

- Truncates sub-milliseconds and normalizes timezone offsets before parsing to avoid engine inconsistencies.

---

### 25. `src/lib/sync/engine.ts`

Top-level sync coordinator running Push before Pull.

```typescript
25: export async function syncHousehold(deps: {
26:   db: SqlDatabase;
27:   supabase: TypedSupabaseClient;
28:   serverClock: ServerClock;
29:   householdIds: readonly string[];
30:   now?(): number;
31: }): Promise<SyncRunResult> {
32:   const nowMs = deps.now ? deps.now() : Date.now();
33:   const push = await pushOutbox({ db: deps.db, supabase: deps.supabase, now: () => nowMs });
34:   const pull = await pullHousehold({
35:     db: deps.db,
36:     supabase: deps.supabase,
37:     householdIds: deps.householdIds,
38:     clockCeilingMs: clockCeiling(deps.serverClock, nowMs),
39:   });
40:   return { push, pull };
41: }
```

---

### 26. `src/lib/sync/mirror-write.ts`

Applies remote PostgreSQL records into local SQLite mirror tables with conflict resolution checks.

```typescript
37: export async function upsertMirrorRow(txn: SqlDatabase, entity: Entity, remoteRow: Record<string, unknown>, options: UpsertMirrorRowOptions): Promise<void> { ... }
91: export async function applyRemoteRow(txn: SqlDatabase, entity: Entity, remoteRow: RemoteRow, clockCeilingMs: number): Promise<'written' | 'local-wins'> { ... }
136: export async function deleteMirrorRow(txn: SqlDatabase, entity: Entity, id: string): Promise<void> { ... }
```

- If local record is marked `_dirty = 1`, runs `resolve()` algorithm. If non-dirty, upserts directly.

---

### 27. `src/lib/sync/network-trigger.ts`

Listens for network reconnection events using `expo-network`.

---

### 28. `src/lib/sync/pull.ts`

Incremental keyset pagination pull engine querying `(updated_at, id)`.

```typescript
55: async function pullEntity(...) { ... }
129: async function reconcileOrphans(...) { ... }
173: export async function pullHousehold(...) { ... }
```

- Fetches records in pages of 500. Reconciles local orphans deleted on server.

---

### 29. `src/lib/sync/push.ts`

Processes outbox queue mutations against Supabase REST endpoints.

```typescript
119: async function applyOnePush(...) { ... }
296: export async function pushOutbox(...) { ... }
```

- Handles FK constraint errors (23503), duplicate primary keys (23505), RLS filtering, and updates backoff status.

---

### 30. `src/lib/sync/realtime.ts`

Supabase WebSocket Realtime bridge subscribing to `fridge_items` and `shopping_list_items` changes.

```typescript
89: export function subscribeHouseholdRealtime(deps: SubscribeHouseholdRealtimeDeps): () => void { ... }
```

---

### 31. `src/lib/sync/reconnect.ts`

Pure function detecting online transition (`previous === false && current === true`).

---

### 32. `src/lib/sync/resolve.ts`

Last-Write-Wins conflict resolution algorithm with tombstone priority.

```typescript
67: export function resolve(local: SyncSide, remote: SyncSide, options: ResolveOptions): Resolution {
68:   const localDeleted = local.deletedAt !== null;
69:   const remoteDeleted = remote.deletedAt !== null;
70: 
71:   if (localDeleted !== remoteDeleted) {
72:     return localDeleted ? 'local' : 'remote';
73:   }
74: 
75:   const effectiveLocal = Math.min(local.updatedAt, options.clockCeiling);
76: 
77:   if (effectiveLocal > remote.updatedAt) return 'local';
78:   if (effectiveLocal < remote.updatedAt) return 'remote';
79: 
80:   return remote.id >= local.id ? 'remote' : 'local';
81: }
```

- Rules:
  1. Tombstones (deleted records) beat updates.
  2. Local timestamps capped at `clockCeiling` (prevents future device clock deadlocks).
  3. Last-Write-Wins by timestamp.
  4. Deterministic string tiebreaker by record ID.

---

### 33. `src/lib/sync/server-clock.ts`

Estimates server time from HTTP `Date` response headers to cap local timestamps in conflict resolution.

---

### 34. `src/lib/sync/sync-runner.ts`

App-level sync triggers and `useSyncEngine()` React hook managing periodic (20s) and AppState active sync cycles.

---

### 35. `src/lib/sync/sync-status.ts`

Pure compute function determining UI state for the sync indicator (`failed`, `offline`, `syncing`, `hidden`).

---
