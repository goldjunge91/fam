# Feature Documentation: Household (`src/features/household`)

This document provides a comprehensive line-by-line and section-by-section technical breakdown of all non-test source files within the `src/features/household` module.

---

## Table of Contents

1. [`active-household-provider.tsx`](#1-active-household-provider-tsx)
2. [`active-household-store.ts`](#2-active-household-store-ts)
3. [`api.ts`](#3-api-ts)
4. [`child-profiles-screen.tsx`](#4-child-profiles-screen-tsx)
5. [`create-household-screen.tsx`](#5-create-household-screen-tsx)
6. [`household-switcher-modal.tsx`](#6-household-switcher-modal-tsx)
7. [`invite-modal.tsx`](#7-invite-modal-tsx)
8. [`join-household-screen.tsx`](#8-join-household-screen-tsx)
9. [`members-screen.tsx`](#9-members-screen-tsx)

---

## 1. `active-household-provider.tsx`

**File Location:** [`src/features/household/active-household-provider.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/active-household-provider.tsx)

Provides the global React Context context and hook (`useActiveHousehold`) for accessing and persisting the currently selected household across the application.

### Detailed Code Breakdown

```tsx
1: import type React from 'react';
2: import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
3: 
4: import { useHouseholds } from '@/features/household/api';
5: import type { Database } from '@/lib/database.types';
6: import { getStoredActiveHouseholdId, setStoredActiveHouseholdId } from './active-household-store';
```
- **Lines 1–2:** Imports React types and React core hooks (`createContext`, `useCallback`, `useContext`, `useEffect`, `useMemo`, `useState`) required for context setup and state management.
- **Line 4:** Imports `useHouseholds` TanStack Query hook from the household feature API to retrieve all available households for the authenticated user.
- **Line 5:** Imports generated Supabase Database types to type household entity objects accurately.
- **Line 6:** Imports async storage helper utilities (`getStoredActiveHouseholdId`, `setStoredActiveHouseholdId`) to persist the selected household ID on device storage.

```tsx
8: type Household = Database['public']['Tables']['households']['Row'];
9: 
10: interface ActiveHouseholdContextType {
11:   activeHouseholdId: string | null;
12:   activeHousehold: Household | null;
13:   households: Household[];
14:   isLoading: boolean;
15:   setActiveHouseholdId: (id: string) => Promise<void>;
16: }
17: 
18: const ActiveHouseholdContext = createContext<ActiveHouseholdContextType | undefined>(undefined);
```
- **Line 8:** Alias `Household` representing the database row schema for households (`Database['public']['Tables']['households']['Row']`).
- **Lines 10–16:** `ActiveHouseholdContextType` defines the structure of data and methods provided by this context provider:
  - `activeHouseholdId`: ID of the currently selected household or `null`.
  - `activeHousehold`: The full `Household` record corresponding to `activeHouseholdId` or `null`.
  - `households`: Array of all households accessible by the user.
  - `isLoading`: Boolean flag indicating if household data or persisted storage selection is still loading.
  - `setActiveHouseholdId`: Async function to switch the active household.
- **Line 18:** Creates `ActiveHouseholdContext` initialized with `undefined` to allow missing-provider error detection in `useActiveHousehold`.

```tsx
20: export function ActiveHouseholdProvider({ children }: { children: React.ReactNode }) {
21:   const { data: households = [], isLoading, isFetching } = useHouseholds();
22:   const [selectedId, setSelectedId] = useState<string | null>(null);
23:   const [isStoreLoaded, setIsStoreLoaded] = useState(false);
```
- **Line 20:** Component definition for `ActiveHouseholdProvider` accepting child components.
- **Line 21:** Calls `useHouseholds()` to query user's households, defaulting to empty array `[]` if undefined.
- **Line 22:** Local state `selectedId` tracks the user-selected household ID.
- **Line 23:** Local state `isStoreLoaded` tracks whether initial storage read from `AsyncStorage` has completed.

```tsx
25:   useEffect(() => {
26:     getStoredActiveHouseholdId().then((storedId) => {
27:       if (storedId) {
28:         setSelectedId(storedId);
29:       }
30:       setIsStoreLoaded(true);
31:     });
32:   }, []);
```
- **Lines 25–32:** Runs once on mount (`[]`). Calls `getStoredActiveHouseholdId()` to restore previously saved household ID from local device storage, then marks `isStoreLoaded` as `true`.

```tsx
34:   // Wähle den aktiven Haushalt aus der geladenen Liste (mit Fallback auf den ersten)
35:   const activeHousehold = useMemo(() => {
36:     if (!households || households.length === 0) return null;
37:     if (selectedId) {
38:       const found = households.find((h) => h.id === selectedId);
39:       if (found) return found;
40:     }
41:     return households[0] ?? null;
42:   }, [households, selectedId]);
43: 
44:   const activeHouseholdId = activeHousehold?.id ?? null;
```
- **Lines 35–42:** Computes `activeHousehold`:
  - If `households` is empty, returns `null`.
  - If `selectedId` is set and exists in `households`, returns that household.
  - Fallback logic: Returns `households[0]` if no matching stored ID is found.
- **Line 44:** Extracts `activeHouseholdId` from `activeHousehold`.

```tsx
46:   // Wenn Fallback eingetreten ist oder die Speicherung nicht mit dem aktiven Haushalt übereinstimmt, aktualisieren
47:   useEffect(() => {
48:     if (isStoreLoaded && activeHouseholdId && activeHouseholdId !== selectedId) {
49:       setSelectedId(activeHouseholdId);
50:       setStoredActiveHouseholdId(activeHouseholdId);
51:     }
52:   }, [isStoreLoaded, activeHouseholdId, selectedId]);
```
- **Lines 47–52:** Automatically syncs fallback household selection back into React state and persistent storage when stored ID is invalid or outdated.

```tsx
54:   const handleSetActiveHouseholdId = useCallback(async (id: string) => {
55:     setSelectedId(id);
56:     await setStoredActiveHouseholdId(id);
57:   }, []);
```
- **Lines 54–57:** Memoized callback handler `handleSetActiveHouseholdId` to set active household state and update `AsyncStorage`.

```tsx
59:   const value = useMemo(
60:     () => ({
61:       activeHouseholdId,
62:       activeHousehold,
63:       households,
64:       isLoading: isLoading || isFetching || !isStoreLoaded,
65:       setActiveHouseholdId: handleSetActiveHouseholdId,
66:     }),
67:     [
68:       activeHouseholdId,
69:       activeHousehold,
70:       households,
71:       isLoading,
72:       isFetching,
73:       isStoreLoaded,
74:       handleSetActiveHouseholdId,
75:     ],
76:   );
77: 
78:   return (
79:     <ActiveHouseholdContext.Provider value={value}>{children}</ActiveHouseholdContext.Provider>
80:   );
81: }
```
- **Lines 59–76:** Constructs the memoized context value object. `isLoading` evaluates to `true` if backend queries are pending/fetching or if local storage read is not complete.
- **Lines 78–81:** Wraps child components in `ActiveHouseholdContext.Provider`.

```tsx
83: export function useActiveHousehold() {
84:   const context = useContext(ActiveHouseholdContext);
85:   if (!context) {
86:     throw new Error(
87:       'useActiveHousehold muss innerhalb von ActiveHouseholdProvider verwendet werden',
88:     );
89:   }
90:   return context;
91: }
```
- **Lines 83–91:** Custom hook `useActiveHousehold()` exposing context values. Throws a descriptive runtime exception if invoked outside `<ActiveHouseholdProvider>`.

---

## 2. `active-household-store.ts`

**File Location:** [`src/features/household/active-household-store.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/active-household-store.ts)

Handles asynchronous reads and writes of the active household ID to `@react-native-async-storage/async-storage`.

### Detailed Code Breakdown

```tsx
1: import AsyncStorage from '@react-native-async-storage/async-storage';
2: 
3: const STORAGE_KEY = '@fam/active_household_id';
```
- **Line 1:** Imports `AsyncStorage` module.
- **Line 3:** Constant `STORAGE_KEY` defines key identifier used in AsyncStorage (`'@fam/active_household_id'`).

```tsx
5: export async function getStoredActiveHouseholdId(): Promise<string | null> {
6:   try {
7:     return await AsyncStorage.getItem(STORAGE_KEY);
8:   } catch {
9:     return null;
10:   }
11: }
```
- **Lines 5–11:** `getStoredActiveHouseholdId()` retrieves stored active household ID string. Returns `null` if key does not exist or if an unexpected storage error occurs.

```tsx
13: export async function setStoredActiveHouseholdId(id: string | null): Promise<void> {
14:   try {
15:     if (id) {
16:       await AsyncStorage.setItem(STORAGE_KEY, id);
17:     } else {
18:       await AsyncStorage.removeItem(STORAGE_KEY);
19:     }
20:   } catch {
21:     // Error handling silent fallback
22:   }
23: }
```
- **Lines 13–23:** `setStoredActiveHouseholdId(id)` saves `id` to storage if provided, or removes key if `null`. Errors are safely caught to prevent app crashes.

---

## 3. `api.ts`

**File Location:** [`src/features/household/api.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/api.ts)

Defines TanStack Query hooks for querying and mutating households, members, invite tokens, and child profiles via Supabase.

### Detailed Code Breakdown

```tsx
1: import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
2: 
3: import type { Database } from '@/lib/database.types';
4: import { getSupabase } from '@/lib/supabase';
```
- **Lines 1–4:** Imports TanStack Query primitives, database schema types, and Supabase client retriever function.

#### Household Queries & Mutations

```tsx
10: export function useHouseholds() {
11:   return useQuery({
12:     queryKey: ['households'],
13:     queryFn: async () => {
14:       const { data, error } = await getSupabase()
15:         .from('households')
16:         .select('*')
17:         .order('created_at', { ascending: true });
18: 
19:       if (error) throw new Error(error.message);
20:       return data;
21:     },
22:   });
23: }
```
- **Lines 10–23:** `useHouseholds()` queries `households` table for all rows assigned to authenticated user via RLS (Row Level Security), sorted by creation date ascending.

```tsx
25: export function useCreateHouseholdMutation() {
26:   const queryClient = useQueryClient();
27: 
28:   return useMutation({
29:     mutationFn: async (householdName: string) => {
30:       const { data, error } = await getSupabase().rpc('create_household', {
31:         household_name: householdName,
32:       });
33: 
34:       if (error) throw new Error(error.message);
35:       return data;
36:     },
37:     onSuccess: async () => {
38:       await queryClient.invalidateQueries({ queryKey: ['households'] });
39:       await queryClient.refetchQueries({ queryKey: ['households'] });
40:     },
41:   });
42: }
```
- **Lines 25–42:** `useCreateHouseholdMutation()` calls Supabase RPC function `create_household` with given name. On success, invalidates and refetches `['households']` query cache.

#### Household Member Management

```tsx
44: export function useHouseholdMembers(householdId: string) {
45:   return useQuery({
46:     queryKey: ['households', householdId, 'members'],
47:     queryFn: async () => {
48:       const { data, error } = await getSupabase()
49:         .from('household_members')
50:         .select('*, profiles:user_id(*)')
51:         .eq('household_id', householdId)
52:         .order('joined_at', { ascending: true });
53: 
54:       if (error) throw new Error(error.message);
55:       return data;
56:     },
57:     enabled: !!householdId,
58:   });
59: }
```
- **Lines 44–58:** `useHouseholdMembers()` queries members of specified `householdId`, joining profile details (`profiles:user_id(*)`). Enabled only when `householdId` is present.

```tsx
61: export function useUpdateMemberRoleMutation() {
62:   const queryClient = useQueryClient();
63: 
64:   return useMutation({
65:     mutationFn: async ({
66:       householdId,
67:       userId,
68:       role,
69:     }: {
70:       householdId: string;
71:       userId: string;
72:       role: 'admin' | 'member';
73:     }) => {
74:       const { data, error } = await getSupabase()
75:         .from('household_members')
76:         .update({ role, updated_at: new Date().toISOString() })
77:         .eq('household_id', householdId)
78:         .eq('user_id', userId);
79: 
80:       if (error) throw new Error(error.message);
81:       return data;
82:     },
83:     onSuccess: (_, variables) => {
84:       queryClient.invalidateQueries({
85:         queryKey: ['households', variables.householdId, 'members'],
86:       });
87:     },
88:   });
89: }
```
- **Lines 61–89:** `useUpdateMemberRoleMutation()` updates a member's role (`'admin'` or `'member'`) in `household_members`. On success, invalidates members query cache for that household.

```tsx
91: export function useRemoveMemberMutation() {
92:   const queryClient = useQueryClient();
93: 
94:   return useMutation({
95:     mutationFn: async ({ householdId, userId }: { householdId: string; userId: string }) => {
96:       const { data, error } = await getSupabase()
97:         .from('household_members')
98:         .delete()
99:         .eq('household_id', householdId)
100:         .eq('user_id', userId);
101: 
102:       if (error) throw new Error(error.message);
103:       return data;
104:     },
105:     onSuccess: (_, variables) => {
106:       queryClient.invalidateQueries({
107:         queryKey: ['households', variables.householdId, 'members'],
108:       });
109:     },
110:   });
111: }
```
- **Lines 91–111:** `useRemoveMemberMutation()` deletes a member record from a specified household. Invalidates members query cache.

```tsx
113: export function useLeaveHouseholdMutation() {
114:   const queryClient = useQueryClient();
115: 
116:   return useMutation({
117:     mutationFn: async (householdId: string) => {
118:       // Löscht den eigenen Eintrag aus household_members (RLS erlaubt das für sich selbst)
119:       const { data, error } = await getSupabase()
120:         .from('household_members')
121:         .delete()
122:         .eq('household_id', householdId);
123: 
124:       if (error) throw new Error(error.message);
125:       return data;
126:     },
127:     onSuccess: () => {
128:       queryClient.invalidateQueries({ queryKey: ['households'] });
129:     },
130:   });
131: }
```
- **Lines 113–131:** `useLeaveHouseholdMutation()` allows current user to leave household by deleting their own row from `household_members`. Invalidates user's households query cache.

```tsx
133: export function useDeleteHouseholdMutation() {
134:   const queryClient = useQueryClient();
135: 
136:   return useMutation({
137:     mutationFn: async (householdId: string) => {
138:       // Nur der Admin/Ersteller darf löschen (RLS regelt das)
139:       const { data, error } = await getSupabase().from('households').delete().eq('id', householdId);
140: 
141:       if (error) throw new Error(error.message);
142:       return data;
143:     },
144:     onSuccess: () => {
145:       queryClient.invalidateQueries({ queryKey: ['households'] });
146:     },
147:   });
148: }
```
- **Lines 133–148:** `useDeleteHouseholdMutation()` deletes the household record entirely (enforced by RLS for household creator/admin). Invalidates households query.

#### Household Invites Management

```tsx
150: export function useHouseholdInvites(householdId: string) {
151:   return useQuery({
152:     queryKey: ['households', householdId, 'invites'],
153:     queryFn: async () => {
154:       const { data, error } = await getSupabase()
155:         .from('household_invites')
156:         .select('*')
157:         .eq('household_id', householdId)
158:         .is('revoked_at', null)
159:         .gt('expires_at', new Date().toISOString())
160:         .order('created_at', { ascending: false });
161: 
162:       if (error) throw new Error(error.message);
163:       return data;
164:     },
165:     enabled: !!householdId,
166:   });
167: }
```
- **Lines 150–167:** `useHouseholdInvites()` queries active invite tokens for `householdId` where `revoked_at` is null and `expires_at` is in the future.

```tsx
169: export function useCreateInviteMutation() {
170:   const queryClient = useQueryClient();
171: 
172:   return useMutation({
173:     mutationFn: async ({
174:       householdId,
175:       createdBy,
176:       expiresDays = 7,
177:       maxUses = 1,
178:     }: {
179:       householdId: string;
180:       createdBy: string;
181:       expiresDays?: number;
182:       maxUses?: number;
183:     }) => {
184:       const expiresAt = new Date(Date.now() + expiresDays * 86400000).toISOString();
185:       const { data, error } = await getSupabase()
186:         .from('household_invites')
187:         .insert({
188:           household_id: householdId,
189:           created_by: createdBy,
190:           expires_at: expiresAt,
191:           max_uses: maxUses,
192:         })
193:         .select('*')
194:         .single();
195: 
196:       if (error) throw new Error(error.message);
197:       return data;
198:     },
199:     onSuccess: (_, variables) => {
200:       queryClient.invalidateQueries({
201:         queryKey: ['households', variables.householdId, 'invites'],
202:       });
203:     },
204:   });
205: }
```
- **Lines 169–205:** `useCreateInviteMutation()` inserts a new invite token row with calculated `expires_at` (defaulting to 7 days) and `max_uses`. Invalidates invites query for that household.

```tsx
207: export function useRevokeInviteMutation() {
208:   const queryClient = useQueryClient();
209: 
210:   return useMutation({
211:     mutationFn: async ({
212:       inviteId,
213:       householdId: _householdId,
214:     }: {
215:       inviteId: string;
216:       householdId: string;
217:     }) => {
218:       const { data, error } = await getSupabase()
219:         .from('household_invites')
220:         .update({ revoked_at: new Date().toISOString() })
221:         .eq('id', inviteId);
222: 
223:       if (error) throw new Error(error.message);
224:       return data;
225:     },
226:     onSuccess: (_, variables) => {
227:       queryClient.invalidateQueries({
228:         queryKey: ['households', variables.householdId, 'invites'],
229:       });
230:     },
231:   });
232: }
```
- **Lines 207–232:** `useRevokeInviteMutation()` invalidates an invite by stamping `revoked_at` with the current timestamp.

```tsx
234: export function useRedeemInviteMutation() {
235:   const queryClient = useQueryClient();
236: 
237:   return useMutation({
238:     mutationFn: async (inviteToken: string) => {
239:       const { data, error } = await getSupabase().rpc('redeem_invite', {
240:         invite_token: inviteToken,
241:       });
242: 
243:       if (error) throw new Error(error.message);
244:       return data;
245:     },
246:     onSuccess: async () => {
247:       await queryClient.invalidateQueries({ queryKey: ['households'] });
248:       await queryClient.refetchQueries({ queryKey: ['households'] });
249:     },
250:   });
251: }
```
- **Lines 234–251:** `useRedeemInviteMutation()` calls RPC procedure `redeem_invite` with the given token string to join a household. Re-synchronizes households query.

#### Child Profiles Management

```tsx
253: export function useChildProfiles(householdId: string) {
254:   return useQuery({
255:     queryKey: ['households', householdId, 'children'],
256:     queryFn: async () => {
257:       const { data, error } = await getSupabase()
258:         .from('child_profiles')
259:         .select('*')
260:         .eq('household_id', householdId)
261:         .order('created_at', { ascending: true });
262: 
263:       if (error) throw new Error(error.message);
264:       return data;
265:     },
266:     enabled: !!householdId,
267:   });
268: }
```
- **Lines 253–268:** `useChildProfiles()` queries `child_profiles` for specified `householdId`.

```tsx
270: export function useAddChildProfileMutation() {
271:   const queryClient = useQueryClient();
272: 
273:   return useMutation({
274:     mutationFn: async ({
275:       householdId,
276:       displayName,
277:       birthDate,
278:       sex,
279:       heightCm,
280:       managedBy,
281:     }: {
282:       householdId: string;
283:       displayName: string;
284:       birthDate?: string | null;
285:       sex?: string | null;
286:       heightCm?: number | null;
287:       managedBy?: string | null;
288:     }) => {
289:       const { data, error } = await getSupabase()
290:         .from('child_profiles')
291:         .insert({
292:           household_id: householdId,
293:           display_name: displayName,
294:           birth_date: birthDate ?? null,
295:           sex: sex ?? null,
296:           height_cm: heightCm ?? null,
297:           managed_by: managedBy ?? null,
298:         })
299:         .select('*')
300:         .single();
301: 
302:       if (error) throw new Error(error.message);
303:       return data;
304:     },
305:     onSuccess: (_, variables) => {
306:       queryClient.invalidateQueries({
307:         queryKey: ['households', variables.householdId, 'children'],
308:       });
309:     },
310:   });
311: }
```
- **Lines 270–311:** `useAddChildProfileMutation()` inserts a new record into `child_profiles` and invalidates the household's children query cache.

```tsx
313: export function useDeleteChildProfileMutation() {
314:   const queryClient = useQueryClient();
315: 
316:   return useMutation({
317:     mutationFn: async ({ id, householdId: _householdId }: { id: string; householdId: string }) => {
318:       const { data, error } = await getSupabase().from('child_profiles').delete().eq('id', id);
319: 
320:       if (error) throw new Error(error.message);
321:       return data;
322:     },
323:     onSuccess: (_, variables) => {
324:       queryClient.invalidateQueries({
325:         queryKey: ['households', variables.householdId, 'children'],
326:       });
327:     },
328:   });
329: }
```
- **Lines 313–329:** `useDeleteChildProfileMutation()` deletes a child profile row by `id`.

```tsx
331: export function useUpdateChildProfileMutation() {
332:   const queryClient = useQueryClient();
333: 
334:   return useMutation({
335:     mutationFn: async ({
336:       id,
337:       householdId: _householdId,
338:       displayName,
339:       birthDate,
340:       sex,
341:       heightCm,
342:     }: {
343:       id: string;
344:       householdId: string;
345:       displayName?: string;
346:       birthDate?: string | null;
347:       sex?: string | null;
348:       heightCm?: number | null;
349:     }) => {
350:       const updates: Database['public']['Tables']['child_profiles']['Update'] = {
351:         updated_at: new Date().toISOString(),
352:       };
353:       if (displayName !== undefined) updates.display_name = displayName;
354:       if (birthDate !== undefined) updates.birth_date = birthDate;
355:       if (sex !== undefined) updates.sex = sex;
356:       if (heightCm !== undefined) updates.height_cm = heightCm;
357: 
358:       const { data, error } = await getSupabase()
359:         .from('child_profiles')
360:         .update(updates)
361:         .eq('id', id)
362:         .select('*')
363:         .single();
364: 
365:       if (error) throw new Error(error.message);
366:       return data;
367:     },
368:     onSuccess: (_, variables) => {
369:       queryClient.invalidateQueries({
370:         queryKey: ['households', variables.householdId, 'children'],
371:       });
372:     },
373:   });
374: }
```
- **Lines 331–374:** `useUpdateChildProfileMutation()` builds a partial update payload for `child_profiles` and executes updates.

---

## 4. `child-profiles-screen.tsx`

**File Location:** [`src/features/household/child-profiles-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/child-profiles-screen.tsx)

Screen component allowing household members to view, create, edit, and delete child profiles.

### Detailed Code Breakdown

```tsx
1: import { useState } from 'react';
2: import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
3: 
4: import { Button } from '@/components/ui/buttons';
5: import { Card } from '@/components/card';
6: import { DatePicker } from '@/components/date-picker';
7: import { Screen } from '@/components/screen';
8: import { TextField } from '@/components/text-field';
9: import { ThemedText } from '@/components/themed-text';
10: import { Spacing } from '@/constants/theme';
11: import { useActiveHousehold } from '@/features/household/active-household-provider';
12: import {
13:   useAddChildProfileMutation,
14:   useChildProfiles,
15:   useDeleteChildProfileMutation,
16:   useUpdateChildProfileMutation,
17: } from '@/features/household/api';
18: import { useTheme } from '@/hooks/use-theme';
```
- **Lines 1–18:** Imports React state hook, React Native UI components (`Alert`, `FlatList`, `Pressable`, `StyleSheet`, `View`), reusable design components, theme constants, and domain custom hooks.

```tsx
20: export function ChildProfilesScreen() {
21:   const theme = useTheme();
22:   const { activeHousehold } = useActiveHousehold();
23:   const currentHousehold = activeHousehold;
24:   const householdId = currentHousehold?.id ?? '';
25: 
26:   const { data: children = [], isLoading } = useChildProfiles(householdId);
27:   const addMutation = useAddChildProfileMutation();
28:   const updateMutation = useUpdateChildProfileMutation();
29:   const deleteMutation = useDeleteChildProfileMutation();
```
- **Lines 20–29:** Subscribes to active household context, queries child profiles, and instantiates mutation hooks for creation, update, and deletion.

```tsx
31:   const [showAddForm, setShowAddForm] = useState(false);
32:   const [name, setName] = useState('');
33:   const [birthDate, setBirthDate] = useState('');
34:   const [sex, setSex] = useState<'male' | 'female' | null>(null);
35:   const [heightCm, setHeightCm] = useState('');
36: 
37:   const [editingId, setEditingId] = useState<string | null>(null);
38:   const [editName, setEditName] = useState('');
39:   const [editBirthDate, setEditBirthDate] = useState('');
40:   const [editSex, setEditSex] = useState<'male' | 'female' | null>(null);
41:   const [editHeightCm, setEditHeightCm] = useState('');
```
- **Lines 31–35:** Form state variables for adding a new child profile.
- **Lines 37–41:** Form state variables for editing an existing child profile inline.

```tsx
43:   async function handleAdd() {
44:     const trimmed = name.trim();
45:     if (!trimmed || !householdId) return;
46: 
47:     try {
48:       await addMutation.mutateAsync({
49:         householdId,
50:         displayName: trimmed,
51:         birthDate: birthDate.trim() || null,
52:         sex,
53:         heightCm: heightCm.trim() ? parseFloat(heightCm) : null,
54:       });
55:       setName('');
56:       setBirthDate('');
57:       setSex(null);
58:       setHeightCm('');
59:       setShowAddForm(false);
60:     } catch (err) {
61:       Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Erstellen');
62:     }
63:   }
```
- **Lines 43–63:** Validates form input, invokes `addMutation`, resets form fields on success, or presents an alert error box on failure.

```tsx
65:   function startEdit(item: (typeof children)[0]) {
66:     setEditingId(item.id);
67:     setEditName(item.display_name);
68:     setEditBirthDate(item.birth_date ?? '');
69:     setEditSex((item.sex as 'male' | 'female') ?? null);
70:     setEditHeightCm(item.height_cm ? String(item.height_cm) : '');
71:   }
```
- **Lines 65–71:** Populates edit form state with target child profile attributes and activates inline edit mode for `item.id`.

```tsx
73:   async function handleUpdate(id: string) {
74:     const trimmed = editName.trim();
75:     if (!trimmed || !householdId) return;
76: 
77:     try {
78:       await updateMutation.mutateAsync({
79:         id,
80:         householdId,
81:         displayName: trimmed,
82:         birthDate: editBirthDate.trim() || null,
83:         sex: editSex,
84:         heightCm: editHeightCm.trim() ? parseFloat(editHeightCm) : null,
85:       });
86:       setEditingId(null);
87:     } catch (err) {
88:       Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Speichern');
89:     }
90:   }
```
- **Lines 73–90:** Validates edit form input, triggers `updateMutation`, and exits inline editing mode upon success.

```tsx
92:   async function handleDelete(id: string, childName: string) {
93:     Alert.alert(
94:       'Profil löschen',
95:       `Möchtest du das Kinder-Profil "${childName}" wirklich entfernen?`,
96:       [
97:         { text: 'Abbrechen', style: 'cancel' },
98:         {
99:           text: 'Löschen',
100:           style: 'destructive',
101:           onPress: async () => {
102:             try {
103:               await deleteMutation.mutateAsync({ id, householdId });
104:             } catch (err) {
105:               Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Löschen');
106:             }
107:           },
108:         },
109:       ],
110:     );
111:   }
```
- **Lines 92–111:** Prompts user with native `Alert` confirmation dialog prior to deleting child profile.

```tsx
113:   return (
114:     <Screen title="Kinder-Profile" subtitle={currentHousehold?.name} showBackButton>
115:       {showAddForm ? (
116:         <Card title="Kinder-Profil hinzufügen">
...
182:         </Card>
183:       ) : (
184:         <View style={{ marginBottom: Spacing.four }}>
185:           <Button label="+ Kinder-Profil anlegen" onPress={() => setShowAddForm(true)} />
186:         </View>
187:       )}
```
- **Lines 113–187:** Renders `Screen` wrapper. Conditionally displays add child profile card (with name, date picker, segmented male/female toggles, height input, and save/cancel buttons) or a button to open the form.

```tsx
189:       <Card title="Erfasste Kinder-Profile">
190:         {isLoading ? (
191:           <ThemedText>Lädt Kinder-Profile...</ThemedText>
192:         ) : children.length === 0 ? (
193:           <ThemedText themeColor="textSecondary">
194:             Noch keine Kinder-Profile in diesem Haushalt hinterlegt.
195:           </ThemedText>
196:         ) : (
197:           <FlatList
198:             data={children}
199:             keyExtractor={(item) => item.id}
200:             scrollEnabled={false}
201:             renderItem={({ item }) => {
...
316:             }}
317:           />
318:         )}
319:       </Card>
320:     </Screen>
321:   );
322: }
```
- **Lines 189–322:** Renders children card list. Uses `FlatList` with `scrollEnabled={false}` inside container screen. Swaps between inline edit mode form and read-only row with emoji avatars (👧/👦/👶), formatted birthdate/age/height info, and action buttons.

```tsx
323: const styles = StyleSheet.create({ ... });
```
- **Lines 323–362:** Layout and spacing styles using `StyleSheet.create`.

---

## 5. `create-household-screen.tsx`

**File Location:** [`src/features/household/create-household-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/create-household-screen.tsx)

Screen for creating a new household entity and routing user into dashboard or join flow.

### Detailed Code Breakdown

```tsx
1: import { useQueryClient } from '@tanstack/react-query';
2: import { router } from 'expo-router';
3: import { useState } from 'react';
4: import { StyleSheet, View } from 'react-native';
5: 
6: import { Button } from '@/components/ui/buttons';
7: import { Card } from '@/components/card';
8: import { Screen } from '@/components/screen';
9: import { TextField } from '@/components/text-field';
10: import { ThemedText } from '@/components/themed-text';
11: import { Spacing } from '@/constants/theme';
12: import { useCreateHouseholdMutation } from '@/features/household/api';
```
- **Lines 1–12:** Imports router, query client, React state, React Native components, UI widgets, theme constants, and household creation mutation hook.

```tsx
14: export function CreateHouseholdScreen() {
15:   const [householdName, setHouseholdName] = useState('');
16:   const [errorMsg, setErrorMsg] = useState<string | null>(null);
17: 
18:   const mutation = useCreateHouseholdMutation();
19:   const queryClient = useQueryClient();
```
- **Lines 14–19:** Screen component function initializing state variables for input text and error feedback, along with TanStack Query mutation hook and query client reference.

```tsx
21:   async function handleSubmit() {
22:     const trimmed = householdName.trim();
23:     if (!trimmed) {
24:       setErrorMsg('Bitte gib einen Namen für den Haushalt ein.');
25:       return;
26:     }
27: 
28:     setErrorMsg(null);
29:     try {
30:       await mutation.mutateAsync(trimmed);
31:       await queryClient.refetchQueries({ queryKey: ['households'] });
32:       // Nach der Erstellung routen wir ins Dashboard.
33:       // Falls der Nutzer von der "Kein Haushalt"-Weiche kam, greift nun die App.
34:       router.replace('/');
35:     } catch (err) {
36:       if (err instanceof Error) {
37:         setErrorMsg(err.message);
38:       } else {
39:         setErrorMsg('Ein unerwarteter Fehler ist aufgetreten.');
40:       }
41:     }
42:   }
```
- **Lines 21–42:** Validation and submit handler:
  - Verifies `householdName` is non-empty.
  - Executes `mutation.mutateAsync(trimmed)`.
  - Refetches `households` queries in background.
  - Replaces navigation route to root `'/'` (dashboard). Handles and displays error messages if RPC fails.

```tsx
44:   return (
45:     <Screen title="Haushalt erstellen" subtitle="Lade später deine Familie oder WG ein">
46:       <Card>
47:         <View style={styles.form}>
48:           <TextField
49:             label="Name deines Haushalts"
50:             value={householdName}
51:             onChangeText={setHouseholdName}
52:             placeholder="z. B. WG Müller"
53:             autoCapitalize="words"
54:           />
55: 
56:           {errorMsg ? (
57:             <ThemedText type="small" themeColor="danger">
58:               {errorMsg}
59:             </ThemedText>
60:           ) : null}
61: 
62:           <Button label="Erstellen" onPress={handleSubmit} loading={mutation.isPending} />
63:         </View>
64:       </Card>
65: 
66:       <Button
67:         label="Ich habe einen Einladungs-Code"
68:         variant="secondary"
69:         onPress={() => router.push('/household/join')}
70:       />
71: 
72:       {router.canGoBack() && (
73:         <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
74:       )}
75:     </Screen>
76:   );
77: }
```
- **Lines 44–77:** Renders form card with text field, error indicator, create button, join button (`/household/join`), and back button (if history allows).

```tsx
79: const styles = StyleSheet.create({
80:   form: {
81:     gap: Spacing.three,
82:   },
83: });
```
- **Lines 79–83:** Form layout style sheet definition.

---

## 6. `household-switcher-modal.tsx`

**File Location:** [`src/features/household/household-switcher-modal.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/household-switcher-modal.tsx)

Modal dialog component enabling users to switch between multiple households or navigate to creation/join flows.

### Detailed Code Breakdown

```tsx
1: import { useQueryClient } from '@tanstack/react-query';
2: import { router } from 'expo-router';
3: import { Modal, Pressable, StyleSheet, View } from 'react-native';
4: 
5: import { Button } from '@/components/ui/buttons';
6: import { ThemedText } from '@/components/themed-text';
7: import { Spacing } from '@/constants/theme';
8: import { useActiveHousehold } from '@/features/household/active-household-provider';
9: import { useTheme } from '@/hooks/use-theme';
```
- **Lines 1–9:** Imports React Native Modal components, Expo Router, theme hooks, design primitives, and `useActiveHousehold`.

```tsx
11: interface HouseholdSwitcherModalProps {
12:   visible: boolean;
13:   selectedHouseholdId?: string;
14:   onSelectHousehold?: (householdId: string) => void;
15:   onClose: () => void;
16: }
```
- **Lines 11–16:** Defines component props for modal visibility, optional selection callbacks, and modal dismiss handler.

```tsx
18: export function HouseholdSwitcherModal({
19:   visible,
20:   selectedHouseholdId: propSelectedId,
21:   onSelectHousehold,
22:   onClose,
23: }: HouseholdSwitcherModalProps) {
24:   const theme = useTheme();
25:   const queryClient = useQueryClient();
26:   const { activeHouseholdId, households, setActiveHouseholdId } = useActiveHousehold();
27: 
28:   const currentSelectedId = propSelectedId ?? activeHouseholdId;
```
- **Lines 18–28:** Component declaration. Obtains active context, query client, and theme tokens. Determines current selected household ID with fallback to `activeHouseholdId`.

```tsx
30:   const handleSelect = async (id: string) => {
31:     await setActiveHouseholdId(id);
32:     queryClient.invalidateQueries();
33:     if (onSelectHousehold) {
34:       onSelectHousehold(id);
35:     }
36:     onClose();
37:   };
```
- **Lines 30–37:** Handles user household selection:
  - Updates active household ID in store/context.
  - Invalidates all query caches in TanStack Query to refresh household-scoped data.
  - Fires optional callback and closes modal.

```tsx
39:   return (
40:     <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
41:       <View style={styles.backdrop}>
42:         <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
43:           <View style={styles.headerRow}>
44:             <ThemedText type="subtitle">Haushalt wechseln</ThemedText>
45:             <Pressable onPress={onClose} hitSlop={10}>
46:               <ThemedText style={{ fontSize: 18, color: theme.textSecondary }}>✕</ThemedText>
47:             </Pressable>
48:           </View>
```
- **Lines 39–48:** Transparent overlay modal with centered box container, header title, and close button (`✕`).

```tsx
50:           <View style={styles.list}>
51:             {households.map((hh) => {
52:               const isSelected = hh.id === currentSelectedId;
53:               return (
54:                 <Pressable
55:                   key={hh.id}
56:                   onPress={() => handleSelect(hh.id)}
57:                   style={[
58:                     styles.hhRow,
59:                     { borderBottomColor: theme.border },
60:                     isSelected && { backgroundColor: theme.backgroundElement },
61:                   ]}>
62:                   <View style={{ flex: 1 }}>
63:                     <ThemedText style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>
64:                       🏠 {hh.name}
65:                     </ThemedText>
66:                   </View>
67:                   {isSelected && (
68:                     <ThemedText style={{ color: '#10B981', fontWeight: 'bold' }}>
69:                       ✓ Aktiv
70:                     </ThemedText>
71:                   )}
72:                 </Pressable>
73:               );
74:             })}
75:           </View>
```
- **Lines 50–75:** Iterates through available `households`, highlighting the active household with an active badge (`✓ Aktiv`) and background styling.

```tsx
77:           <View style={styles.actionButtons}>
78:             <Button
79:               label="+ Neuen Haushalt erstellen"
80:               onPress={() => {
81:                 onClose();
82:                 router.push('/household/create');
83:               }}
84:             />
85:             <Button
86:               label="Haushalt beitreten (Code/Link)"
87:               variant="secondary"
88:               onPress={() => {
89:                 onClose();
90:                 router.push('/household/join');
91:               }}
92:             />
93:           </View>
94:         </View>
95:       </View>
96:     </Modal>
97:   );
98: }
```
- **Lines 77–98:** Renders navigation buttons to create or join another household before closing modal.

```tsx
100: const styles = StyleSheet.create({ ... });
```
- **Lines 100–132:** Defines modal layout, backdrop opacity, and list row styles.

---

## 7. `invite-modal.tsx`

**File Location:** [`src/features/household/invite-modal.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/invite-modal.tsx)

Modal component allowing household administrators to generate, copy, share, and revoke invite codes and QR codes.

### Detailed Code Breakdown

```tsx
1: import * as Clipboard from 'expo-clipboard';
2: import { useState } from 'react';
3: import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
4: import QRCode from 'react-native-qrcode-svg';
5: 
6: import { Button } from '@/components/ui/buttons';
7: import { Card } from '@/components/card';
8: import { ThemedText } from '@/components/themed-text';
9: import { Spacing } from '@/constants/theme';
10: import { useSession } from '@/features/auth/session-provider';
11: import {
12:   useCreateInviteMutation,
13:   useHouseholdInvites,
14:   useRevokeInviteMutation,
15: } from '@/features/household/api';
16: import { useTheme } from '@/hooks/use-theme';
```
- **Lines 1–16:** Imports Expo Clipboard, React Native SVG QR Code (`react-native-qrcode-svg`), Share API, UI components, session provider hook, and household invite API hooks.

```tsx
18: interface InviteModalProps {
19:   visible: boolean;
20:   householdId: string;
21:   householdName: string;
22:   onClose: () => void;
23: }
```
- **Lines 18–23:** Props contract defining visibility, target household ID and name, and modal close callback.

```tsx
25: export function InviteModal({ visible, householdId, householdName, onClose }: InviteModalProps) {
26:   const theme = useTheme();
27:   const { session } = useSession();
28:   const userId = session?.user.id ?? '';
29: 
30:   const { data: invites = [] } = useHouseholdInvites(householdId);
31:   const createMutation = useCreateInviteMutation();
32:   const revokeMutation = useRevokeInviteMutation();
33: 
34:   const [selectedToken, setSelectedToken] = useState<string | null>(null);
35:   const [showQrCode, setShowQrCode] = useState(true);
36:   const [copyFeedback, setCopyFeedback] = useState<'code' | 'link' | null>(null);
```
- **Lines 25–36:** Component state initialization (`selectedToken`, `showQrCode`, `copyFeedback`) and database queries/mutations.

```tsx
38:   async function handleCreate() {
39:     if (!userId || !householdId) return;
40:     try {
41:       const invite = await createMutation.mutateAsync({
42:         householdId,
43:         createdBy: userId,
44:         expiresDays: 7,
45:         maxUses: 5,
46:       });
47:       setSelectedToken(invite.token);
48:       setShowQrCode(true);
49:     } catch (err) {
50:       Alert.alert(
51:         'Fehler',
52:         err instanceof Error ? err.message : 'Einladung konnte nicht erstellt werden.',
53:       );
54:     }
55:   }
```
- **Lines 38–55:** `handleCreate()` executes invite token creation (default: 7-day expiration, 5 max uses), selecting the newly generated token for QR rendering.

```tsx
57:   async function handleCopyCode(token: string) {
58:     try {
59:       await Clipboard.setStringAsync(token);
60:       setCopyFeedback('code');
61:       setTimeout(() => setCopyFeedback(null), 2000);
62:     } catch (err) {
63:       console.error('Fehler beim Kopieren des Codes:', err);
64:     }
65:   }
66: 
67:   async function handleCopyLink(token: string) {
68:     const inviteUrl = `fam://join?token=${token}`;
69:     try {
70:       await Clipboard.setStringAsync(inviteUrl);
71:       setCopyFeedback('link');
72:       setTimeout(() => setCopyFeedback(null), 2000);
73:     } catch (err) {
74:       console.error('Fehler beim Kopieren des Links:', err);
75:     }
76:   }
```
- **Lines 57–65:** Copies raw token string to device clipboard with 2-second visual feedback.
- **Lines 67–76:** Copies app deep link string (`fam://join?token=<token>`) to clipboard.

```tsx
78:   async function handleShare(token: string) {
79:     const inviteUrl = `fam://join?token=${token}`;
80:     try {
81:       await Share.share({
82:         message: `Tritt unserem Haushalt "${householdName}" in Fam bei!\n\nEinladungs-Code: ${token}\nLink: ${inviteUrl}`,
83:       });
84:     } catch (err) {
85:       console.error(err);
86:     }
87:   }
```
- **Lines 78–87:** Triggers native OS sharing menu with prefilled invitation message.

```tsx
89:   async function handleRevoke(inviteId: string) {
90:     Alert.alert('Einladung zurückziehen', 'Möchtest du dieses Einladungstoken ungültig machen?', [
91:       { text: 'Abbrechen', style: 'cancel' },
92:       {
93:         text: 'Zurückziehen',
94:         style: 'destructive',
95:         onPress: async () => {
96:           try {
97:             await revokeMutation.mutateAsync({ inviteId, householdId });
98:             if (selectedToken && invites.find((i) => i.id === inviteId)?.token === selectedToken) {
99:               setSelectedToken(null);
100:             }
101:           } catch (err) {
102:             Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Zurückziehen');
103:           }
104:         },
105:       },
106:     ]);
107:   }
```
- **Lines 89–107:** Asks confirmation before revoking an active invite token. Resets `selectedToken` if the revoked token was active.

```tsx
109:   return (
110:     <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
111:       <View style={styles.backdrop}>
112:         <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
113:           <ScrollView contentContainerStyle={styles.content}>
...
176:             )}
177: 
178:             <ThemedText style={styles.sectionTitle}>Aktive Einladungen</ThemedText>
179:             {invites.length === 0 ? (
180:               <ThemedText type="small" themeColor="textSecondary">
181:                 Keine aktiven Einladungen vorhanden.
182:               </ThemedText>
183:             ) : (
184:               invites.map((inv) => { ... })
234:             )}
235:           </ScrollView>
236: 
237:           <Button label="Schließen" variant="secondary" onPress={onClose} />
238:         </View>
239:       </View>
240:     </Modal>
241:   );
242: }
```
- **Lines 109–242:** Bottom-sheet modal JSX displaying token card with QR code, action buttons (Copy, Share, Toggle QR), list of active invites, expiration dates, usage counts, and quick action icons (📱 QR, 📤 Share, 🗑 Revoke).

```tsx
244: const styles = StyleSheet.create({ ... });
```
- **Lines 244–307:** Styles definition for modal container, QR code card, and invite item list rows.

---

## 8. `join-household-screen.tsx`

**File Location:** [`src/features/household/join-household-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/join-household-screen.tsx)

Screen allowing users to redeem an invitation token or deep link to join an existing household.

### Detailed Code Breakdown

```tsx
1: import { router, useLocalSearchParams } from 'expo-router';
2: import { useEffect, useState } from 'react';
3: import { StyleSheet, View } from 'react-native';
4: 
5: import { Button } from '@/components/ui/buttons';
6: import { Card } from '@/components/card';
7: import { Screen } from '@/components/screen';
8: import { TextField } from '@/components/text-field';
9: import { ThemedText } from '@/components/themed-text';
10: import { Spacing } from '@/constants/theme';
11: import { useRedeemInviteMutation } from '@/features/household/api';
12: import { clearPendingInviteToken, peekPendingInviteToken } from '@/lib/pending-invite';
```
- **Lines 1–12:** Imports router, route param hook, React state/effects, UI primitives, household invite redemption mutation hook, and deep link pending invite storage utilities.

```tsx
14: export function JoinHouseholdScreen() {
15:   const params = useLocalSearchParams<{ token?: string }>();
16:   const [tokenInput, setTokenInput] = useState(params.token ?? '');
17:   const [errorMsg, setErrorMsg] = useState<string | null>(null);
18: 
19:   const redeemMutation = useRedeemInviteMutation();
```
- **Lines 14–19:** Component initialization. Parses token parameter from route parameters (`params.token`) into initial state `tokenInput`.

```tsx
21:   useEffect(() => {
22:     // Nicht-destruktiv lesen (#128): Bricht der Nutzer hier ab, ohne
23:     // "Beitreten" zu tippen, bleibt der Token fuer einen spaeteren Versuch
24:     // erhalten statt beim blossen Anzeigen des Screens verloren zu gehen.
25:     if (!params.token) {
26:       peekPendingInviteToken().then((pending) => {
27:         if (pending) {
28:           setTokenInput(pending);
29:         }
30:       });
31:     }
32:   }, [params.token]);
```
- **Lines 21–32:** `useEffect` hook: If no route token parameter was passed, non-destructively reads (`peekPendingInviteToken`) any pending deep-link token saved during app launch.

```tsx
34:   async function handleJoin() {
35:     const trimmed = tokenInput.trim();
36:     if (!trimmed) {
37:       setErrorMsg('Bitte gib einen Einladungs-Code ein.');
38:       return;
39:     }
40: 
41:     setErrorMsg(null);
42:     try {
43:       await redeemMutation.mutateAsync(trimmed);
44:       await clearPendingInviteToken();
45:       router.replace('/');
46:     } catch (err) {
47:       if (err instanceof Error) {
48:         setErrorMsg(err.message);
49:       } else {
50:         setErrorMsg('Einladung konnte nicht eingelöst werden.');
51:       }
52:     }
53:   }
```
- **Lines 34–53:** Triggers invite redemption:
  - Calls `redeemMutation.mutateAsync(trimmed)`.
  - Clears stored pending token (`clearPendingInviteToken`) only after successful redemption.
  - Replaces navigation stack with root `'/'`. Sets `errorMsg` if redemption fails.

```tsx
55:   return (
56:     <Screen title="Haushalt beitreten" subtitle="Mit Einladungs-Code oder Link">
57:       <Card title="Einlösung">
58:         <View style={styles.form}>
59:           <TextField
60:             label="Einladungs-Code / Token"
61:             placeholder="z. B. 123e4567-e89b-12d3-a456-426614174000"
62:             value={tokenInput}
63:             onChangeText={setTokenInput}
64:             autoCapitalize="none"
65:             autoCorrect={false}
66:           />
67: 
68:           {errorMsg ? (
69:             <ThemedText type="small" themeColor="danger">
70:               {errorMsg}
71:             </ThemedText>
72:           ) : null}
73: 
74:           <Button
75:             label="Haushalt beitreten"
76:             onPress={handleJoin}
77:             loading={redeemMutation.isPending}
78:             disabled={!tokenInput.trim()}
79:           />
80:         </View>
81:       </Card>
82: 
83:       <View style={{ marginTop: Spacing.four }}>
84:         <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
85:       </View>
86:     </Screen>
87:   );
88: }
```
- **Lines 55–88:** Renders form card with text input for invite token, error notice, join button, and cancel button.

```tsx
90: const styles = StyleSheet.create({
91:   form: {
92:     gap: Spacing.three,
93:   },
94: });
```
- **Lines 90–94:** Styles definition.

---

## 9. `members-screen.tsx`

**File Location:** [`src/features/household/members-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/household/members-screen.tsx)

Screen showing members of the active household, providing role management, member removal, invite generation, household switching, leaving, and deletion options.

### Detailed Code Breakdown

```tsx
1: import { router } from 'expo-router';
2: import { useState } from 'react';
3: import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
4: 
5: import { Button } from '@/components/ui/buttons';
6: import { Screen } from '@/components/screen';
7: import { ThemedText } from '@/components/themed-text';
8: import { Spacing } from '@/constants/theme';
9: import { useSession } from '@/features/auth/session-provider';
10: import { useActiveHousehold } from '@/features/household/active-household-provider';
11: import {
12:   useDeleteHouseholdMutation,
13:   useHouseholdMembers,
14:   useLeaveHouseholdMutation,
15:   useRemoveMemberMutation,
16:   useUpdateMemberRoleMutation,
17: } from '@/features/household/api';
18: import { HouseholdSwitcherModal } from '@/features/household/household-switcher-modal';
19: import { InviteModal } from '@/features/household/invite-modal';
20: import { useTheme } from '@/hooks/use-theme';
```
- **Lines 1–20:** Imports navigation router, React state hooks, React Native UI components, custom UI widgets, authentication session hook, active household hook, query/mutation hooks, and modals (`InviteModal`, `HouseholdSwitcherModal`).

```tsx
22: export function MembersScreen() {
23:   const { session } = useSession();
24:   const currentUserId = session?.user.id;
25:   const theme = useTheme();
26: 
27:   const { activeHousehold, activeHouseholdId, households } = useActiveHousehold();
28:   const currentHousehold = activeHousehold;
29:   const householdId = activeHouseholdId ?? '';
30: 
31:   const { data: members, isLoading } = useHouseholdMembers(householdId);
32:   const updateRoleMutation = useUpdateMemberRoleMutation();
33:   const removeMemberMutation = useRemoveMemberMutation();
34:   const leaveMutation = useLeaveHouseholdMutation();
35:   const deleteMutation = useDeleteHouseholdMutation();
36: 
37:   const [loadingAction, setLoadingAction] = useState<string | null>(null);
38:   const [showInviteModal, setShowInviteModal] = useState(false);
39:   const [showSwitcherModal, setShowSwitcherModal] = useState(false);
```
- **Lines 22–39:** Component initialization. Accesses current user ID, active household data, queries household members, instantiates mutations, and sets up state for modal visibility and loading indicators.

```tsx
41:   const myMembership = members?.find((m) => m.user_id === currentUserId);
42:   const isAdmin = myMembership?.role === 'admin';
43:   const adminCount = members?.filter((m) => m.role === 'admin').length ?? 0;
```
- **Lines 41–43:** Computes permission variables:
  - `myMembership`: Current user's member record.
  - `isAdmin`: True if caller's role is `'admin'`.
  - `adminCount`: Count of total administrators in the household.

```tsx
45:   async function handleToggleRole(userId: string, currentRole: string, name: string) {
46:     if (!isAdmin || !householdId) return;
47:     const newRole = currentRole === 'admin' ? 'member' : 'admin';
48:     const actionText =
49:       newRole === 'admin' ? 'zum Administrator ernennen' : 'die Admin-Rolle entziehen';
50: 
51:     Alert.alert('Rolle ändern', `Möchtest du "${name}" ${actionText}?`, [
52:       { text: 'Abbrechen', style: 'cancel' },
53:       {
54:         text: 'Bestätigen',
55:         onPress: async () => {
56:           try {
57:             await updateRoleMutation.mutateAsync({
58:               householdId,
59:               userId,
60:               role: newRole,
61:             });
62:           } catch (err) {
63:             Alert.alert(
64:               'Fehler',
65:               err instanceof Error ? err.message : 'Fehler beim Ändern der Rolle',
66:             );
67:           }
68:         },
69:       },
70:     ]);
71:   }
```
- **Lines 45–71:** `handleToggleRole()` prompts administrator with confirmation before toggling target member's role between `'admin'` and `'member'`.

```tsx
73:   async function handleRemoveMember(userId: string, name: string) {
74:     if (!isAdmin || !householdId) return;
75:     Alert.alert(
76:       'Mitglied entfernen',
77:       `Möchtest du "${name}" wirklich aus dem Haushalt entfernen?`,
78:       [
79:         { text: 'Abbrechen', style: 'cancel' },
80:         {
81:           text: 'Entfernen',
82:           style: 'destructive',
83:           onPress: async () => {
84:             try {
85:               await removeMemberMutation.mutateAsync({ householdId, userId });
86:             } catch (err) {
87:               Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Entfernen');
88:             }
89:           },
90:         },
91:       ],
92:     );
93:   }
```
- **Lines 73–93:** `handleRemoveMember()` confirms and executes member removal.

```tsx
95:   async function handleLeave() {
96:     if (!householdId) return;
97:     if (isAdmin && adminCount <= 1) {
98:       Alert.alert(
99:         'Haushalt verlassen nicht möglich',
100:         'Du bist der einzige Administrator dieses Haushalts. Ernenne zuerst ein anderes Mitglied zum Admin, bevor du den Haushalt verlässt.',
101:       );
102:       return;
103:     }
104: 
105:     Alert.alert('Haushalt verlassen', 'Möchtest du den Haushalt wirklich verlassen?', [
106:       { text: 'Abbrechen', style: 'cancel' },
107:       {
108:         text: 'Verlassen',
109:         style: 'destructive',
110:         onPress: async () => {
111:           setLoadingAction('leave');
112:           try {
113:             await leaveMutation.mutateAsync(householdId);
114:             router.replace('/');
115:           } catch (err: unknown) {
116:             Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler');
117:           } finally {
118:             setLoadingAction(null);
119:           }
120:         },
121:       },
122:     ]);
123:   }
```
- **Lines 95–123:** `handleLeave()` handles user departure from household. Enforces admin safety guard: sole admin cannot leave without delegating admin privileges first.

```tsx
125:   async function handleDelete() {
126:     if (!householdId) return;
127:     Alert.alert(
128:       'Haushalt löschen',
129:       'Dieser Schritt löscht den kompletten Haushalt für alle Mitglieder und kann nicht rückgängig gemacht werden.',
130:       [
131:         { text: 'Abbrechen', style: 'cancel' },
132:         {
133:           text: 'Löschen',
134:           style: 'destructive',
135:           onPress: async () => {
136:             setLoadingAction('delete');
137:             try {
138:               await deleteMutation.mutateAsync(householdId);
139:               router.replace('/');
140:             } catch (err: unknown) {
141:               Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler');
142:             } finally {
143:               setLoadingAction(null);
144:             }
145:           },
146:         },
147:       ],
148:     );
149:   }
```
- **Lines 125–149:** `handleDelete()` prompts administrator confirmation before executing complete household deletion.

```tsx
151:   return (
152:     <Screen title="Mitglieder" subtitle={currentHousehold?.name} scroll={false}>
153:       {households.length > 1 && (
154:         <View style={{ marginBottom: Spacing.two }}>
155:           <Button
156:             label={`🏠 Haushalt wechseln (${currentHousehold?.name ?? ''})`}
157:             variant="secondary"
158:             onPress={() => setShowSwitcherModal(true)}
159:           />
160:         </View>
161:       )}
162: 
163:       {isAdmin && currentHousehold && (
164:         <View style={styles.topActionRow}>
165:           <View style={{ flex: 1 }}>
166:             <Button label="+ Mitglied einladen" onPress={() => setShowInviteModal(true)} />
167:           </View>
168:           <Button
169:             label="👶 Kinder-Profile"
170:             variant="secondary"
171:             onPress={() => router.push('/household/children')}
172:           />
173:         </View>
174:       )}
```
- **Lines 151–174:** Header area with household switcher button (if user belongs to >1 households) and admin action row for inviting members and managing child profiles.

```tsx
176:       <FlatList
177:         style={{ flex: 1 }}
178:         data={members}
179:         keyExtractor={(item) => item.user_id}
180:         contentContainerStyle={styles.list}
181:         renderItem={({ item }) => {
182:           const isMe = item.user_id === currentUserId;
183:           const profile = item.profiles as unknown as {
184:             display_name: string | null;
185:             avatar_url: string | null;
186:           };
187:           const displayName = profile?.display_name || 'Unbekanntes Mitglied';
188:           const initials = (displayName || '?').substring(0, 2).toUpperCase();
189: 
190:           return (
191:             <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
192:               <View
193:                 style={[
194:                   styles.avatar,
195:                   { backgroundColor: theme.backgroundElement },
196:                   isMe && { borderColor: theme.accent, borderWidth: 2 },
197:                 ]}>
198:                 {profile?.avatar_url ? (
199:                   <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
200:                 ) : (
201:                   <ThemedText style={styles.avatarText}>{initials}</ThemedText>
202:                 )}
203:               </View>
204: 
205:               <View style={styles.memberInfo}>
206:                 <ThemedText style={{ fontWeight: isMe ? 'bold' : 'normal' }}>
207:                   {displayName} {isMe ? '(Du)' : ''}
208:                 </ThemedText>
209:                 <ThemedText type="small" themeColor="textSecondary">
210:                   Rolle: {item.role === 'admin' ? 'Administrator' : 'Mitglied'}
211:                 </ThemedText>
212:               </View>
213: 
214:               {isAdmin && !isMe && (
215:                 <View style={styles.memberActions}>
216:                   <Pressable
217:                     onPress={() => handleToggleRole(item.user_id, item.role, displayName)}
218:                     style={styles.roleTag}>
219:                     <ThemedText type="small" style={{ color: theme.accent, fontSize: 12 }}>
220:                       {item.role === 'admin' ? 'Admin ▾' : 'Mitglied ▾'}
221:                     </ThemedText>
222:                   </Pressable>
223:                   <Pressable
224:                     onPress={() => handleRemoveMember(item.user_id, displayName)}
225:                     style={styles.removeTag}>
226:                     <ThemedText type="small" style={{ color: theme.danger, fontSize: 12 }}>
227:                       Entfernen
228:                     </ThemedText>
229:                   </Pressable>
230:                 </View>
231:               )}
232:             </View>
233:           );
234:         }}
```
- **Lines 176–234:** `FlatList` rendering member list items, avatar images or calculated initials fallback, role tags, and admin interactive controls.

```tsx
235:         ListFooterComponent={
236:           !isLoading ? (
237:             <View style={styles.actions}>
238:               {!isAdmin && (
239:                 <View style={{ marginBottom: Spacing.three }}>
240:                   <Button
241:                     label="👶 Kinder-Profile verwalten"
242:                     variant="secondary"
243:                     onPress={() => router.push('/household/children')}
244:                   />
245:                 </View>
246:               )}
247: 
248:               {isAdmin ? (
249:                 <View style={{ gap: Spacing.two }}>
250:                   <Button
251:                     label="Haushalt verlassen"
252:                     variant="danger"
253:                     onPress={handleLeave}
254:                     loading={loadingAction === 'leave'}
255:                     disabled={
256:                       adminCount <= 1 || (loadingAction !== null && loadingAction !== 'leave')
257:                     }
258:                   />
259:                   {adminCount <= 1 && (
260:                     <ThemedText
261:                       type="small"
262:                       themeColor="textSecondary"
263:                       style={{ textAlign: 'center', fontSize: 12 }}>
264:                       Ernenne zuerst einen weiteren Admin, um den Haushalt zu verlassen.
265:                     </ThemedText>
266:                   )}
267:                   <Button
268:                     label="Haushalt löschen"
269:                     variant="danger"
270:                     onPress={handleDelete}
271:                     loading={loadingAction === 'delete'}
272:                     disabled={loadingAction !== null && loadingAction !== 'delete'}
273:                   />
274:                 </View>
275:               ) : (
276:                 <Button
277:                   label="Haushalt verlassen"
278:                   variant="danger"
279:                   onPress={handleLeave}
280:                   loading={loadingAction === 'leave'}
281:                   disabled={loadingAction !== null && loadingAction !== 'leave'}
282:                 />
283:               )}
284:             </View>
285:           ) : null
286:         }
287:       />
```
- **Lines 235–287:** `ListFooterComponent` rendering leave household and delete household buttons.

```tsx
289:       {currentHousehold && (
290:         <InviteModal
291:           visible={showInviteModal}
292:           householdId={currentHousehold.id}
293:           householdName={currentHousehold.name}
294:           onClose={() => setShowInviteModal(false)}
295:         />
296:       )}
297: 
298:       <HouseholdSwitcherModal
299:         visible={showSwitcherModal}
300:         selectedHouseholdId={currentHousehold?.id}
301:         onClose={() => setShowSwitcherModal(false)}
302:       />
303:     </Screen>
304:   );
305: }
```
- **Lines 289–305:** Mounts `InviteModal` and `HouseholdSwitcherModal` components controlled by screen state.

```tsx
307: const styles = StyleSheet.create({ ... });
```
- **Lines 307–365:** Screen styling definitions for avatar circles, action tags, and layout containers.
