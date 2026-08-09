# Hooks Directory Documentation (`src/hooks`)

This directory contains React custom hooks used across the application for managing theme/color schemes, web-hydration color scheme fallbacks, and offline/online data synchronization status monitoring.

---

## Table of Contents
1. [`use-color-scheme.ts`](#1-use-color-schemets)
2. [`use-color-scheme.web.ts`](#2-use-color-schemewebts)
3. [`use-sync-status.ts`](#3-use-sync-statusts)
4. [`use-theme.ts`](#4-use-themets)

---

## 1. `use-color-scheme.ts`
**Path:** `src/hooks/use-color-scheme.ts`

### Overview
This file serves as the native entry point (iOS / Android) for the `useColorScheme` hook. Expo / React Native bundling uses platform extensions (`.web.ts` vs `.ts`) to pick web or native files at build time.

### Code Walkthrough & Line-by-Line Explanation

```typescript
1: export { useColorScheme } from 'react-native';
```

#### Line 1
- **Code:** `export { useColorScheme } from 'react-native';`
- **Explanation:** Directly re-exports `useColorScheme` from the `react-native` package. On native platforms (iOS and Android), React Native manages event listeners for native system appearance changes (light vs. dark mode toggle in system settings). No hydration workaround is required for native platforms.

---

## 2. `use-color-scheme.web.ts`
**Path:** `src/hooks/use-color-scheme.web.ts`

### Overview
This file provides a web-specific implementation of `useColorScheme`. On the web (particularly with Server-Side Rendering / Static Site Generation), reading system appearance before hydration can cause SSR mismatch warnings if the server default does not match the browser theme. This hook ensures `'light'` is returned during initial SSR / pre-hydration render and re-evaluates the system color scheme once client hydration is complete.

### Code Walkthrough & Line-by-Line Explanation

```typescript
1: import { useEffect, useState } from 'react';
2: import { useColorScheme as useRNColorScheme } from 'react-native';
3: 
4: /**
5:  * To support static rendering, this value needs to be re-calculated on the client side for web
6:  */
7: export function useColorScheme() {
8:   const [hasHydrated, setHasHydrated] = useState(false);
9: 
10:   useEffect(() => {
11:     setHasHydrated(true);
12:   }, []);
13: 
14:   const colorScheme = useRNColorScheme();
15: 
16:   if (hasHydrated) {
17:     return colorScheme;
18:   }
19: 
20:   return 'light';
21: }
```

#### Lines 1–2: Import Statements
- **Line 1 (`import { useEffect, useState } from 'react';`):** Imports standard React state and effect hooks to track client-side hydration status.
- **Line 2 (`import { useColorScheme as useRNColorScheme } from 'react-native';`):** Imports `useColorScheme` from React Native, aliasing it as `useRNColorScheme` to prevent naming collision with the exported function.

#### Lines 4–6: JSDoc Documentation
- **Lines 4–6:** Technical doc comment explaining why this file exists (re-calculating color scheme on client side after web hydration to support static rendering).

#### Lines 7–12: Function Declaration & Hydration State
- **Line 7 (`export function useColorScheme() {`):** Declares and exports the web custom hook `useColorScheme`.
- **Line 8 (`const [hasHydrated, setHasHydrated] = useState(false);`):** Initializes local state `hasHydrated` to `false`.
- **Lines 10–12 (`useEffect(() => { setHasHydrated(true); }, []);`):** Runs an effect after initial client DOM mount, setting `hasHydrated` to `true`.

#### Line 14: Fetching Color Scheme
- **Line 14 (`const colorScheme = useRNColorScheme();`):** Calls React Native's color scheme hook to query the browser / system scheme preference.

#### Lines 16–21: Hydration Check & Return
- **Lines 16–18 (`if (hasHydrated) { return colorScheme; }`):** If the client has completed hydration, returns the true browser/system color scheme.
- **Line 20 (`return 'light';`):** Returns static `'light'` fallback during server rendering or before client hydration finishes.
- **Line 21 (`}`):** Closes function scope.

---

## 3. `use-sync-status.ts`
**Path:** `src/hooks/use-sync-status.ts`

### Overview
This hook (`useSyncStatus`) monitors network connection status and local SQLite outbox queue state to compute a unified `SyncStatusView` object (indicating whether the device is online/offline and the counts of pending/failed background synchronization items).

### Code Walkthrough & Line-by-Line Explanation

```typescript
1: import { onlineManager, useQuery } from '@tanstack/react-query';
2: import { useSyncExternalStore } from 'react';
3: 
4: import { getDatabase } from '@/lib/db/client';
5: import type { SqlDatabase } from '@/lib/db/types';
6: import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
7: import { computeSyncStatusView, type SyncStatusView } from '@/lib/sync/sync-status';
8: 
9: /**
10:  * Liest Netzwerkstatus und Outbox-Zaehler und leitet daraus den Anzeigezustand
11:  * fuer #51 ab.
12:  *
13:  * Netzwerkstatus kommt aus TanStacks bereits gemountetem `onlineManager`
14:  * (gespeist von echten `expo-network`-Events ueber `startQueryEnvironmentSync`
15:  * in `src/app/_layout.tsx`) statt einem zweiten, unabhaengigen Listener — #50s
16:  * Anforderung, `expo-network` direkt zu verwenden, betrifft den
17:  * Reconnect-*Trigger*, nicht diese *Anzeige*; beide speisen sich letztlich aus
18:  * denselben Events.
19:  *
20:  * Outbox-Zaehler werden gepollt statt ueber einen Event-Emitter aus
21:  * `outbox.ts`/`push.ts` beobachtet — haelt dieses Feature vollstaendig additiv
22:  * (keine bereits gemergte Sync-Engine-Datei wird angefasst). Die dadurch
23:  * moegliche Verzoegerung von bis zu drei Sekunden faellt praktisch nicht auf,
24:  * da ohnehin nichts haeufiger als das synchronisiert.
25:  */
26: export function useSyncStatus(getDb: () => Promise<SqlDatabase> = getDatabase): SyncStatusView {
27:   const isOnline = useSyncExternalStore(
28:     (onChange) => onlineManager.subscribe(onChange),
29:     () => onlineManager.isOnline(),
30:     () => true,
31:   );
32: 
33:   const { data } = useQuery({
34:     queryKey: ['sync-status', 'outbox-counts'],
35:     queryFn: async () => {
36:       const db = await getDb();
37: 
38:       const pending = await db.getFirstAsync<{ count: number }>(
39:         'select count(*) as count from outbox where attempts < ?',
40:         [MAX_ATTEMPTS],
41:       );
42:       const failed = await db.getFirstAsync<{ count: number }>(
43:         'select count(*) as count from outbox where attempts >= ?',
44:         [MAX_ATTEMPTS],
45:       );
46: 
47:       return { pending: pending?.count ?? 0, failed: failed?.count ?? 0 };
48:     },
49:     refetchInterval: 3_000,
50:     // Kein `_dirty`/`household_id`-Filter: die Outbox ist geraetelokal, nicht
51:     // haushaltsgebunden — der Zaehler braucht keinen "aktiver Haushalt"-Context.
52:     initialData: { pending: 0, failed: 0 },
53:   });
54: 
55:   return computeSyncStatusView({
56:     isOnline,
57:     pendingCount: data.pending,
58:     failedCount: data.failed,
59:   });
60: }
```

#### Lines 1–7: Module Imports
- **Line 1 (`import { onlineManager, useQuery } from '@tanstack/react-query';`):** Imports TanStack Query's global network manager and data querying hook.
- **Line 2 (`import { useSyncExternalStore } from 'react';`):** Imports React hook to subscribe to external stores safely without hydration issues or tearing.
- **Line 4 (`import { getDatabase } from '@/lib/db/client';`):** Imports function to access the local SQLite database client.
- **Line 5 (`import type { SqlDatabase } from '@/lib/db/types';`):** Imports database type definitions.
- **Line 6 (`import { MAX_ATTEMPTS } from '@/lib/sync/backoff';`):** Imports maximum retry threshold constant used to classify failed vs. pending sync attempts.
- **Line 7 (`import { computeSyncStatusView, type SyncStatusView } from '@/lib/sync/sync-status';`):** Imports helper calculation function and return type for sync status rendering.

#### Lines 9–25: Architecture Overview Comment
- **Lines 9–25:** Explains the design decisions:
  - Subscribes to existing `onlineManager` events configured in `_layout.tsx`.
  - Polls SQLite database counts every 3 seconds rather than adding event emitters to sync engine files, keeping implementation strictly additive.

#### Line 26: Function Signature & Dependency Injection
- **Line 26 (`export function useSyncStatus(getDb: () => Promise<SqlDatabase> = getDatabase): SyncStatusView {`):** Declares hook signature with optional `getDb` parameter for dependency injection testing.

#### Lines 27–31: Online Store Subscription
- **Lines 27–31:** Subscribes reactively to `onlineManager` connection updates using `useSyncExternalStore`:
  - `onlineManager.subscribe`: Subscribes listener callback.
  - `onlineManager.isOnline()`: Obtains client snapshot boolean.
  - `() => true`: SSR fallback snapshot assuming online connection.

#### Lines 33–53: Querying Outbox Mutation Counts
- **Line 33 (`const { data } = useQuery({`):** Initiates periodic query.
- **Line 34 (`queryKey: ['sync-status', 'outbox-counts'],`):** Query cache key tuple.
- **Lines 35–48 (`queryFn: async () => { ... }`):**
  - **Line 36:** Fetches DB instance via `await getDb()`.
  - **Lines 38–41:** Queries count of outbox records with `attempts < MAX_ATTEMPTS` (pending items).
  - **Lines 42–45:** Queries count of outbox records with `attempts >= MAX_ATTEMPTS` (failed items).
  - **Line 47:** Returns counts `{ pending, failed }`, defaulting missing values to `0`.
- **Line 49 (`refetchInterval: 3_000,`):** Refreshes outbox stats every 3000 ms (3 seconds).
- **Lines 50–51:** Notes outbox records are device-local (no household filtering required).
- **Line 52 (`initialData: { pending: 0, failed: 0 },`):** Provides initial fallback object before first DB resolution.

#### Lines 55–60: View Calculation & Export Return
- **Lines 55–59:** Passes collected status variables (`isOnline`, `pendingCount`, `failedCount`) to `computeSyncStatusView` to yield final UI status model.
- **Line 60 (`}`):** Closes function scope.

---

## 4. `use-theme.ts`
**Path:** `src/hooks/use-theme.ts`

### Overview
`use-theme.ts` provides the `useTheme` hook, which retrieves the resolved color scheme from `useColorScheme` and returns the matching theme color dictionary defined in `@/constants/theme`.

### Code Walkthrough & Line-by-Line Explanation

```typescript
1: /**
2:  * Learn more about light and dark modes:
3:  * https://docs.expo.dev/guides/color-schemes/
4:  */
5: 
6: import { Colors } from '@/constants/theme';
7: import { useColorScheme } from '@/hooks/use-color-scheme';
8: 
9: export function useTheme() {
10:   const scheme = useColorScheme();
11:   const theme = scheme === 'unspecified' ? 'light' : scheme;
12: 
13:   return Colors[theme];
14: }
```

#### Lines 1–4: Documentation Link
- **Lines 1–4:** JSDoc linking to Expo color scheme documentation.

#### Lines 6–7: Import Statements
- **Line 6 (`import { Colors } from '@/constants/theme';`):** Imports color theme mapping object containing color values for light/dark themes.
- **Line 7 (`import { useColorScheme } from '@/hooks/use-color-scheme';`):** Imports platform-resolved `useColorScheme` hook.

#### Lines 9–14: Theme Resolution & Return
- **Line 9 (`export function useTheme() {`):** Declares and exports custom `useTheme` hook.
- **Line 10 (`const scheme = useColorScheme();`):** Obtains current system/web color scheme string.
- **Line 11 (`const theme = scheme === 'unspecified' ? 'light' : scheme;`):** Normalizes scheme: if `'unspecified'`, defaults to `'light'`, otherwise uses `'light'` or `'dark'`.
- **Line 13 (`return Colors[theme];`):** Returns corresponding theme color palette object from `Colors`.
- **Line 14 (`}`):** Closes function scope.
