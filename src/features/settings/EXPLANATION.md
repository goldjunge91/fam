# Settings Feature Documentation

This document provides a line-by-line and section-by-section technical explanation of all non-test source files in the `/Users/marco/Github.tmp/family_app/fam/src/features/settings` feature directory.

---

## Table of Contents

1. [`edit-profile-screen.tsx`](#edit-profile-screentsx)
2. [`notification-settings-card.tsx`](#notification-settings-cardtsx)
3. [`settings-screen.tsx`](#settings-screentsx)
4. [`sync-debug-screen.tsx`](#sync-debug-screentsx)

---

## `edit-profile-screen.tsx`

**File Path:** [`fam/src/features/settings/edit-profile-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/edit-profile-screen.tsx)

This file implements the user profile editing screen (`EditProfileScreen`). It allows users to update personal parameters such as display name, birth date, body height, biological sex, and daily physical activity level. These parameters serve as the basis for nutrition calculations (e.g., daily calorie intake targets).

### Line-by-Line / Section Breakdown

#### Imports (Lines 1–16)
```tsx
1: import { useQueryClient } from '@tanstack/react-query';
2: import { router } from 'expo-router';
3: import { useEffect, useState } from 'react';
4: import { Alert, Pressable, StyleSheet, View } from 'react-native';
5: 
6: import { Button } from '@/components/ui/buttons';
7: import { Card } from '@/components/card';
8: import { Screen } from '@/components/screen';
9: import { TextField } from '@/components/text-field';
10: import { ThemedText } from '@/components/themed-text';
11: import { Spacing } from '@/constants/theme';
12: import { updateProfile, useProfile } from '@/features/auth/api';
13: import { fieldErrors, getDeviceDateFormat, profileSchema } from '@/features/auth/auth-schemas';
14: import { useSession } from '@/features/auth/session-provider';
15: import type { ActivityLevel } from '@/features/onboarding/types';
16: import { useTheme } from '@/hooks/use-theme';
```
- **Lines 1–4:** Imports React state/effect hooks, React Native UI components, `@tanstack/react-query` query client hook for cache invalidation, and `expo-router` for screen navigation.
- **Lines 6–10:** Imports modular design system UI components (`Button`, `Card`, `Screen`, `TextField`, `ThemedText`).
- **Lines 11–16:** Imports theme constants (`Spacing`), authentication API helpers (`updateProfile`, `useProfile`), validation utilities (`fieldErrors`, `profileSchema`, `getDeviceDateFormat`), user session state hook (`useSession`), TypeScript types (`ActivityLevel`), and dynamic color scheme hook (`useTheme`).

#### Constants (Lines 18–29)
```tsx
18: const ACTIVITY_LEVELS = [
19:   { value: 'sedentary', label: 'Kaum Bewegung' },
20:   { value: 'light', label: 'Leicht aktiv' },
21:   { value: 'moderate', label: 'Mäßig aktiv' },
22:   { value: 'active', label: 'Aktiv' },
23:   { value: 'very_active', label: 'Sehr aktiv' },
24: ] as const;
25: 
26: const SEX_OPTIONS = [
27:   { value: 'male', label: 'Männlich' },
28:   { value: 'female', label: 'Weiblich' },
29: ] as const;
```
- **Lines 18–24 (`ACTIVITY_LEVELS`):** Defines the list of physical activity levels supported by the app's BMR/TDEE calculation algorithms, mapped to German user-facing labels. `as const` ensures strict literal type checking.
- **Lines 26–29 (`SEX_OPTIONS`):** Defines biological sex options ('male' / 'female') used for basal metabolic rate (BMR) formulas.

#### `ChoiceRow` Helper Component (Lines 31–67)
```tsx
31: function ChoiceRow<T extends string>({
32:   options,
33:   value,
34:   onChange,
35: }: {
36:   options: readonly { value: T; label: string }[];
37:   value: T | undefined;
38:   onChange: (value: T | undefined) => void;
39: }) {
40:   const theme = useTheme();
41: 
42:   return (
43:     <View style={styles.choices}>
44:       {options.map((option) => {
45:         const selected = value === option.value;
46:         return (
47:           <Pressable
48:             key={option.value}
49:             onPress={() => onChange(selected ? undefined : option.value)}
50:             accessibilityRole="radio"
51:             accessibilityState={{ selected }}
52:             style={[
53:               styles.choice,
54:               {
55:                 backgroundColor: selected ? theme.accent : theme.backgroundElement,
56:                 borderColor: selected ? theme.accent : theme.border,
57:               },
58:             ]}>
59:             <ThemedText type="small" style={selected ? styles.choiceSelected : undefined}>
60:               {option.label}
61:             </ThemedText>
62:           </Pressable>
63:         );
64:       })}
65:     </View>
66:   );
67: }
```
- **Lines 31–39:** Defines a reusable, generic single-select option bar (`ChoiceRow`). The generic `<T extends string>` provides strong typing for option values.
- **Line 40:** Obtains theme colors dynamically using `useTheme()`.
- **Lines 43–65:** Maps over `options` rendering interactive radio-style buttons (`Pressable`).
- **Line 49:** Toggles value on tap: selecting an unselected option sets it; tapping an already selected option clears it (`undefined`).
- **Lines 50–51:** Adds screen reader accessibility semantics (`accessibilityRole="radio"` and `accessibilityState={{ selected }}`).
- **Lines 52–61:** Styles the item depending on `selected` state (accent background and border for selected; standard element background and border when unselected).

#### `EditProfileScreen` Component (Lines 69–190)
```tsx
69: export function EditProfileScreen() {
70:   const { session } = useSession();
71:   const userId = session?.user.id;
72:   const { data: profile, isLoading: profileLoading } = useProfile(userId);
73:   const queryClient = useQueryClient();
```
- **Lines 70–73:** Fetches session state to retrieve the logged-in user's ID (`userId`), queries the existing profile database record via `useProfile(userId)`, and gets the React Query `queryClient` instance.

```tsx
75:   const [displayName, setDisplayName] = useState('');
76:   const [birthDate, setBirthDate] = useState('');
77:   const [heightCm, setHeightCm] = useState('');
78:   const [sex, setSex] = useState<'male' | 'female' | undefined>();
79:   const [activityLevel, setActivityLevel] = useState<
80:     (typeof ACTIVITY_LEVELS)[number]['value'] | undefined
81:   >();
82: 
83:   const [errors, setErrors] = useState<Record<string, string>>({});
84:   const [formError, setFormError] = useState<string | null>(null);
85:   const [loading, setLoading] = useState(false);
```
- **Lines 75–81:** Form state variables storing values for display name, birth date text string, body height in cm string, biological sex, and activity level.
- **Lines 83–85:** Local UI state for field-specific validation error messages (`errors`), top-level submit error message (`formError`), and form submitting spinner state (`loading`).

```tsx
87:   useEffect(() => {
88:     if (profile) {
89:       if (profile.display_name) setDisplayName(profile.display_name);
90:       if (profile.birth_date) {
91:         const parts = profile.birth_date.split('-');
92:         if (parts.length === 3) {
93:           setBirthDate(`${parts[2]}.${parts[1]}.${parts[0]}`);
94:         } else {
95:           setBirthDate(profile.birth_date);
96:         }
97:       }
98:       if (profile.height_cm) setHeightCm(String(profile.height_cm));
99:       if (profile.sex) setSex(profile.sex as 'male' | 'female');
100:       if (profile.activity_level) setActivityLevel(profile.activity_level as ActivityLevel);
101:     }
102:   }, [profile]);
```
- **Lines 87–102:** Synchronizes database profile values into component local state once data is loaded. Converts ISO formatted date strings (`YYYY-MM-DD`) into German display format (`DD.MM.YYYY`).

```tsx
104:   async function handleSubmit() {
105:     if (loading || !userId) return;
106: 
107:     setFormError(null);
108:     const parsed = profileSchema.safeParse({
109:       displayName: displayName.trim() || undefined,
110:       birthDate: birthDate.trim() || undefined,
111:       heightCm: heightCm.trim() ? Number(heightCm.replace(',', '.')) : undefined,
112:       sex,
113:       activityLevel,
114:     });
115: 
116:     if (!parsed.success) {
117:       setErrors(fieldErrors(parsed.error));
118:       return;
119:     }
120: 
121:     setErrors({});
122:     setLoading(true);
123:     const { error } = await updateProfile(userId, parsed.data);
124:     setLoading(false);
125: 
126:     if (error) {
127:       setFormError(error.message);
128:       return;
129:     }
130: 
131:     await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
132:     Alert.alert('Erfolg', 'Dein Profil wurde erfolgreich aktualisiert.', [
133:       { text: 'OK', onPress: () => router.back() },
134:     ]);
135:   }
```
- **Lines 104–135 (`handleSubmit`):** Validates and submits profile edits.
  - **Line 105:** Early return guard preventing duplicate submissions or submission without a valid user ID.
  - **Lines 108–114:** Parses form inputs with Zod `profileSchema`. Handles comma-to-dot replacement for floating point height input.
  - **Lines 116–119:** If Zod parsing fails, extracts field-level error messages into state and halts submission.
  - **Lines 121–124:** Sends updated payload to server via `updateProfile(userId, parsed.data)`.
  - **Lines 126–129:** Displays submission failure message if API returns an error.
  - **Lines 131–134:** On success, invalidates profile query cache to refresh dependent components, presents a success alert, and navigates back to the previous screen via `router.back()`.

```tsx
137:   return (
138:     <Screen title="Profil bearbeiten" showBackButton>
139:       <Card title="Persönliche Angaben">
140:         <View style={styles.form}>
141:           <TextField
142:             label="Name"
143:             value={displayName}
144:             onChangeText={setDisplayName}
145:             error={errors.displayName}
146:             autoCapitalize="words"
147:             placeholder="Wie sollen dich andere sehen?"
148:           />
149: 
150:           <TextField
151:             label="Geburtsdatum"
152:             value={birthDate}
153:             onChangeText={setBirthDate}
154:             error={errors.birthDate}
155:             placeholder={getDeviceDateFormat().placeholder}
156:             autoCapitalize="none"
157:           />
158: 
159:           <TextField
160:             label="Größe in cm"
161:             value={heightCm}
162:             onChangeText={setHeightCm}
163:             error={errors.heightCm}
164:             placeholder="178"
165:             autoCapitalize="none"
166:           />
167:         </View>
168:       </Card>
169: 
170:       <Card title="Berechnungsbasis">
171:         <ThemedText type="small" themeColor="textSecondary">
172:           Wird für die Schätzung deines Kalorienbedarfs verwendet.
173:         </ThemedText>
174:         <ChoiceRow options={SEX_OPTIONS} value={sex} onChange={setSex} />
175:       </Card>
176: 
177:       <Card title="Wie aktiv bist du?">
178:         <ChoiceRow options={ACTIVITY_LEVELS} value={activityLevel} onChange={setActivityLevel} />
179:       </Card>
180: 
181:       {formError ? (
182:         <ThemedText type="small" themeColor="danger">
183:           {formError}
184:         </ThemedText>
185:       ) : null}
186: 
187:       <Button label="Profil speichern" onPress={handleSubmit} loading={loading || profileLoading} />
188:     </Screen>
189:   );
190: }
```
- **Lines 137–190:** UI JSX layout structure:
  - **Line 138:** Root `<Screen>` container with back navigation enabled.
  - **Lines 139–168:** First card with text fields for display name, birth date, and height.
  - **Lines 170–175:** Second card with biological sex selection.
  - **Lines 177–179:** Third card with physical activity level selection.
  - **Lines 181–185:** Conditional error message rendering.
  - **Line 187:** Save action button with loading spinner indicator while fetching or saving.

#### Styles (Lines 192–211)
```tsx
192: const styles = StyleSheet.create({
193:   form: {
194:     gap: Spacing.three,
195:   },
196:   choices: {
197:     flexDirection: 'row',
198:     flexWrap: 'wrap',
199:     gap: Spacing.two,
200:     marginTop: Spacing.two,
201:   },
202:   choice: {
203:     borderWidth: 1,
204:     borderRadius: Spacing.three,
205:     paddingVertical: Spacing.two,
206:     paddingHorizontal: Spacing.three,
207:   },
208:   choiceSelected: {
209:     color: '#ffffff',
210:   },
211: });
```
- **Lines 192–211:** Defines component flexbox layouts, chip padding, border radius, and selected text color styling.

---

## `notification-settings-card.tsx`

**File Path:** [`fam/src/features/settings/notification-settings-card.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/notification-settings-card.tsx)

This component provides a UI card for managing push notification preferences regarding expiring food inventory items (enabling/disabling reminders, choosing advance warning threshold in days, and setting notification time of day).

### Line-by-Line / Section Breakdown

#### Imports & Constants (Lines 1–21)
```tsx
1: import { useEffect, useState } from 'react';
2: import { Pressable, type StyleProp, StyleSheet, Switch, View, type ViewStyle } from 'react-native';
3: 
4: import { Card } from '@/components/card';
5: import { ThemedText } from '@/components/themed-text';
6: import { Spacing } from '@/constants/theme';
7: import { useTheme } from '@/hooks/use-theme';
8: import {
9:   DEFAULT_NOTIFICATION_SETTINGS,
10:   getNotificationSettings,
11:   type NotificationSettings,
12:   requestNotificationPermissions,
13:   saveNotificationSettings,
14: } from '@/lib/notifications';
15: 
16: const THRESHOLD_OPTIONS = [1, 3, 5, 7];
17: const TIME_OPTIONS = [
18:   { label: '08:00 Uhr', hour: 8, minute: 0 },
19:   { label: '09:00 Uhr', hour: 9, minute: 0 },
20:   { label: '18:00 Uhr', hour: 18, minute: 0 },
21: ];
```
- **Lines 1–14:** Imports React hooks, React Native UI components, custom theme primitives, and local notification helper functions/types from `@/lib/notifications`.
- **Line 16 (`THRESHOLD_OPTIONS`):** Array of advance warning options in days (1, 3, 5, 7 days before food expiration).
- **Lines 17–21 (`TIME_OPTIONS`):** Preset reminder times (8:00 AM, 9:00 AM, 6:00 PM).

#### Component Signature & State Initialization (Lines 23–33)
```tsx
23: type NotificationSettingsCardProps = {
24:   style?: StyleProp<ViewStyle>;
25: };
26: 
27: export function NotificationSettingsCard({ style }: NotificationSettingsCardProps) {
28:   const theme = useTheme();
29:   const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
30: 
31:   useEffect(() => {
32:     getNotificationSettings().then(setSettings);
33:   }, []);
```
- **Lines 23–25:** Props type allowing optional layout styling overrides.
- **Lines 27–29:** Initializes state `settings` with default values.
- **Lines 31–33:** On component mount, reads stored settings asynchronously from persistent storage (`AsyncStorage`/device settings) and populates local state.

#### Update Handler (Lines 35–42)
```tsx
35:   async function updateSettings(newSettings: NotificationSettings) {
36:     setSettings(newSettings);
37:     await saveNotificationSettings(newSettings);
38: 
39:     if (newSettings.enabled) {
40:       await requestNotificationPermissions();
41:     }
42:   }
```
- **Lines 35–42 (`updateSettings`):** Updates local state, persists updated settings to local storage, and prompts the user for system push notification permissions if notifications are enabled.

#### JSX Rendering (Lines 44–137)
```tsx
44:   return (
45:     <View style={style}>
46:       <Card title="Benachrichtigungen">
47:         <View style={styles.content}>
48:           <View style={styles.settingRow}>
49:             <View style={styles.settingText}>
50:               <ThemedText style={{ fontWeight: 'bold' }}>Erinnerung aktivieren</ThemedText>
51:               <ThemedText type="small" themeColor="textSecondary">
52:                 Push-Mitteilung für bald ablaufende Vorräte erhalten.
53:               </ThemedText>
54:             </View>
55:             <Switch
56:               value={settings.enabled}
57:               onValueChange={(val) => updateSettings({ ...settings, enabled: val })}
58:               trackColor={{ false: theme.border, true: theme.accent }}
59:             />
60:           </View>
```
- **Lines 44–60:** Card header and master toggle row (`Switch`). Toggling the switch updates `settings.enabled`.

```tsx
62:           {settings.enabled && (
63:             <>
64:               <View style={styles.section}>
65:                 <ThemedText type="smallBold">Erinnern ab (Tage im Voraus):</ThemedText>
66:                 <View style={styles.chipRow}>
67:                   {THRESHOLD_OPTIONS.map((days) => {
68:                     const isSelected = settings.daysThreshold === days;
69:                     return (
70:                       <Pressable
71:                         key={days}
72:                         onPress={() => updateSettings({ ...settings, daysThreshold: days })}
73:                         style={[
74:                           styles.chip,
75:                           {
76:                             borderColor: isSelected ? theme.accent : theme.border,
77:                             backgroundColor: isSelected ? `${theme.accent}18` : 'transparent',
78:                           },
79:                         ]}>
80:                         <ThemedText
81:                           type="small"
82:                           style={{
83:                             color: isSelected ? theme.accent : theme.text,
84:                             fontWeight: isSelected ? 'bold' : 'normal',
85:                           }}>
86:                           {days} {days === 1 ? 'Tag' : 'Tage'}
87:                         </ThemedText>
88:                       </Pressable>
89:                     );
90:                   })}
91:                 </View>
92:               </View>
```
- **Lines 62–92:** Sub-section rendered only when notifications are enabled. Renders selectable chip elements (`Pressable`) for picking how many days prior to food item expiration reminders should fire.

```tsx
94:               <View style={styles.section}>
95:                 <ThemedText type="smallBold">Uhrzeit der Erinnerung:</ThemedText>
96:                 <View style={styles.chipRow}>
97:                   {TIME_OPTIONS.map((time) => {
98:                     const isSelected =
99:                       settings.reminderHour === time.hour &&
100:                       settings.reminderMinute === time.minute;
101:                     return (
102:                       <Pressable
103:                         key={time.label}
104:                         onPress={() =>
105:                           updateSettings({
106:                             ...settings,
107:                             reminderHour: time.hour,
108:                             reminderMinute: time.minute,
109:                           })
110:                         }
111:                         style={[
112:                           styles.chip,
113:                           {
114:                             borderColor: isSelected ? theme.accent : theme.border,
115:                             backgroundColor: isSelected ? `${theme.accent}18` : 'transparent',
116:                           },
117:                         ]}>
118:                         <ThemedText
119:                           type="small"
120:                           style={{
121:                             color: isSelected ? theme.accent : theme.text,
122:                             fontWeight: isSelected ? 'bold' : 'normal',
123:                           }}>
124:                           {time.label}
125:                         </ThemedText>
126:                       </Pressable>
127:                     );
128:                   })}
129:                 </View>
130:               </View>
131:             </>
132:           )}
133:         </View>
134:       </Card>
135:     </View>
136:   );
137: }
```
- **Lines 94–137:** Chip list for selecting the reminder hour and minute. Visual highlighting (accent border and semi-transparent accent background `${theme.accent}18`) indicates the selected choice.

#### Styles (Lines 139–168)
```tsx
139: const styles = StyleSheet.create({
140:   content: {
141:     gap: Spacing.three,
142:   },
143:   settingRow: {
144:     flexDirection: 'row',
145:     alignItems: 'center',
146:     justifyContent: 'space-between',
147:     gap: Spacing.two,
148:   },
149:   settingText: {
150:     flex: 1,
151:     gap: 2,
152:   },
153:   section: {
154:     gap: Spacing.two,
155:     marginTop: Spacing.one,
156:   },
157:   chipRow: {
158:     flexDirection: 'row',
159:     flexWrap: 'wrap',
160:     gap: Spacing.two,
161:   },
162:   chip: {
163:     paddingHorizontal: Spacing.three,
164:     paddingVertical: Spacing.one + 2,
165:     borderRadius: 20,
166:     borderWidth: 1,
167:   },
168: });
```
- **Lines 139–168:** Styling rules for row layout alignment, spacing gaps, pill-shaped chips, and borders.

---

## `settings-screen.tsx`

**File Path:** [`fam/src/features/settings/settings-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/settings-screen.tsx)

This file contains the primary settings overview screen (`SettingsScreen`). It aggregates account information, active household management options, storage location links, notification settings, background database sync status monitoring, manual sync triggers, and sign-out functionality.

### Line-by-Line / Section Breakdown

#### Imports (Lines 1–18)
```tsx
1: import { useQueryClient } from '@tanstack/react-query';
2: import { router } from 'expo-router';
3: import { useEffect, useState } from 'react';
4: import { Alert, StyleSheet, View } from 'react-native';
5: 
6: import { Button } from '@/components/ui/buttons';
7: import { Card } from '@/components/card';
8: import { Screen } from '@/components/screen';
9: import { ThemedText } from '@/components/themed-text';
10: import { Spacing } from '@/constants/theme';
11: import { useSession } from '@/features/auth/session-provider';
12: import { signOutAndClearLocalData } from '@/features/auth/sign-out';
13: import { useActiveHousehold } from '@/features/household/active-household-provider';
14: import { NotificationSettingsCard } from '@/features/settings/notification-settings-card';
15: import { useSyncStatus } from '@/hooks/use-sync-status';
16: import { useTheme } from '@/hooks/use-theme';
17: import { getDatabase } from '@/lib/db/client';
18: import { triggerHouseholdSync } from '@/lib/sync/sync-runner';
```
- **Lines 1–5:** Core React, React Native, React Query, and Expo Router imports.
- **Lines 6–10:** Standardized visual components (`Button`, `Card`, `Screen`, `ThemedText`) and spacing theme tokens.
- **Lines 11–18:** Auth session provider, sign-out handler, active household context provider, notification card component, sync status hook, dynamic theme hook, SQLite database client getter, and manual synchronization trigger function.

#### `Zeile` Helper Component (Lines 20–37)
```tsx
20: type ZeileProps = {
21:   label: string;
22:   wert: string;
23:   offen?: boolean;
24: };
25: 
26: function Zeile({ label, wert, offen }: ZeileProps) {
27:   const theme = useTheme();
28: 
29:   return (
30:     <View style={[styles.zeile, { borderBottomColor: theme.border }]}>
31:       <ThemedText type="small">{label}</ThemedText>
32:       <ThemedText type="small" themeColor={offen ? 'textSecondary' : 'text'}>
33:         {wert}
34:       </ThemedText>
35:     </View>
36:   );
37: }
```
- **Lines 20–37:** Helper component rendering a key-value summary row (`Zeile`) with a bottom divider line. The optional `offen` flag dims value text (e.g. for placeholder or under-development features).

#### `SettingsScreen` Main Component (Lines 39–196)
```tsx
39: export function SettingsScreen() {
40:   const { session } = useSession();
41:   const queryClient = useQueryClient();
42:   const [signingOut, setSigningOut] = useState(false);
43:   const [isSyncing, setIsSyncing] = useState(false);
44:   const [lastErrorMsg, setLastErrorMsg] = useState<string | null>(null);
45: 
46:   const { activeHousehold } = useActiveHousehold();
47:   const currentHousehold = activeHousehold;
48:   const syncStatus = useSyncStatus(getDatabase);
```
- **Lines 40–48:** Reads global session, initializes action loading states (`signingOut`, `isSyncing`), holds outbox error details (`lastErrorMsg`), gets active household details, and monitors live SQLite offline/online sync status via `useSyncStatus`.

```tsx
50:   useEffect(() => {
51:     if (syncStatus.kind === 'failed') {
52:       getDatabase().then((db) => {
53:         db.getFirstAsync<{ last_error: string | null }>(
54:           'select last_error from outbox where last_error is not null order by id desc limit 1',
55:         ).then((row) => {
56:           if (row?.last_error) {
57:             setLastErrorMsg(row.last_error);
58:           }
59:         });
60:       });
61:     } else {
62:       setLastErrorMsg(null);
63:     }
64:   }, [syncStatus.kind]);
```
- **Lines 50–64:** Monitors changes in `syncStatus.kind`. When sync fails, queries the local SQLite `outbox` table to retrieve the most recent error message for user debugging.

```tsx
66:   async function handleManualSync() {
67:     if (isSyncing || !currentHousehold) return;
68:     setIsSyncing(true);
69: 
70:     try {
71:       await triggerHouseholdSync([currentHousehold.id], true);
72:       queryClient.invalidateQueries();
73:     } finally {
74:       setIsSyncing(false);
75:     }
76:   }
```
- **Lines 66–76 (`handleManualSync`):** Triggers immediate synchronization for the active household using `triggerHouseholdSync`, then invalidates React Query caches to re-fetch updated data.

```tsx
78:   async function handleSignOut() {
79:     if (signingOut) return;
80:     setSigningOut(true);
81: 
82:     const { error } = await signOutAndClearLocalData(queryClient);
83: 
84:     setSigningOut(false);
85: 
86:     if (error) {
87:       Alert.alert('Abmelden fehlgeschlagen', error.message);
88:     } else {
89:       router.replace('/onboarding');
90:     }
91:   }
```
- **Lines 78–91 (`handleSignOut`):** Signs out the current user, clears auth tokens and local SQLite/React Query state via `signOutAndClearLocalData`, and redirects navigation to `/onboarding`.

```tsx
93:   let syncStatusText = 'Alle Daten sind synchronisiert';
94:   let syncStatusColor: 'accent' | 'warning' | 'danger' = 'accent';
95: 
96:   if (syncStatus.kind === 'offline') {
97:     syncStatusText =
98:       syncStatus.pendingCount > 0
99:         ? `Offline (${syncStatus.pendingCount} Änderungen ausstehend)`
100:         : 'Offline (Keine Internetverbindung)';
101:     syncStatusColor = 'warning';
102:   } else if (syncStatus.kind === 'syncing') {
103:     syncStatusText = `Synchronisiere … (${syncStatus.pendingCount} ausstehend)`;
104:     syncStatusColor = 'warning';
105:   } else if (syncStatus.kind === 'failed') {
106:     syncStatusText = `${syncStatus.failedCount} Änderungen konnten nicht synchronisiert werden.`;
107:     syncStatusColor = 'danger';
108:   }
```
- **Lines 93–108:** Formats user-readable sync status messages and assigns appropriate indicator colors based on state (`offline`, `syncing`, `failed`, or synchronized).

```tsx
110:   return (
111:     <Screen title="Einstellungen">
112:       <Card title="Profil">
113:         <Zeile label="Angemeldet als" wert={session?.user.email ?? '—'} />
114:         <View style={styles.aktion}>
115:           <Button
116:             label="Profil ergänzen / bearbeiten"
117:             variant="secondary"
118:             onPress={() => router.push('/settings/profile')}
119:           />
120:         </View>
121:       </Card>
122: 
123:       <Card title="Haushalt & Mitnutzer">
124:         <Zeile label="Aktueller Haushalt" wert={currentHousehold?.name ?? 'Lädt...'} />
125:         {currentHousehold && (
126:           <View style={styles.aktionStack}>
127:             <Button
128:               label="Mitglieder verwalten"
129:               variant="secondary"
130:               onPress={() => router.push('/household/members')}
131:             />
132:           </View>
133:         )}
134:       </Card>
135: 
136:       <Card title="Lagerorte">
137:         <ThemedText type="small" themeColor="textSecondary">
138:           Verwalte vordefinierte Orte wie Kühlschrank, Tiefkühltruhe und Abstellkammer oder lege
139:           neue an.
140:         </ThemedText>
141:         {currentHousehold && (
142:           <View style={styles.aktion}>
143:             <Button
144:               label="Lagerorte verwalten"
145:               variant="secondary"
146:               onPress={() => router.push('/household/storage-locations')}
147:             />
148:           </View>
149:         )}
150:       </Card>
151: 
152:       <NotificationSettingsCard />
153: 
154:       <Card title="Synchronisation">
155:         <ThemedText type="small" themeColor="textSecondary">
156:           Daten werden im Hintergrund automatisch synchronisiert.
157:         </ThemedText>
158:         <ThemedText
159:           type="smallBold"
160:           themeColor={syncStatusColor}
161:           style={{ marginTop: Spacing.two }}>
162:           {syncStatusText}
163:         </ThemedText>
164:         {lastErrorMsg && (
165:           <ThemedText type="small" themeColor="danger" style={{ marginTop: Spacing.one }}>
166:             Ursache: {lastErrorMsg}
167:           </ThemedText>
168:         )}
169:         <View style={styles.aktionStack}>
170:           <Button
171:             label={
172:               syncStatus.kind === 'failed'
173:                 ? 'Fehlgeschlagene erneut versuchen'
174:                 : 'Jetzt synchronisieren'
175:             }
176:             onPress={handleManualSync}
177:             loading={isSyncing}
178:             disabled={!currentHousehold}
179:           />
180:           <Button
181:             label="Sync-Diagnose & Outbox anzeigen"
182:             variant="secondary"
183:             onPress={() => router.push('/settings/sync-debug')}
184:           />
185:         </View>
186:       </Card>
187: 
188:       <Card title="Ziele & Daten">
189:         <Zeile label="Kalorienziel" wert="nicht gesetzt" offen />
190:         <Zeile label="Export" wert="in Vorbereitung" offen />
191:       </Card>
192: 
193:       <Button label="Abmelden" variant="danger" onPress={handleSignOut} loading={signingOut} />
194:     </Screen>
195:   );
196: }
```
- **Lines 110–196:** Visual structure organizing configuration cards:
  - **Lines 112–121:** User Account Card with link to edit profile screen.
  - **Lines 123–134:** Household Card with link to member management screen.
  - **Lines 136–150:** Storage Locations Card with navigation to location settings screen.
  - **Line 152:** Notification settings embedded card component.
  - **Lines 154–186:** Synchronization status card showing online status, error output, sync button, and link to sync debug screen.
  - **Lines 188–191:** Placeholders for target goals and data export.
  - **Line 193:** Account sign out button.

#### Styles (Lines 198–214)
```tsx
198: const styles = StyleSheet.create({
199:   zeile: {
200:     flexDirection: 'row',
201:     justifyContent: 'space-between',
202:     alignItems: 'center',
203:     gap: Spacing.three,
204:     paddingVertical: Spacing.two,
205:     borderBottomWidth: StyleSheet.hairlineWidth,
206:   },
207:   aktion: {
208:     marginTop: Spacing.three,
209:   },
210:   aktionStack: {
211:     marginTop: Spacing.three,
212:     gap: Spacing.two,
213:   },
214: });
```
- **Lines 198–214:** Defines row border dividers and action button margin/gap spacing.

---

## `sync-debug-screen.tsx`

**File Path:** [`fam/src/features/sync-debug-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/settings/sync-debug-screen.tsx)

This file provides a developer and diagnostic tool screen (`SyncDebugScreen`). It displays real-time local SQLite database state (outbox table, local storage locations, and local food items), allows manual synchronization triggers, lets developers clear stale/stuck outbox records in emergency scenarios, and features live hardware testing controls for push notifications and camera barcode scanning.

### Line-by-Line / Section Breakdown

#### Imports (Lines 1–18)
```tsx
1: import { useQueryClient } from '@tanstack/react-query';
2: import { useCallback, useEffect, useState } from 'react';
3: import { Alert, StyleSheet, View } from 'react-native';
4: 
5: import { Button } from '@/components/ui/buttons';
6: import { Card } from '@/components/card';
7: import { Screen } from '@/components/screen';
8: import { ThemedText } from '@/components/themed-text';
9: import { Spacing } from '@/constants/theme';
10: import { useActiveHousehold } from '@/features/household/active-household-provider';
11: import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
12: import { useSyncStatus } from '@/hooks/use-sync-status';
13: import { useTheme } from '@/hooks/use-theme';
14: import { getDatabase } from '@/lib/db/client';
15: import { sendTestNotification } from '@/lib/notifications';
16: import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
17: import { getLastSyncInfo, triggerHouseholdSync } from '@/lib/sync/sync-runner';
```
- **Lines 1–4:** React core hooks, React Native UI components, React Query hook.
- **Lines 5–9:** Modular theme and component primitives (`Button`, `Card`, `Screen`, `ThemedText`, `Spacing`).
- **Lines 10–17:** Active household provider, `BarcodeScannerModal`, sync status hook, theme hook, local database client, test notification trigger, OpenFoodFacts product type, and sync runner utilities (`getLastSyncInfo`, `triggerHouseholdSync`).

#### Type Definitions (Lines 19–44)
```tsx
19: type OutboxRow = {
20:   id: number;
21:   entity: string;
22:   entity_id: string;
23:   op: string;
24:   payload: string;
25:   created_at: number;
26:   attempts: number;
27:   last_error: string | null;
28: };
29: 
30: type LocationRow = {
31:   id: string;
32:   name: string;
33:   kind: string;
34:   household_id: string;
35: };
36: 
37: type ItemRow = {
38:   id: string;
39:   name: string;
40:   quantity: number;
41:   unit: string;
42:   location_id: string | null;
43:   household_id: string;
44: };
```
- **Lines 19–28 (`OutboxRow`):** Interface matching SQLite `outbox` table schema (operation type, entity name, JSON payload, retry attempt counter, error trace).
- **Lines 30–35 (`LocationRow`):** Interface matching SQLite `storage_locations` table schema.
- **Lines 37–44 (`ItemRow`):** Interface matching SQLite `fridge_items` table schema.

#### `SyncDebugScreen` Component & Testing Handlers (Lines 46–70)
```tsx
46: export function SyncDebugScreen() {
47:   const theme = useTheme();
48:   const queryClient = useQueryClient();
49:   const { activeHousehold } = useActiveHousehold();
50:   const currentHousehold = activeHousehold;
51:   const syncStatus = useSyncStatus(getDatabase);
52: 
53:   const [loading, setLoading] = useState(false);
54:   const [showScannerTest, setShowScannerTest] = useState(false);
55:   const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
56:   const [locationRows, setLocationRows] = useState<LocationRow[]>([]);
57:   const [itemRows, setItemRows] = useState<ItemRow[]>([]);
58:   const lastSyncInfo = getLastSyncInfo();
```
- **Lines 46–58:** Component hook setup and local state for outbox entries, locations, items, loading indicators, scanner modal visibility (`showScannerTest`), and historical sync metadata (`lastSyncInfo`).

```tsx
60:   async function handleTestNotification() {
61:     const result = await sendTestNotification();
62:     Alert.alert(result.success ? 'Erfolg' : 'Hinweis', result.message);
63:   }
64: 
65:   function handleProductScanned(product: OpenFoodFactsProduct) {
66:     Alert.alert(
67:       'Produkt erkannt! 📷',
68:       `Name: ${product.name}\nMarke: ${product.brand ?? '—'}\nBarcode: ${product.barcode}\nMenge: ${product.quantity} ${product.unit}`,
69:     );
70:   }
```
- **Lines 60–63 (`handleTestNotification`):** Triggers a local test push notification to verify OS notification system behavior.
- **Lines 65–70 (`handleProductScanned`):** Callback executed when the barcode scanner identifies a product code, displaying an Alert dialog with product information.

#### Database Debug Querying (Lines 72–95)
```tsx
72:   const loadDebugData = useCallback(async () => {
73:     try {
74:       const db = await getDatabase();
75:       const outbox = await db.getAllAsync<OutboxRow>(
76:         'select * from outbox order by id desc limit 20',
77:       );
78:       const locs = await db.getAllAsync<LocationRow>(
79:         'select id, name, kind, household_id from storage_locations limit 20',
80:       );
81:       const items = await db.getAllAsync<ItemRow>(
82:         'select id, name, quantity, unit, location_id, household_id from fridge_items limit 20',
83:       );
84: 
85:       setOutboxRows(outbox);
86:       setLocationRows(locs);
87:       setItemRows(items);
88:     } catch (err) {
89:       console.error('Fehler beim Laden der Debug-Daten:', err);
90:     }
91:   }, []);
92: 
93:   useEffect(() => {
94:     loadDebugData();
95:   }, [loadDebugData]);
```
- **Lines 72–91 (`loadDebugData`):** Asynchronously queries the local SQLite database client for the 20 most recent entries in `outbox`, `storage_locations`, and `fridge_items` tables using `getAllAsync`.
- **Lines 93–95:** Executed on initial screen render to populate table inspector cards.

#### Database Manipulation Handlers (Lines 97–131)
```tsx
97:   async function handleSyncNow() {
98:     if (!currentHousehold || loading) return;
99:     setLoading(true);
100:     try {
101:       await triggerHouseholdSync([currentHousehold.id], true);
102:       queryClient.invalidateQueries();
103:       await loadDebugData();
104:     } finally {
105:       setLoading(false);
106:     }
107:   }
```
- **Lines 97–107 (`handleSyncNow`):** Initiates a manual synchronization run, invalidates React Query state, and refreshes local SQLite debug inspect tables.

```tsx
109:   async function handleClearOutbox() {
110:     Alert.alert(
111:       'Outbox leeren?',
112:       'Dies löscht ungesendete lokale Änderungen aus der Warteschlange.',
113:       [
114:         { text: 'Abbrechen', style: 'cancel' },
115:         {
116:           text: 'Leeren',
117:           style: 'destructive',
118:           onPress: async () => {
119:             const db = await getDatabase();
120:             await db.runAsync('delete from outbox');
121:             queryClient.invalidateQueries();
122:             await loadDebugData();
123:           },
124:         },
125:       ],
126:     );
127:   }
```
- **Lines 109–127 (`handleClearOutbox`):** Destructive action presented with confirmation dialog. Wipes all rows in the local SQLite `outbox` table using `delete from outbox` to clear un-syncable or corrupted queue items during debugging.

```tsx
129:   const formattedLastSync = lastSyncInfo?.timestamp
130:     ? new Date(lastSyncInfo.timestamp).toLocaleTimeString('de-DE')
131:     : 'Noch nicht synchronisiert';
```
- **Lines 129–131:** Formats the last sync timestamp into German local time (`de-DE`).

#### JSX Debug Dashboard Rendering (Lines 133–270)
```tsx
133:   return (
134:     <Screen title="Sync-Diagnose" showBackButton>
135:       <Card title="Letzter Synchronisations-Lauf">
136:         <View style={styles.zeile}>
137:           <ThemedText type="small">Uhrzeit:</ThemedText>
138:           <ThemedText type="smallBold">{formattedLastSync}</ThemedText>
139:         </View>
140:         {lastSyncInfo && (
141:           <>
142:             <View style={styles.zeile}>
143:               <ThemedText type="small">Hochgeladen (Pushed):</ThemedText>
144:               <ThemedText type="smallBold">{lastSyncInfo.pushedCount} Einträge</ThemedText>
145:             </View>
146:             <View style={styles.zeile}>
147:               <ThemedText type="small">Empfangen (Pulled):</ThemedText>
148:               <ThemedText type="smallBold">{lastSyncInfo.pulledCount} Zeilen</ThemedText>
149:             </View>
150:           </>
151:         )}
152:         <View style={styles.zeile}>
153:           <ThemedText type="small">Aktueller Sync-Status:</ThemedText>
154:           <ThemedText type="smallBold">{syncStatus.kind.toUpperCase()}</ThemedText>
155:         </View>
156:         <View style={styles.actionRow}>
157:           <Button
158:             label="Jetzt synchronisieren & prüfen"
159:             onPress={handleSyncNow}
160:             loading={loading}
161:           />
162:         </View>
163:       </Card>
```
- **Lines 135–163:** Last Sync Run Card detailing execution timestamp, pushed changes count, pulled changes count, current sync engine status, and a manual sync trigger button.

```tsx
165:       <Card title="Live-Test (Hardware & Push)">
166:         <ThemedText type="small" themeColor="textSecondary">
167:           Test-Aktionen für lokale Mitteilungen und die Kamera-Barcode-Erkennung.
168:         </ThemedText>
169: 
170:         <View style={styles.actionStack}>
171:           <Button label="🔔 Test-Benachrichtigung senden" onPress={handleTestNotification} />
172:           <Button
173:             label="📷 Barcode-Scanner testen"
174:             variant="secondary"
175:             onPress={() => setShowScannerTest(true)}
176:           />
177:         </View>
178:       </Card>
179: 
180:       <Card title="Aktueller Haushalt in DB">
181:         <View style={styles.zeile}>
182:           <ThemedText type="small">Haushalts-Name:</ThemedText>
183:           <ThemedText type="smallBold">
184:             {currentHousehold?.name ?? 'Kein Haushalt geladen'}
185:           </ThemedText>
186:         </View>
187:         <View style={styles.zeile}>
188:           <ThemedText type="small">Haushalts-ID:</ThemedText>
189:           <ThemedText type="small" themeColor="textSecondary">
190:             {currentHousehold?.id ?? '—'}
191:           </ThemedText>
192:         </View>
193:       </Card>
```
- **Lines 165–178:** Hardware testing controls card (notifications trigger and camera scanner launcher).
- **Lines 180–193:** Active Household details card displaying household name and UUID string.

```tsx
195:       <Card title={`Lokale Outbox (${outboxRows.length} Einträge)`}>
196:         {outboxRows.length === 0 ? (
197:           <ThemedText type="small" themeColor="textSecondary">
198:             Outbox ist leer. Alle lokalen Änderungen sind synchronisiert!
199:           </ThemedText>
200:         ) : (
201:           outboxRows.map((row) => (
202:             <View key={row.id} style={[styles.boxItem, { borderBottomColor: theme.border }]}>
203:               <ThemedText type="smallBold">
204:                 #{row.id} {row.op.toUpperCase()} {row.entity}
205:               </ThemedText>
206:               <ThemedText type="small" themeColor="textSecondary">
207:                 ID: {row.entity_id} | Versuche: {row.attempts}
208:               </ThemedText>
209:               {row.last_error && (
210:                 <ThemedText type="small" themeColor="danger">
211:                   Fehler: {row.last_error}
212:                 </ThemedText>
213:               )}
214:               <ThemedText type="small" style={styles.payloadCode}>
215:                 Payload: {row.payload}
216:               </ThemedText>
217:             </View>
218:           ))
219:         )}
220: 
221:         {outboxRows.length > 0 && (
222:           <View style={styles.actionRow}>
223:             <Button label="Outbox leeren (Notfall)" variant="danger" onPress={handleClearOutbox} />
224:           </View>
225:         )}
226:       </Card>
```
- **Lines 195–226:** Outbox Queue Card listing pending database sync operations, failure attempts, error stack traces, and raw JSON payload strings. Displays an emergency clear outbox button if entries are present.

```tsx
228:       <Card title={`Lokale Lagerorte (${locationRows.length} Orte)`}>
229:         {locationRows.length === 0 ? (
230:           <ThemedText type="small" themeColor="textSecondary">
231:             Keine Lagerorte lokal in SQLite gefunden.
232:           </ThemedText>
233:         ) : (
234:           locationRows.map((loc) => (
235:             <View key={loc.id} style={[styles.boxItem, { borderBottomColor: theme.border }]}>
236:               <ThemedText type="smallBold">{loc.name}</ThemedText>
237:               <ThemedText type="small" themeColor="textSecondary">
238:                 Typ: {loc.kind} | ID: {loc.id}
239:               </ThemedText>
240:             </View>
241:           ))
242:         )}
243:       </Card>
244: 
245:       <Card title={`Lokale Lebensmittel (${itemRows.length} Artikel)`}>
246:         {itemRows.length === 0 ? (
247:           <ThemedText type="small" themeColor="textSecondary">
248:             Keine Artikel lokal in SQLite gefunden.
249:           </ThemedText>
250:         ) : (
251:           itemRows.map((item) => (
252:             <View key={item.id} style={[styles.boxItem, { borderBottomColor: theme.border }]}>
253:               <ThemedText type="smallBold">
254:                 {item.name} ({item.quantity} {item.unit})
255:               </ThemedText>
256:               <ThemedText type="small" themeColor="textSecondary">
257:                 Lagerort-ID: {item.location_id ?? 'Keiner'} | Artikel-ID: {item.id}
258:               </ThemedText>
259:             </View>
260:           ))
261:         )}
262:       </Card>
263: 
264:       <BarcodeScannerModal
265:         visible={showScannerTest}
266:         onClose={() => setShowScannerTest(false)}
267:         onProductFound={handleProductScanned}
268:       />
269:     </Screen>
270:   );
271: }
```
- **Lines 228–243:** Storage Locations inspection card displaying local SQLite entries.
- **Lines 245–262:** Local Food Items inspection card displaying stored items, quantities, units, and storage location foreign keys.
- **Lines 264–268:** Camera scanner modal instance rendered for hardware testing.

#### Styles (Lines 273–297)
```tsx
273: const styles = StyleSheet.create({
274:   zeile: {
275:     flexDirection: 'row',
276:     justifyContent: 'space-between',
277:     alignItems: 'center',
278:     paddingVertical: Spacing.one,
279:   },
280:   actionRow: {
281:     marginTop: Spacing.three,
282:   },
283:   actionStack: {
284:     marginTop: Spacing.three,
285:     gap: Spacing.two,
286:   },
287:   boxItem: {
288:     paddingVertical: Spacing.two,
289:     borderBottomWidth: StyleSheet.hairlineWidth,
290:     gap: Spacing.one,
291:   },
292:   payloadCode: {
293:     fontFamily: 'Courier',
294:     fontSize: 11,
295:     marginTop: 2,
296:   },
297: });
```
- **Lines 273–297:** Styling declarations including monospaced font family styling (`Courier`) for raw outbox payload rendering.
