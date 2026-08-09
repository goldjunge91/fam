# Shopping List Feature Documentation

This document provides a comprehensive, file-by-file and line-by-line technical explanation of the **Shopping List** feature within the application (`src/features/shopping-list`).

The shopping list feature enables household members to manage shared shopping lists, check off purchased items, add new items, soft-delete items, and transition completed shopping runs directly into inventory (`fridge_items`) and historical tracking (`shopping_history`) using an offline-first architecture powered by SQLite and TanStack Query with outbox sync.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Directory Summary](#file-directory-summary)
3. [Detailed File Explanations](#detailed-file-explanations)
   - [1. `shopping-list-screen.tsx`](#1-shopping-list-screentsx)
   - [2. `complete-run-sheet.tsx`](#2-complete-run-sheettsx)
   - [3. `components/add-item-form.tsx`](#3-componentsadd-item-formtsx)
   - [4. `components/shopping-item-row.tsx`](#4-componentsshopping-item-rowtsx)
   - [5. `use-shopping-list.ts`](#5-use-shopping-listts)
   - [6. `use-shopping-list-mutations.ts`](#6-use-shopping-list-mutationsts)
   - [7. `use-complete-shopping-run.ts`](#7-use-complete-shopping-runts)

---

## Architecture Overview

The shopping list feature follows an **Offline-First Data Flow**:

1. **Reading Data**: `useShoppingList` queries the local SQLite database (`shopping_list_items` table) via Expo SQLite. Unchecked items appear first, grouped by category, followed by checked items (strikethrough). Soft-deleted items (`deleted_at IS NOT NULL`) are omitted.
2. **Mutations**: Adding, toggling, and deleting items immediately update SQLite locally and enqueue operation payloads (`insert`, `update`, `delete`) into an outbox table via `enqueueMutation`. Outbox records are synchronized to Supabase in the background.
3. **Shopping Run Completion**: When a user taps "🛒 Einkauf abschließen", `CompleteRunSheet` collects location targets (fridge, freezer, pantry) and expiration dates for all checked items. Submitting the sheet triggers `useCompleteShoppingRun`, which:
   - Inserts items into inventory (`fridge_items`) via the outbox pipeline.
   - Appends records to the append-only `shopping_history` table directly in SQLite.
   - Soft-deletes checked items from `shopping_list_items` via the outbox pipeline.
   - Invalidates React Query caches for lists, inventory, and sync status.

---

## File Directory Summary

| File Path | Description |
| --- | --- |
| [`shopping-list-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/shopping-list-screen.tsx) | Primary UI screen displaying grouped shopping items, add form controls, and complete-run sheet triggers. |
| [`complete-run-sheet.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/complete-run-sheet.tsx) | Bottom sheet modal for assigning inventory storage locations (fridge, freezer, pantry) and expiry dates before completing a shopping run. |
| [`components/add-item-form.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/add-item-form.tsx) | Inline card form component for adding new items (name, quantity, unit) to the shopping list. |
| [`components/shopping-item-row.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/shopping-item-row.tsx) | Interactive row component representing an individual shopping item with toggle checkbox and long-press delete trigger. |
| [`use-shopping-list.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/use-shopping-list.ts) | React Query hooks (`useShoppingList`, `useCheckedShoppingItems`) for querying SQLite and grouping items by category. |
| [`use-shopping-list-mutations.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/use-shopping-list-mutations.ts) | React Query mutation hooks (`useAddShoppingItem`, `useToggleShoppingItem`, `useDeleteShoppingItem`) interfacing with SQLite and outbox. |
| [`use-complete-shopping-run.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/use-complete-shopping-run.ts) | Transactional mutation hook orchestrating batch item transfer to inventory, history log creation, and list item deletion. |

---

## Detailed File Explanations

---

### 1. `shopping-list-screen.tsx`

**File Path**: [`src/features/shopping-list/shopping-list-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/shopping-list-screen.tsx)  
**Total Lines**: 201 lines  
**Role**: Main entry screen component for the shared shopping list.

#### Section-by-Section & Line-by-Line Breakdown

```tsx
1: import { useState } from 'react';
2: import { Alert, Pressable, SectionList, StyleSheet } from 'react-native';
3: 
4: import { Card } from '@/components/card';
5: import { EmptyState } from '@/components/empty-state';
6: import { Screen } from '@/components/screen';
7: import { ThemedText } from '@/components/themed-text';
8: import { Spacing } from '@/constants/theme';
9: import { useActiveHousehold } from '@/features/household/active-household-provider';
10: import { useTheme } from '@/hooks/use-theme';
11: import { getSupabase } from '@/lib/supabase';
12: import { CompleteRunSheet, type TransferItem } from './complete-run-sheet';
13: import { AddItemForm } from './components/add-item-form';
14: import { ShoppingItemRow } from './components/shopping-item-row';
15: import { useCompleteShoppingRun } from './use-complete-shopping-run';
16: import { type LocalShoppingItem, useShoppingList } from './use-shopping-list';
17: import { useDeleteShoppingItem, useToggleShoppingItem } from './use-shopping-list-mutations';
```
- **Lines 1–17**: Import dependencies required for screen state management, native React Native components (`Alert`, `Pressable`, `SectionList`, `StyleSheet`), design system components (`Card`, `EmptyState`, `Screen`, `ThemedText`), theme constants, active household context, Supabase client authentication helper, and feature-specific components/hooks.

```tsx
19: /**
20:  * Gemeinsame Einkaufsliste (#85/#86).
21:  *
22:  * Zeigt Artikel nach Kategorie gruppiert. Antippen = abhaken.
23:  * Lang drücken = loeschen (mit Bestaetigung).
24:  * "Einkauf abschließen" = Transfer-Sheet oeffnen.
25:  */
```
- **Lines 19–25**: JSDoc documentation outlining screen user interactions: category grouping, single tap to toggle check state, long press for deletion prompt, and completing a shopping run via transfer sheet modal.

```tsx
26: export function ShoppingListScreen() {
27:   const [showAddForm, setShowAddForm] = useState(false);
28:   const [sheetOpen, setSheetOpen] = useState(false);
29:   const theme = useTheme();
30: 
31:   const { activeHouseholdId } = useActiveHousehold();
32:   const householdId = activeHouseholdId ?? undefined;
33: 
34:   const { data: groups = [], isLoading } = useShoppingList(householdId);
35: 
36:   const toggleItem = useToggleShoppingItem();
37:   const deleteItem = useDeleteShoppingItem();
38:   const completeRun = useCompleteShoppingRun(householdId);
```
- **Lines 26–29**: Component function declaration and state hooks: `showAddForm` toggles the inline item creation form; `sheetOpen` controls bottom sheet visibility; `theme` provides active palette colors.
- **Lines 31–32**: Obtains `activeHouseholdId` from context. Fallback converts `null` to `undefined` for React Query hook compatibility.
- **Lines 34–38**: Fetches grouped shopping list data via `useShoppingList` and initializes mutation hooks (`toggleItem`, `deleteItem`, `completeRun`).

```tsx
40:   const allItems = groups.flatMap((g) => g.items);
41:   const checkedItems = allItems.filter((i) => i.checked_at !== null);
42:   const hasCheckedItems = checkedItems.length > 0;
```
- **Lines 40–42**: Flattens grouped categories into `allItems`, filters out checked items (`checked_at !== null`), and computes boolean `hasCheckedItems` to conditionally render the "🛒 Einkauf abschließen" completion button.

```tsx
44:   async function handleToggle(item: LocalShoppingItem) {
45:     const {
46:       data: { user },
47:     } = await getSupabase().auth.getUser();
48: 
49:     await toggleItem.mutateAsync({
50:       id: item.id,
51:       household_id: item.household_id,
52:       checked_at: item.checked_at ? null : new Date().toISOString(),
53:       checked_by: item.checked_at ? null : (user?.id ?? null),
54:     });
55:   }
```
- **Lines 44–55**: Handles checking/unchecking items. Queries Supabase for current authenticated user ID, toggles `checked_at` (ISO timestamp if checking, `null` if unchecking), and records `checked_by`.

```tsx
57:   function handleDeletePress(item: LocalShoppingItem) {
58:     Alert.alert('Artikel löschen', `"${item.name}" aus der Liste entfernen?`, [
59:       { text: 'Abbrechen', style: 'cancel' },
60:       {
61:         text: 'Löschen',
62:         style: 'destructive',
63:         onPress: () => deleteItem.mutate({ id: item.id, household_id: item.household_id }),
64:       },
65:     ]);
66:   }
```
- **Lines 57–66**: Displays native confirmation modal before deleting an item. When confirmed, calls `deleteItem.mutate`.

```tsx
68:   async function handleCompleteRun(transfers: TransferItem[]) {
69:     if (!householdId) return;
70:     const {
71:       data: { user },
72:     } = await getSupabase().auth.getUser();
73: 
74:     await completeRun.mutateAsync({
75:       householdId,
76:       userId: user?.id ?? '',
77:       checkedItems,
78:       transfers,
79:     });
80: 
81:     setSheetOpen(false);
82:   }
```
- **Lines 68–82**: Executed when user confirms completion modal. Fetches user ID, executes `completeRun.mutateAsync` passing checked items and transfer destination selections, and closes sheet modal.

```tsx
84:   const sections = groups
85:     .filter((g) => g.items.length > 0)
86:     .map((g) => ({ title: g.category, data: g.items }));
```
- **Lines 84–86**: Prepares data structure required by React Native `SectionList` (`{ title, data }`), filtering out empty categories.

```tsx
88:   if (!householdId) {
89:     return (
90:       <Screen title="Einkauf" subtitle="Gemeinsame Liste">
91:         <Card>
92:           <EmptyState
93:             symbol="cart"
94:             title="Noch kein Haushalt"
95:             hint="Lege im Profil einen Haushalt an oder tritt einem bei."
96:           />
97:         </Card>
98:       </Screen>
99:     );
100:   }
```
- **Lines 88–100**: Early return rendering empty state prompt when user is not linked to an active household.

```tsx
102:   return (
103:     <Screen
104:       title="Einkauf"
105:       subtitle={`Zuletzt · ${allItems.length} Artikel`}
106:       action={
107:         <Pressable
108:           onPress={() => setShowAddForm(!showAddForm)}
109:           accessibilityRole="button"
110:           accessibilityLabel="Artikel hinzufügen"
111:           style={styles.addHeaderButton}>
112:           <ThemedText type="smallBold" themeColor="accent">
113:             + Artikel
114:           </ThemedText>
115:         </Pressable>
116:       }>
```
- **Lines 102–116**: Standard `Screen` layout header displaying total item count and header action button `+ Artikel` to toggle form.

```tsx
117:       {showAddForm ? (
118:         <AddItemForm householdId={householdId} onDismiss={() => setShowAddForm(false)} />
119:       ) : null}
120: 
121:       {isLoading ? null : allItems.length === 0 ? (
122:         <Card>
123:           <EmptyState
124:             symbol="cart"
125:             title="Einkaufsliste ist leer"
126:             hint="Tippe auf '+ Artikel' um zu starten."
127:           />
128:         </Card>
129:       ) : (
130:         <SectionList
131:           sections={sections}
132:           keyExtractor={(item) => item.id}
133:           scrollEnabled={false}
134:           renderSectionHeader={({ section }) => (
135:             <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHeader}>
136:               {section.title}
137:             </ThemedText>
138:           )}
139:           renderItem={({ item }) => (
140:             <ShoppingItemRow
141:               item={item}
142:               onToggle={() => handleToggle(item)}
143:               onDelete={() => handleDeletePress(item)}
144:             />
145:           )}
146:           stickySectionHeadersEnabled={false}
147:         />
148:       )}
```
- **Lines 117–148**: Conditionally renders `AddItemForm`, handles loading state, renders empty list card when no items exist, or renders `SectionList` displaying category section headers and `ShoppingItemRow` items.

```tsx
150:       {hasCheckedItems ? (
151:         <Pressable
152:           onPress={() => setSheetOpen(true)}
153:           accessibilityRole="button"
154:           accessibilityLabel={`Einkauf abschließen, ${checkedItems.length} Artikel abgehakt`}
155:           style={({ pressed }) => [
156:             styles.completeButton,
157:             { backgroundColor: theme.danger, opacity: pressed ? 0.85 : 1 },
158:           ]}>
159:           <ThemedText style={styles.completeButtonText}>
160:             🛒 Einkauf abschließen ({checkedItems.length})
161:           </ThemedText>
162:         </Pressable>
163:       ) : null}
164: 
165:       <CompleteRunSheet
166:         isOpen={sheetOpen}
167:         checkedItems={checkedItems}
168:         onConfirm={handleCompleteRun}
169:         onClose={() => setSheetOpen(false)}
170:       />
171:     </Screen>
172:   );
173: }
```
- **Lines 150–173**: Renders completion button when items are checked, opening `CompleteRunSheet`. Mounts `CompleteRunSheet` modal.

```tsx
175: const styles = StyleSheet.create({
176:   addHeaderButton: {
177:     paddingVertical: Spacing.one,
178:     paddingHorizontal: Spacing.two,
179:   },
180:   sectionHeader: {
181:     paddingHorizontal: Spacing.three,
182:     paddingTop: Spacing.three,
183:     paddingBottom: Spacing.one,
184:     textTransform: 'uppercase',
185:     letterSpacing: 0.5,
186:   },
187:   completeButton: {
188:     borderRadius: Spacing.three,
189:     paddingVertical: Spacing.three,
190:     paddingHorizontal: Spacing.four,
191:     alignItems: 'center',
192:     justifyContent: 'center',
193:     marginTop: Spacing.two,
194:   },
195:   completeButtonText: {
196:     color: '#fff',
197:     fontWeight: '700',
198:     fontSize: 16,
199:   },
200: });
```
- **Lines 175–200**: Stylesheet encapsulating layout spacing, padding, uppercase section headers, and full-width primary action button styling.

---

### 2. `complete-run-sheet.tsx`

**File Path**: [`src/features/shopping-list/complete-run-sheet.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/complete-run-sheet.tsx)  
**Total Lines**: 392 lines  
**Role**: Bottom sheet modal allowing users to categorize purchased items by storage location (`fridge`, `freezer`, `pantry`) and enter best-before/expiry dates before pushing items to inventory.

#### Section-by-Section & Line-by-Line Breakdown

```tsx
1: import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
2: import { useEffect, useRef, useState } from 'react';
3: import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
4: 
5: import { ThemedText } from '@/components/themed-text';
6: import { Spacing } from '@/constants/theme';
7: import { useTheme } from '@/hooks/use-theme';
8: 
9: import type { LocalShoppingItem } from './use-shopping-list';
```
- **Lines 1–9**: Imports native bottom sheet wrapper from `@expo/ui/community/bottom-sheet`, React hooks, React Native UI components, themed components, theme hooks, and item types.

```tsx
11: export type StorageKind = 'fridge' | 'freezer' | 'pantry';
12: 
13: export type TransferItem = {
14:   shoppingItemId: string;
15:   name: string;
16:   quantity: number;
17:   unit: string;
18:   locationKind: StorageKind;
19:   expiryDate: string | null;
20: };
```
- **Lines 11–20**: Defines TypeScript union type `StorageKind` and transfer object format `TransferItem` for transferring items into storage inventory.

```tsx
22: const CATEGORY_TO_KIND: Record<string, StorageKind> = {
23:   'Obst & Gemüse': 'fridge',
24:   Milchprodukte: 'fridge',
25:   'Fleisch & Fisch': 'fridge',
26:   Getränke: 'fridge',
27:   Tiefkühlkost: 'freezer',
28:   Grundnahrungsmittel: 'pantry',
29:   Snacks: 'pantry',
30:   Backwaren: 'pantry',
31:   Haushalt: 'pantry',
32: };
```
- **Lines 22–32**: Lookup table mapping category names (German) to target storage types (`fridge`, `freezer`, or `pantry`).

```tsx
34: const KIND_CONFIG: Record<StorageKind, { label: string; icon: string }> = {
35:   fridge: { label: 'Kühl', icon: '🧊' },
36:   freezer: { label: 'Frost', icon: '❄️' },
37:   pantry: { label: 'Kammer', icon: '🗄' },
38: };
39: 
40: const KINDS: StorageKind[] = ['fridge', 'freezer', 'pantry'];
41: 
42: function defaultKind(item: LocalShoppingItem): StorageKind {
43:   if (item.category && CATEGORY_TO_KIND[item.category]) {
44:     return CATEGORY_TO_KIND[item.category];
45:   }
46:   return 'pantry';
47: }
```
- **Lines 34–40**: Display configuration for storage location radio buttons (label and emoji icon), plus static list of kinds.
- **Lines 42–47**: `defaultKind` helper returning mapped storage kind based on item category, defaulting to `'pantry'`.

```tsx
53: interface TransferRowProps {
54:   item: LocalShoppingItem;
55:   transfer: TransferItem;
56:   onUpdateKind: (kind: StorageKind) => void;
57:   onUpdateExpiry: (expiry: string) => void;
58: }
59: 
60: function TransferRow({ item, transfer, onUpdateKind, onUpdateExpiry }: TransferRowProps) {
61:   const theme = useTheme();
62: 
63:   return (
64:     <View style={[styles.transferRow, { borderBottomColor: theme.border }]}>
65:       {/* Artikel-Header */}
66:       <View style={styles.itemHeader}>
67:         <ThemedText type="smallBold">{item.name}</ThemedText>
68: 
69:         {/* Menge — grüner Pill-Badge wie im Screenshot */}
70:         <View style={[styles.quantityBadge, { backgroundColor: theme.success }]}>
71:           <ThemedText style={styles.quantityBadgeText}>
72:             {item.quantity} {item.unit}
73:           </ThemedText>
74:         </View>
75:       </View>
```
- **Lines 53–75**: `TransferRow` sub-component rendering header row with item name and colored pill badge displaying quantity and unit.

```tsx
77:       {/* Location-Picker + MHD */}
78:       <View style={styles.controls}>
79:         <View style={styles.kindPicker}>
80:           {KINDS.map((kind) => {
81:             const cfg = KIND_CONFIG[kind];
82:             const isActive = transfer.locationKind === kind;
83:             return (
84:               <Pressable
85:                 key={kind}
86:                 onPress={() => onUpdateKind(kind)}
87:                 accessibilityRole="radio"
88:                 accessibilityState={{ selected: isActive }}
89:                 accessibilityLabel={cfg.label}
90:                 style={[
91:                   styles.kindButton,
92:                   {
93:                     borderColor: isActive ? theme.accent : theme.border,
94:                     backgroundColor: isActive ? `${theme.accent}18` : 'transparent',
95:                   },
96:                 ]}>
97:                 <ThemedText style={styles.kindIcon}>{cfg.icon}</ThemedText>
98:                 <ThemedText
99:                   type="small"
100:                   style={{ color: isActive ? theme.accent : theme.textSecondary }}>
101:                   {cfg.label}
102:                 </ThemedText>
103:               </Pressable>
104:             );
105:           })}
106:         </View>
```
- **Lines 77–106**: Storage location selector rendering radio buttons for Kühl (🧊), Frost (❄️), and Kammer (🗄) with active border and highlight styling.

```tsx
108:         {/* MHD */}
109:         <View style={styles.mhdRow}>
110:           <ThemedText type="small" themeColor="textSecondary" style={styles.mhdLabel}>
111:             MHD
112:           </ThemedText>
113:           <TextInput
114:             value={transfer.expiryDate ?? ''}
115:             onChangeText={onUpdateExpiry}
116:             placeholder="TT.MM.JJJJ"
117:             placeholderTextColor={theme.textSecondary}
118:             style={[
119:               styles.mhdInput,
120:               {
121:                 color: theme.text,
122:                 backgroundColor: theme.backgroundElement,
123:                 borderColor: theme.border,
124:               },
125:             ]}
126:           />
127:         </View>
128:       </View>
129:     </View>
130:   );
131: }
```
- **Lines 108–131**: MHD (Mindesthaltbarkeitsdatum / Expiry Date) input field formatted for German date format (`TT.MM.JJJJ`).

```tsx
137: interface Props {
138:   isOpen: boolean;
139:   checkedItems: LocalShoppingItem[];
140:   onConfirm: (transfers: TransferItem[]) => void;
141:   onClose: () => void;
142: }
```
- **Lines 137–142**: Props interface for `CompleteRunSheet`.

```tsx
144: /**
145:  * Bottom-Sheet zum Abschluss eines Einkaufs (#85/#86).
146:  ...
156:  */
157: export function CompleteRunSheet({ isOpen, checkedItems, onConfirm, onClose }: Props) {
158:   const theme = useTheme();
159:   const sheetRef = useRef<BottomSheet>(null);
160: 
161:   const [transfers, setTransfers] = useState<Map<string, TransferItem>>(new Map());
```
- **Lines 144–161**: Main sheet component declaration, initializing sheet ref and local state map tracking transfer configurations indexed by item ID.

```tsx
163:   // Sync transfers wenn checkedItems sich ändern
164:   useEffect(() => {
165:     const map = new Map<string, TransferItem>();
166:     for (const item of checkedItems) {
167:       map.set(item.id, {
168:         shoppingItemId: item.id,
169:         name: item.name,
170:         quantity: item.quantity,
171:         unit: item.unit,
172:         locationKind: defaultKind(item),
173:         expiryDate: null,
174:       });
175:     }
176:     setTransfers(map);
177:   }, [checkedItems]);
178: 
179:   // Sheet öffnen/schließen via ref
180:   useEffect(() => {
181:     if (isOpen) {
182:       sheetRef.current?.expand();
183:     } else {
184:       sheetRef.current?.close();
185:     }
186:   }, [isOpen]);
```
- **Lines 163–177**: `useEffect` populating default `TransferItem` state whenever `checkedItems` change.
- **Lines 180–186**: `useEffect` controlling bottom sheet expansion/collapse based on `isOpen` prop.

```tsx
188:   function updateKind(itemId: string, kind: StorageKind) {
189:     setTransfers((prev) => {
190:       const next = new Map(prev);
191:       const t = next.get(itemId);
192:       if (t) next.set(itemId, { ...t, locationKind: kind });
193:       return next;
194:     });
195:   }
```
- **Lines 188–195**: Updates chosen storage location for a specific item ID in state map.

```tsx
197:   function updateExpiry(itemId: string, expiry: string) {
198:     // TT.MM.JJJJ → ISO-Datum konvertieren
199:     const parts = expiry.split('.');
200:     let isoDate: string | null = null;
201:     if (parts.length === 3 && parts[2].length === 4) {
202:       isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
203:     }
204: 
205:     setTransfers((prev) => {
206:       const next = new Map(prev);
207:       const t = next.get(itemId);
208:       if (t) next.set(itemId, { ...t, expiryDate: isoDate });
209:       return next;
210:     });
211:   }
```
- **Lines 197–211**: Parses date string (`TT.MM.JJJJ`) into ISO formatted date string (`YYYY-MM-DD`) and stores result in transfer state map.

```tsx
213:   function handleConfirm() {
214:     onConfirm(Array.from(transfers.values()));
215:   }
216: 
217:   const count = checkedItems.length;
```
- **Lines 213–217**: Converts map values into array and passes to `onConfirm` callback. Computes total count.

```tsx
219:   return (
220:     <BottomSheet
221:       ref={sheetRef}
222:       snapPoints={['60%', '90%']}
223:       enablePanDownToClose
224:       onClose={onClose}
225:       backgroundStyle={{ backgroundColor: theme.background }}
226:       handleIndicatorStyle={{ backgroundColor: theme.border }}>
227:       <BottomSheetView style={styles.sheetContent}>
228:         {/* Header */}
229:         <View style={styles.sheetHeader}>
230:           <View>
231:             <ThemedText type="title">In Vorrat übernehmen</ThemedText>
232:             <ThemedText type="small" themeColor="textSecondary">
233:               {count} {count === 1 ? 'Artikel' : 'Artikel'} abgehakt
234:             </ThemedText>
235:           </View>
236:           <Pressable
237:             onPress={onClose}
238:             accessibilityRole="button"
239:             accessibilityLabel="Schließen"
240:             style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
241:             <ThemedText>✕</ThemedText>
242:           </Pressable>
243:         </View>
```
- **Lines 219–243**: Renders `BottomSheet` modal with 60% / 90% snap points, pan-to-close behavior, header title, checked count, and close button.

```tsx
245:         {/* Artikel-Liste */}
246:         <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
247:           {checkedItems.map((item) => {
248:             const transfer = transfers.get(item.id);
249:             if (!transfer) return null;
250:             return (
251:               <TransferRow
252:                 key={item.id}
253:                 item={item}
254:                 transfer={transfer}
255:                 onUpdateKind={(kind) => updateKind(item.id, kind)}
256:                 onUpdateExpiry={(expiry) => updateExpiry(item.id, expiry)}
257:               />
258:             );
259:           })}
260:         </ScrollView>
```
- **Lines 245–260**: Scrollable list rendering `TransferRow` items for every checked shopping list item.

```tsx
262:         {/* Confirm-Button — volle Breite, grün, wie im Screenshot */}
263:         <View style={styles.actions}>
264:           <Pressable
265:             onPress={handleConfirm}
266:             disabled={count === 0}
267:             accessibilityRole="button"
268:             accessibilityLabel={`${count} Artikel in Vorrat übernehmen`}
269:             style={[
270:               styles.confirmButton,
271:               { backgroundColor: theme.success, opacity: count === 0 ? 0.5 : 1 },
272:             ]}>
273:             <ThemedText style={styles.confirmButtonText}>
274:               ✓ {count} {count === 1 ? 'Artikel' : 'Artikel'} in Vorrat übernehmen
275:             </ThemedText>
276:           </Pressable>
277: 
278:           <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancelLink}>
279:             <ThemedText type="small" themeColor="textSecondary">
280:               Abbrechen
281:             </ThemedText>
282:           </Pressable>
283:         </View>
284:       </BottomSheetView>
285:     </BottomSheet>
286:   );
287: }
```
- **Lines 262–287**: Footer section rendering primary confirm button (`✓ N Artikel in Vorrat übernehmen`) with success theme background color and secondary cancel text link.

```tsx
289: const styles = StyleSheet.create({
290:   sheetContent: { flex: 1 },
...
391: });
```
- **Lines 289–391**: Comprehensive stylesheet for bottom sheet container, headers, control buttons, inputs, badge tags, and footer action buttons.

---

### 3. `components/add-item-form.tsx`

**File Path**: [`src/features/shopping-list/components/add-item-form.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/add-item-form.tsx)  
**Total Lines**: 87 lines  
**Role**: Form card allowing users to input name, quantity, and unit to add a new shopping item.

#### Section-by-Section & Line-by-Line Breakdown

```tsx
1: import { useState } from 'react';
2: import { StyleSheet, View } from 'react-native';
3: 
4: import { Button } from '@/components/button';
5: import { Card } from '@/components/card';
6: import { TextField } from '@/components/text-field';
7: import { Spacing } from '@/constants/theme';
8: import { useAddShoppingItem } from '../use-shopping-list-mutations';
```
- **Lines 1–8**: Imports React `useState`, React Native `StyleSheet` and `View`, UI components (`Button`, `Card`, `TextField`), theme constants, and mutation hook `useAddShoppingItem`.

```tsx
10: interface AddItemFormProps {
11:   householdId: string;
12:   onDismiss: () => void;
13: }
14: 
15: export function AddItemForm({ householdId, onDismiss }: AddItemFormProps) {
16:   const [name, setName] = useState('');
17:   const [quantity, setQuantity] = useState('1');
18:   const [unit, setUnit] = useState('piece');
19:   const [nameError, setNameError] = useState<string | null>(null);
20: 
21:   const addItem = useAddShoppingItem();
```
- **Lines 10–21**: Defines `AddItemFormProps` interface, initializes local state fields (`name`, `quantity` default '1', `unit` default 'piece', `nameError`), and instantiates `useAddShoppingItem` mutation hook.

```tsx
23:   async function handleAdd() {
24:     const trimmed = name.trim();
25:     if (!trimmed) {
26:       setNameError('Bitte einen Namen eingeben.');
27:       return;
28:     }
29:     setNameError(null);
30: 
31:     await addItem.mutateAsync({
32:       household_id: householdId,
33:       name: trimmed,
34:       quantity: Number(quantity) || 1,
35:       unit,
36:     });
37: 
38:     setName('');
39:     setQuantity('1');
40:     onDismiss();
41:   }
```
- **Lines 23–41**: `handleAdd` handler validates that name is non-empty, triggers `addItem.mutateAsync` with input fields, resets state, and calls `onDismiss()` to close form.

```tsx
43:   return (
44:     <Card title="Artikel hinzufügen">
45:       <TextField
46:         label="Name"
47:         value={name}
48:         onChangeText={setName}
49:         placeholder="z. B. Milch"
50:         autoFocus
51:         error={nameError ?? undefined}
52:       />
53:       <View style={styles.row}>
54:         <View style={{ flex: 1 }}>
55:           <TextField
56:             label="Menge"
57:             value={quantity}
58:             onChangeText={setQuantity}
59:             keyboardType="decimal-pad"
60:             placeholder="1"
61:           />
62:         </View>
63:         <View style={{ flex: 1 }}>
64:           <TextField
65:             label="Einheit"
66:             value={unit}
67:             onChangeText={setUnit}
68:             placeholder="piece"
69:             autoCapitalize="none"
70:           />
71:         </View>
72:       </View>
73:       <View style={styles.row}>
74:         <Button label="Abbrechen" variant="secondary" onPress={onDismiss} />
75:         <Button label="Hinzufügen" onPress={handleAdd} loading={addItem.isPending} />
76:       </View>
77:     </Card>
78:   );
79: }
```
- **Lines 43–79**: Form card rendering `TextField` for item name (with `autoFocus`), dual numeric input fields for quantity (decimal pad) and unit, and action buttons for "Abbrechen" (Cancel) and "Hinzufügen" (Add with loading state).

```tsx
81: const styles = StyleSheet.create({
82:   row: {
83:     flexDirection: 'row',
84:     gap: Spacing.two,
85:   },
86: });
```
- **Lines 81–86**: Flexbox row styling with spacing gap for side-by-side inputs and buttons.

---

### 4. `components/shopping-item-row.tsx`

**File Path**: [`src/features/shopping-list/components/shopping-item-row.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/shopping-item-row.tsx)  
**Total Lines**: 78 lines  
**Role**: Individual item row component displaying item status, checkbox indicator, name, and quantity.

#### Section-by-Section & Line-by-Line Breakdown

```tsx
1: import { Pressable, StyleSheet, View } from 'react-native';
2: 
3: import { ThemedText } from '@/components/themed-text';
4: import { Spacing } from '@/constants/theme';
5: import { useTheme } from '@/hooks/use-theme';
6: 
7: import type { LocalShoppingItem } from '../use-shopping-list';
```
- **Lines 1–7**: Imports React Native components, `ThemedText`, spacing constants, theme hook, and `LocalShoppingItem` type definition.

```tsx
9: interface ShoppingItemRowProps {
10:   item: LocalShoppingItem;
11:   onToggle: () => void;
12:   onDelete: () => void;
13: }
14: 
15: export function ShoppingItemRow({ item, onToggle, onDelete }: ShoppingItemRowProps) {
16:   const theme = useTheme();
17:   const isChecked = item.checked_at !== null;
```
- **Lines 9–17**: Props interface declaration and component initialization. Calculates boolean `isChecked` derived from `checked_at !== null`.

```tsx
19:   return (
20:     <Pressable
21:       onPress={onToggle}
22:       onLongPress={onDelete}
23:       accessibilityRole="checkbox"
24:       accessibilityState={{ checked: isChecked }}
25:       accessibilityLabel={item.name}
26:       accessibilityHint="Antippen zum Abhaken, lang drücken zum Löschen"
27:       style={[styles.itemRow, { borderBottomColor: theme.border }]}>
28:       {/* Checkbox */}
29:       <View
30:         style={[
31:           styles.checkbox,
32:           {
33:             borderColor: isChecked ? theme.accent : theme.border,
34:             backgroundColor: isChecked ? theme.accent : 'transparent',
35:           },
36:         ]}>
37:         {isChecked ? <ThemedText style={{ color: '#fff', fontSize: 12 }}>✓</ThemedText> : null}
38:       </View>
```
- **Lines 19–38**: Accessible `Pressable` container with single tap (`onToggle`) and long press (`onDelete`). Renders custom circular checkmark badge (`✓` when checked, filled with accent color).

```tsx
40:       <View style={styles.itemContent}>
41:         <ThemedText
42:           type="small"
43:           style={isChecked ? { textDecorationLine: 'line-through', opacity: 0.5 } : undefined}>
44:           {item.name}
45:         </ThemedText>
46:         <ThemedText type="small" themeColor="textSecondary">
47:           {item.quantity} {item.unit}
48:         </ThemedText>
49:       </View>
50:     </Pressable>
51:   );
52: }
```
- **Lines 40–52**: Renders item name with conditional strikethrough decoration (`line-through`) and dimmed opacity when checked, along with quantity and unit text.

```tsx
54: const styles = StyleSheet.create({
55:   itemRow: {
56:     flexDirection: 'row',
57:     alignItems: 'center',
58:     paddingHorizontal: Spacing.three,
59:     paddingVertical: Spacing.two + 2,
60:     borderBottomWidth: StyleSheet.hairlineWidth,
61:     gap: Spacing.two,
62:   },
63:   checkbox: {
64:     width: 22,
65:     height: 22,
66:     borderRadius: 11,
67:     borderWidth: 2,
68:     alignItems: 'center',
69:     justifyContent: 'center',
70:   },
71:   itemContent: {
72:     flex: 1,
73:     flexDirection: 'row',
74:     justifyContent: 'space-between',
75:     alignItems: 'center',
76:   },
77: });
```
- **Lines 54–77**: Layout styles for item row formatting, circular checkbox dimensions (`borderRadius: 11`), and text distribution.

---

### 5. `use-shopping-list.ts`

**File Path**: [`src/features/shopping-list/use-shopping-list.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/use-shopping-list.ts)  
**Total Lines**: 93 lines  
**Role**: Data hooks for retrieving shopping list items from the local SQLite database via React Query.

#### Section-by-Section & Line-by-Line Breakdown

```tsx
1: import { useQuery } from '@tanstack/react-query';
2: 
3: import { getDatabase } from '@/lib/db/client';
4: 
5: export type LocalShoppingItem = {
6:   id: string;
7:   household_id: string;
8:   product_id: string | null;
9:   name: string;
10:   quantity: number;
11:   unit: string;
12:   category: string | null;
13:   checked_at: string | null;
14:   checked_by: string | null;
15:   sort_index: number;
16:   created_at: string;
17:   updated_at: string;
18: };
19: 
20: export type GroupedShoppingItems = {
21:   category: string;
22:   items: LocalShoppingItem[];
23: };
24: 
25: const DEFAULT_CATEGORY = 'Sonstiges';
```
- **Lines 1–25**: Imports `useQuery` and SQLite database client. Exported type definitions matching SQLite `shopping_list_items` schema (`LocalShoppingItem`, `GroupedShoppingItems`). Sets fallback category string `'Sonstiges'`.

```tsx
27: /**
28:  * Liest alle aktiven Einkaufslisten-Artikel fuer den Haushalt aus SQLite (#85).
29:  *
30:  * Artikel mit `deleted_at` werden herausgefiltert — Soft-Deletes erscheinen
31:  * nicht in der UI. Gecheckte Artikel (`checked_at IS NOT NULL`) werden ans
32:  * Ende der Kategorie-Gruppe sortiert, bleiben aber sichtbar (ausgegraut),
33:  * damit der Nutzer sieht was er bereits eingepackt hat.
34:  */
35: export function useShoppingList(householdId: string | undefined) {
36:   return useQuery({
37:     queryKey: ['shopping_list_items', householdId],
38:     queryFn: async (): Promise<GroupedShoppingItems[]> => {
39:       if (!householdId) return [];
40: 
41:       const db = await getDatabase();
42:       const items = await db.getAllAsync<LocalShoppingItem>(
43:         `select id, household_id, product_id, name, quantity, unit, category,
44:                 checked_at, checked_by, sort_index, created_at, updated_at
45:          from shopping_list_items
46:          where household_id = ? and deleted_at is null
47:          order by
48:            case when checked_at is null then 0 else 1 end asc,
49:            sort_index asc,
50:            name asc`,
51:         [householdId],
52:       );
```
- **Lines 27–52**: `useShoppingList` hook. Queries SQLite for active items (`deleted_at IS NULL`). SQL ordering puts unchecked items first (`case when checked_at is null then 0 else 1 end asc`), followed by `sort_index asc`, then `name asc`.

```tsx
54:       // Groupierung nach Kategorie — Reihenfolge der Gruppen ist Insertion-Order
55:       const groupMap = new Map<string, LocalShoppingItem[]>();
56:       for (const item of items) {
57:         const cat = item.category ?? DEFAULT_CATEGORY;
58:         if (!groupMap.has(cat)) {
59:           groupMap.set(cat, []);
60:         }
61:         groupMap.get(cat)?.push(item);
62:       }
63: 
64:       return Array.from(groupMap.entries()).map(([category, groupItems]) => ({
65:         category,
66:         items: groupItems,
67:       }));
68:     },
69:     enabled: !!householdId,
70:   });
71: }
```
- **Lines 54–71**: Grouping algorithm using JavaScript `Map` to group items by `category` (defaulting to `'Sonstiges'`), returning array of category group objects. Query is enabled only when `householdId` is defined.

```tsx
73: /** Alle gecheckte Artikel (fuer den Transfer-Sheet). */
74: export function useCheckedShoppingItems(householdId: string | undefined) {
75:   return useQuery({
76:     queryKey: ['shopping_list_items', householdId, 'checked'],
77:     queryFn: async (): Promise<LocalShoppingItem[]> => {
78:       if (!householdId) return [];
79: 
80:       const db = await getDatabase();
81:       return db.getAllAsync<LocalShoppingItem>(
82:         `select id, household_id, product_id, name, quantity, unit, category,
83:                 checked_at, checked_by, sort_index, created_at, updated_at
84:          from shopping_list_items
85:          where household_id = ? and deleted_at is null and checked_at is not null
86:          order by name asc`,
87:         [householdId],
88:       );
89:     },
90:     enabled: !!householdId,
91:   });
92: }
```
- **Lines 73–93**: `useCheckedShoppingItems` hook fetching only checked active items (`checked_at IS NOT NULL AND deleted_at IS NULL`) ordered by name, used for transfer operations.

---

### 6. `use-shopping-list-mutations.ts`

**File Path**: [`src/features/shopping-list/use-shopping-list-mutations.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/use-shopping-list-mutations.ts)  
**Total Lines**: 179 lines  
**Role**: Offline-first mutation hooks (`useAddShoppingItem`, `useToggleShoppingItem`, `useDeleteShoppingItem`) updating SQLite directly and writing mutation events to outbox.

#### Section-by-Section & Line-by-Line Breakdown

```tsx
1: import { useMutation, useQueryClient } from '@tanstack/react-query';
2: import * as Crypto from 'expo-crypto';
3: import { getDatabase } from '@/lib/db/client';
4: import { enqueueMutation } from '@/lib/db/outbox';
5: import { normalizeUnit } from '@/lib/units';
6: 
7: type AddItemInput = {
8:   household_id: string;
9:   name: string;
10:   quantity: number;
11:   unit: string;
12:   category?: string | null;
13:   product_id?: string | null;
14:   sort_index?: number;
15: };
16: 
17: type ToggleItemInput = {
18:   id: string;
19:   household_id: string;
20:   /** `null` → unchecken, Timestamp-String → checken */
21:   checked_at: string | null;
22:   checked_by: string | null;
23: };
24: 
25: type DeleteItemInput = {
26:   id: string;
27:   household_id: string;
28: };
```
- **Lines 1–28**: Imports dependencies (`useMutation`, `useQueryClient`, `expo-crypto` for local UUID generation, database client, outbox helper, unit normalizer) and inputs type definitions (`AddItemInput`, `ToggleItemInput`, `DeleteItemInput`).

```tsx
30: /**
31:  * Fuegt einen neuen Artikel zur Einkaufsliste hinzu (#86).
...
35:  */
36: export function useAddShoppingItem() {
37:   const queryClient = useQueryClient();
38: 
39:   return useMutation({
40:     mutationFn: async (input: AddItemInput) => {
41:       const db = await getDatabase();
42:       const id = Crypto.randomUUID();
43:       const now = new Date().toISOString();
44:       const nowMs = Date.now();
45:       const normUnit = normalizeUnit(input.unit);
46: 
47:       // sort_index: am Ende einfuegen
48:       const lastRow = await db.getFirstAsync<{ sort_index: number }>(
49:         'select sort_index from shopping_list_items where household_id = ? and deleted_at is null order by sort_index desc limit 1',
50:         [input.household_id],
51:       );
52:       const sortIndex = input.sort_index ?? (lastRow?.sort_index ?? -1) + 1;
```
- **Lines 30–52**: `useAddShoppingItem` mutation function. Generates client UUID, normalizes item unit, queries highest existing `sort_index` in household list, and increments by 1 to append to end.

```tsx
54:       await enqueueMutation(db, {
55:         entity: 'shopping_list_items',
56:         entityId: id,
57:         op: 'insert',
58:         payload: {
59:           id,
60:           household_id: input.household_id,
61:           product_id: input.product_id ?? null,
62:           name: input.name,
63:           quantity: input.quantity,
64:           unit: normUnit,
65:           category: input.category ?? null,
66:           sort_index: sortIndex,
67:           created_at: now,
68:           updated_at: now,
69:         },
70:         applyLocally: async (txn) => {
71:           await txn.runAsync(
72:             `insert into shopping_list_items
73:                (id, household_id, product_id, name, quantity, unit, category, sort_index, created_at, updated_at, _dirty)
74:              values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
75:             [
76:               id,
77:               input.household_id,
78:               input.product_id ?? null,
79:               input.name,
80:               input.quantity,
81:               normUnit,
82:               input.category ?? null,
83:               sortIndex,
84:               now,
85:               nowMs,
86:             ],
87:           );
88:         },
89:       });
90: 
91:       return id;
92:     },
93:     onSuccess: (_, variables) => {
94:       queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
95:       queryClient.invalidateQueries({ queryKey: ['sync-status'] });
96:     },
97:   });
98: }
```
- **Lines 54–98**: Enqueues `insert` operation into outbox queue and executes local SQLite insert setting `_dirty = 1`. Invalidation clears React Query cache for items and sync status.

```tsx
100: /**
101:  * Checkt / uncheckt einen Artikel (#86).
102:  ...
105:  */
106: export function useToggleShoppingItem() {
107:   const queryClient = useQueryClient();
108: 
109:   return useMutation({
110:     mutationFn: async (input: ToggleItemInput) => {
111:       const db = await getDatabase();
112:       const now = new Date().toISOString();
113:       const nowMs = Date.now();
114: 
115:       await enqueueMutation(db, {
116:         entity: 'shopping_list_items',
117:         entityId: input.id,
118:         op: 'update',
119:         payload: {
120:           id: input.id,
121:           household_id: input.household_id,
122:           checked_at: input.checked_at,
123:           checked_by: input.checked_by,
124:           updated_at: now,
125:         },
126:         applyLocally: async (txn) => {
127:           await txn.runAsync(
128:             'update shopping_list_items set checked_at = ?, checked_by = ?, updated_at = ?, _dirty = 1 where id = ?',
129:             [input.checked_at, input.checked_by, nowMs, input.id],
130:           );
131:         },
132:       });
133:     },
134:     onSuccess: (_, variables) => {
135:       queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
136:     },
137:   });
138: }
```
- **Lines 100–138**: `useToggleShoppingItem` hook enqueuing `update` mutation to update `checked_at` and `checked_by` fields locally in SQLite and queueing payload for remote sync.

```tsx
140: /**
141:  * Soft-deletes einen Einkaufslisten-Artikel (#86).
142:  ...
145:  */
146: export function useDeleteShoppingItem() {
147:   const queryClient = useQueryClient();
148: 
149:   return useMutation({
150:     mutationFn: async (input: DeleteItemInput) => {
151:       const db = await getDatabase();
152:       const now = new Date().toISOString();
153:       const nowMs = Date.now();
154: 
155:       await enqueueMutation(db, {
156:         entity: 'shopping_list_items',
157:         entityId: input.id,
158:         op: 'delete',
159:         payload: {
160:           id: input.id,
161:           household_id: input.household_id,
162:           deleted_at: now,
163:           updated_at: now,
164:         },
165:         applyLocally: async (txn) => {
166:           await txn.runAsync(
167:             'update shopping_list_items set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
168:             [nowMs, nowMs, input.id],
169:           );
170:         },
171:       });
172:     },
173:     onSuccess: (_, variables) => {
174:       queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.household_id] });
175:       queryClient.invalidateQueries({ queryKey: ['sync-status'] });
176:     },
177:   });
178: }
```
- **Lines 140–178**: `useDeleteShoppingItem` soft-delete mutation setting `deleted_at` timestamp in SQLite local database and enqueuing outbox tombstone payload.

---

### 7. `use-complete-shopping-run.ts`

**File Path**: [`src/features/shopping-list/use-complete-shopping-run.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/use-complete-shopping-run.ts)  
**Total Lines**: 147 lines  
**Role**: Complex multi-table transaction hook completing a shopping trip by transferring checked items into inventory (`fridge_items`), logging history (`shopping_history`), and soft-deleting items from the active list.

#### Section-by-Section & Line-by-Line Breakdown

```tsx
1: import { useMutation, useQueryClient } from '@tanstack/react-query';
2: import * as Crypto from 'expo-crypto';
3: 
4: import { useStorageLocations } from '@/features/inventory/use-storage-locations';
5: import { getDatabase } from '@/lib/db/client';
6: import { enqueueMutation } from '@/lib/db/outbox';
7: import { normalizeUnit } from '@/lib/units';
8: 
9: import type { TransferItem } from './complete-run-sheet';
10: import type { LocalShoppingItem } from './use-shopping-list';
11: 
12: type CompleteShoppingRunInput = {
13:   householdId: string;
14:   userId: string;
15:   checkedItems: LocalShoppingItem[];
16:   transfers: TransferItem[];
17: };
```
- **Lines 1–17**: Imports dependencies (React Query, Expo Crypto, storage locations hook, SQLite database client, outbox helper, unit normalizer) and defines parameter interface `CompleteShoppingRunInput`.

```tsx
19: /**
20:  * Schliesst den Einkauf ab (#85/#86):
21:  *
22:  * 1. Fuer jeden Transfer-Eintrag: neues `fridge_items`-Insert via Outbox
23:  * 2a. History-Eintrag in `shopping_history` (direkter SQLite-Insert, append-only)
24:  * 2b. Abgehakte Shopping-Items soft-deleten (aus der Liste entfernen via Outbox)
25:  *
26:  * Danach werden beide Caches invalidiert, sodass Einkaufsliste und
27:  * Vorrat-Screen sofort den neuen Zustand zeigen.
28:  */
```
- **Lines 19–28**: Detailed JSDoc outlining the multi-step batch execution flow.

```tsx
29: export function useCompleteShoppingRun(householdId: string | undefined) {
30:   const queryClient = useQueryClient();
31:   const { data: storageLocations } = useStorageLocations(householdId);
32: 
33:   return useMutation({
34:     mutationFn: async (input: CompleteShoppingRunInput) => {
35:       const db = await getDatabase();
36:       const now = new Date().toISOString();
37:       const nowMs = Date.now();
38: 
39:       // Lagerort-ID per kind nachschlagen
40:       function getLocationId(kind: string): string | null {
41:         const loc = storageLocations?.find((l) => l.kind === kind);
42:         return loc?.id ?? null;
43:       }
```
- **Lines 29–43**: Initializing hook and internal lookup function `getLocationId` matching requested `kind` (`fridge`, `freezer`, `pantry`) against user's configured `storageLocations`.

```tsx
45:       // Schritt 1: fridge_items inserten
46:       for (const transfer of input.transfers) {
47:         const id = Crypto.randomUUID();
48:         const locationId = getLocationId(transfer.locationKind);
49:         const normUnit = normalizeUnit(transfer.unit);
50: 
51:         await enqueueMutation(db, {
52:           entity: 'fridge_items',
53:           entityId: id,
54:           op: 'insert',
55:           payload: {
56:             id,
57:             household_id: input.householdId,
58:             location_id: locationId,
59:             name: transfer.name,
60:             quantity: transfer.quantity,
61:             unit: normUnit,
62:             expiry_date: transfer.expiryDate ?? null,
63:             added_by: input.userId,
64:             created_at: now,
65:             updated_at: now,
66:           },
67:           applyLocally: async (txn) => {
68:             await txn.runAsync(
69:               `insert into fridge_items
70:                  (id, household_id, location_id, name, quantity, unit, expiry_date, added_by, created_at, updated_at, _dirty)
71:                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
72:               [
73:                 id,
74:                 input.householdId,
75:                 locationId,
76:                 transfer.name,
77:                 transfer.quantity,
78:                 normUnit,
79:                 transfer.expiryDate ?? null,
80:                 input.userId,
81:                 now,
82:                 nowMs,
83:               ],
84:             );
85:           },
86:         });
87:       }
```
- **Lines 45–87**: **Step 1: Inventory Creation**. Iterates through `input.transfers`, creates `fridge_items` records with unique UUIDs, enqueues `insert` outbox mutation payloads for server sync, and inserts items directly into local SQLite `fridge_items` table.

```tsx
89:       // Schritt 2a: History-Eintrag anlegen (direkt via SQLite db.runAsync, da append-only und ohne Offline-Konflikte)
90:       for (const item of input.checkedItems) {
91:         const historyId = Crypto.randomUUID();
92:         const transfer = input.transfers.find((t) => t.shoppingItemId === item.id);
93: 
94:         await db.runAsync(
95:           `insert into shopping_history
96:              (id, household_id, completed_by, completed_at, item_name, quantity, unit, category, product_id, location_kind, expiry_date, created_at)
97:            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
98:           [
99:             historyId,
100:             input.householdId,
101:             input.userId || null,
102:             now,
103:             item.name,
104:             item.quantity,
105:             normalizeUnit(item.unit),
106:             item.category ?? null,
107:             item.product_id ?? null,
108:             transfer?.locationKind ?? null,
109:             transfer?.expiryDate ?? null,
110:             now,
111:           ],
112:         );
113:       }
```
- **Lines 89–113**: **Step 2a: Append-Only History Logging**. Iterates through `input.checkedItems` and writes entries into `shopping_history` using `db.runAsync`. History records do not require conflict resolution since they are append-only.

```tsx
115:       // Schritt 2b: Abgehakte Shopping-Items soft-deleten (aus der Liste entfernen)
116:       for (const item of input.checkedItems) {
117:         await enqueueMutation(db, {
118:           entity: 'shopping_list_items',
119:           entityId: item.id,
120:           op: 'delete',
121:           payload: {
122:             id: item.id,
123:             household_id: input.householdId,
124:             checked_at: now,
125:             checked_by: input.userId,
126:             deleted_at: now,
127:             updated_at: now,
128:           },
129:           applyLocally: async (txn) => {
130:             await txn.runAsync(
131:               'update shopping_list_items set checked_at = ?, checked_by = ?, deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
132:               [now, input.userId, nowMs, nowMs, item.id],
133:             );
134:           },
135:         });
136:       }
137:     },
```
- **Lines 115–137**: **Step 2b: List Soft-Delete**. Enqueues `delete` operation mutation for every checked shopping list item, updating local SQLite `shopping_list_items` to set `deleted_at`, `checked_at`, and `checked_by`.

```tsx
139:     onSuccess: (_, variables) => {
140:       queryClient.invalidateQueries({ queryKey: ['shopping_list_items', variables.householdId] });
141:       queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.householdId] });
142:       queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', variables.householdId] });
143:       queryClient.invalidateQueries({ queryKey: ['sync-status'] });
144:     },
145:   });
146: }
```
- **Lines 139–146**: Invalidates React Query caches across `shopping_list_items`, `fridge_items`, `fridge_items_grouped`, and `sync-status` so that UI reflects updated state immediately across screens.
