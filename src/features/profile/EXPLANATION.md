# Feature Documentation: Profile (`src/features/profile`)

This document provides a line-by-line and section-by-section technical explanation of all non-test source code files in the `src/features/profile` directory.

---

## File: `src/features/profile/profile-screen.tsx`

The `profile-screen.tsx` file implements the user profile screen component (`ProfileScreen`). It allows users to view account details, navigate to household management screens, review feature statuses, read privacy information, and log out of the application.

---

### Section 1: External & Internal Imports (Lines 1–14)

```typescript
1: import { useQueryClient } from '@tanstack/react-query';
2: import { router } from 'expo-router';
3: import { useState } from 'react';
4: import { Alert, StyleSheet, View } from 'react-native';
5: 
6: import { Button } from '@/components/button';
7: import { Card } from '@/components/card';
8: import { Screen } from '@/components/screen';
9: import { ThemedText } from '@/components/themed-text';
10: import { Spacing } from '@/constants/theme';
11: import { useSession } from '@/features/auth/session-provider';
12: import { signOutAndClearLocalData } from '@/features/auth/sign-out';
13: import { useActiveHousehold } from '@/features/household/active-household-provider';
14: import { useTheme } from '@/hooks/use-theme';
```

- **Line 1 (`import { useQueryClient } from '@tanstack/react-query';`)**: Imports the React Query client hook to access the global cache instance, enabling local data cleanup upon sign-out.
- **Line 2 (`import { router } from 'expo-router';`)**: Imports Expo Router's navigation object to handle screen transitions (e.g., navigating to `/onboarding`, `/household/members`, or `/household/storage-locations`).
- **Line 3 (`import { useState } from 'react';`)**: Imports React's local state hook to manage the sign-out loading state (`signingOut`).
- **Line 4 (`import { Alert, StyleSheet, View } from 'react-native';`)**: Imports core React Native UI components (`View`, `StyleSheet`) and the native alert dialog module (`Alert`) to show sign-out error messages.
- **Line 6 (`import { Button } from '@/components/button';`)**: Imports custom reusable button component with variant support (`secondary`, `danger`) and loading indicator integration.
- **Line 7 (`import { Card } from '@/components/card';`)**: Imports styled card container component for grouping information sections with section titles.
- **Line 8 (`import { Screen } from '@/components/screen';`)**: Imports layout wrapper screen component providing safe area handling, scrolling support, and screen title header.
- **Line 9 (`import { ThemedText } from '@/components/themed-text';`)**: Imports theme-aware text component supporting typography styles and theme color tokens.
- **Line 10 (`import { Spacing } from '@/constants/theme';`)**: Imports spacing constants (`Spacing.two`, `Spacing.three`) from the central theme definition.
- **Line 11 (`import { useSession } from '@/features/auth/session-provider';`)**: Imports session context hook to access authentication state and current user profile details (such as user email).
- **Line 12 (`import { signOutAndClearLocalData } from '@/features/auth/sign-out';`)**: Imports utility function to perform Supabase sign-out while invalidating and clearing React Query caches.
- **Line 13 (`import { useActiveHousehold } from '@/features/household/active-household-provider';`)**: Imports active household context hook to access current household state and metadata.
- **Line 14 (`import { useTheme } from '@/hooks/use-theme';`)**: Imports hook for accessing the active dynamic theme palette (border colors, background colors, text colors).

---

### Section 2: Helper Type Definition (`ZeileProps`) (Lines 16–21)

```typescript
16: type ZeileProps = {
17:   label: string;
18:   wert: string;
19:   /** Noch nicht umgesetzt — wird als solches gekennzeichnet, statt so to tun als ginge es. */
20:   offen?: boolean;
21: };
```

- **Lines 16–21 (`type ZeileProps = ...`)**: Defines prop interface for the `Zeile` (Row) helper component:
  - `label`: Name or description of the setting/attribute (left side).
  - `wert`: Value or status display string (right side).
  - `offen` (optional boolean): Flag to mark features that are not yet implemented or pending configuration, formatting them with secondary text color rather than presenting them as fully functional.

---

### Section 3: Subcomponent `Zeile` (Lines 23–34)

```typescript
23: function Zeile({ label, wert, offen }: ZeileProps) {
24:   const theme = useTheme();
25: 
26:   return (
27:     <View style={[styles.zeile, { borderBottomColor: theme.border }]}>
28:       <ThemedText type="small">{label}</ThemedText>
29:       <ThemedText type="small" themeColor={offen ? 'textSecondary' : 'text'}>
30:         {wert}
31:       </ThemedText>
32:     </View>
33:   );
34: }
```

- **Line 23 (`function Zeile({ label, wert, offen }: ZeileProps)`)**: Component definition for a key-value row inside profile cards.
- **Line 24 (`const theme = useTheme();`)**: Reads active theme object to dynamically style the bottom border.
- **Line 27 (`<View style={[styles.zeile, { borderBottomColor: theme.border }]}>`)**: Renders row container with flexbox space-between layout and theme border color.
- **Line 28 (`<ThemedText type="small">{label}</ThemedText>`)**: Renders the attribute label on the left using small text typography.
- **Lines 29–31 (`<ThemedText type="small" themeColor={offen ? 'textSecondary' : 'text'}>{wert}</ThemedText>`)**: Renders the value text on the right. If `offen` is true, applies `textSecondary` color to visually signify placeholder or pending feature status.

---

### Section 4: Main Component `ProfileScreen` State & Handlers (Lines 36–56)

```typescript
36: export function ProfileScreen() {
37:   const { session } = useSession();
38:   const queryClient = useQueryClient();
39:   const [signingOut, setSigningOut] = useState(false);
40:   const { activeHousehold } = useActiveHousehold();
41:   const currentHousehold = activeHousehold;
42: 
43:   async function handleSignOut() {
44:     if (signingOut) return;
45:     setSigningOut(true);
46: 
47:     const { error } = await signOutAndClearLocalData(queryClient);
48: 
49:     setSigningOut(false);
50: 
51:     if (error) {
52:       Alert.alert('Abmelden fehlgeschlagen', error.message);
53:       return;
54:     }
55:     router.replace('/onboarding');
56:   }
```

- **Line 36 (`export function ProfileScreen()`)**: Primary exported React component for rendering the profile screen.
- **Line 37 (`const { session } = useSession();`)**: Accesses current session data (user email).
- **Line 38 (`const queryClient = useQueryClient();`)**: Obtains query client instance for resetting application query state during logout.
- **Line 39 (`const [signingOut, setSigningOut] = useState(false);`)**: Local state boolean tracking pending sign-out execution to show loading spinners and prevent redundant user taps.
- **Line 40–41 (`const { activeHousehold } = useActiveHousehold(); const currentHousehold = activeHousehold;`)**: Obtains active household object from context and assigns it to `currentHousehold`.
- **Lines 43–56 (`async function handleSignOut()`)**: Async event handler executing sign-out logic:
  - **Line 44**: Guards against multiple simultaneous executions if already signing out.
  - **Line 45**: Sets `signingOut` state to `true`.
  - **Line 47**: Calls `signOutAndClearLocalData(queryClient)` to perform authentication logout and purge cached data.
  - **Line 49**: Resets `signingOut` state to `false`.
  - **Lines 51–54**: If an error occurred during sign out, displays a native alert with the error message and aborts navigation.
  - **Line 55**: On success, replaces current route stack with `/onboarding`.

---

### Section 5: JSX Render Structure (Lines 58–106)

```typescript
58:   return (
59:     <Screen title="Profil">
60:       <Card title="Konto">
61:         <Zeile label="Angemeldet als" wert={session?.user.email ?? '—'} />
62:         <Zeile label="Haushalt" wert={currentHousehold?.name ?? 'Lädt...'} />
63:         <View style={styles.aktion}>
64:           <Button
65:             label="Profil ergänzen"
66:             variant="secondary"
67:             onPress={() => router.push('/onboarding')}
68:           />
69:           {currentHousehold && (
70:             <View style={{ marginTop: 8, gap: 8 }}>
71:               <Button
72:                 label="Mitglieder verwalten"
73:                 variant="secondary"
74:                 onPress={() => router.push('/household/members')}
75:               />
76:               <Button
77:                 label="Lagerorte verwalten"
78:                 variant="secondary"
79:                 onPress={() => router.push('/household/storage-locations')}
80:               />
81:             </View>
82:           )}
83:         </View>
84:       </Card>
85: 
86:       <Card title="Ziele">
87:         <Zeile label="Kalorienziel" wert="nicht gesetzt" offen />
88:         <Zeile label="Makro-Verteilung" wert="nicht gesetzt" offen />
89:       </Card>
90: 
91:       <Card title="Daten">
92:         <Zeile label="Export" wert="in Vorbereitung" offen />
93:         <Zeile label="Konto löschen" wert="in Vorbereitung" offen />
94:       </Card>
95: 
96:       <Card title="Datenschutz">
97:         <ThemedText type="small" themeColor="textSecondary">
98:           Vorrat und Einkaufsliste teilst du mit deinem Haushalt. Kalorien, Gewicht und Ziele
99:           bleiben privat — die Trennung ist in der Datenbank erzwungen, nicht nur in der Anzeige.
100:         </ThemedText>
101:       </Card>
102: 
103:       <Button label="Abmelden" variant="danger" onPress={handleSignOut} loading={signingOut} />
104:     </Screen>
105:   );
106: }
```

- **Lines 59 & 104 (`<Screen title="Profil"> ... </Screen>`)**: Wraps screen with title header "Profil".
- **Lines 60–84 (`<Card title="Konto"> ... </Card>`)**: Card containing user account details:
  - **Line 61**: Displays signed-in user email or fallback dash `—`.
  - **Line 62**: Displays active household name or fallback `Lädt...`.
  - **Lines 63–83**: Navigation action buttons:
    - **Lines 64–68**: Button to edit profile / onboarding (`/onboarding`).
    - **Lines 69–82**: Conditional block rendered when `currentHousehold` exists:
      - Button to manage household members (`/household/members`).
      - Button to manage storage locations (`/household/storage-locations`).
- **Lines 86–89 (`<Card title="Ziele"> ... </Card>`)**: Card listing nutrition & macro goal status (currently unconfigured placeholders with `offen` set).
- **Lines 91–94 (`<Card title="Daten"> ... </Card>`)**: Card listing data export and account deletion features (in preparation placeholders with `offen` set).
- **Lines 96–101 (`<Card title="Datenschutz"> ... </Card>`)**: Card explaining privacy guarantees: shared pantry/shopping list vs private calorie/weight/goals data enforced by database RLS rules.
- **Line 103 (`<Button label="Abmelden" variant="danger" onPress={handleSignOut} loading={signingOut} />`)**: Action button to initiate sign-out process, styled with danger variant (red) and displaying spinner when `signingOut` is true.

---

### Section 6: StyleSheet Definitions (Lines 108–120)

```typescript
108: const styles = StyleSheet.create({
109:   zeile: {
110:     flexDirection: 'row',
111:     justifyContent: 'space-between',
112:     alignItems: 'center',
113:     gap: Spacing.three,
114:     paddingVertical: Spacing.two,
115:     borderBottomWidth: StyleSheet.hairlineWidth,
116:   },
117:   aktion: {
118:     marginTop: Spacing.two,
119:   },
120: });
```

- **Lines 109–116 (`zeile`)**: Styling for key-value row components:
  - `flexDirection: 'row'`: Arranges label and value horizontally.
  - `justifyContent: 'space-between'`: Pushes label to the left edge and value to the right edge.
  - `alignItems: 'center'`: Vertically aligns elements centered within row.
  - `gap: Spacing.three`: Horizontal gap between label and value text.
  - `paddingVertical: Spacing.two`: Vertical padding for touched/visual spacing.
  - `borderBottomWidth: StyleSheet.hairlineWidth`: Draws standard thin separator line underneath each row.
- **Lines 117–119 (`aktion`)**: Styling for action container block with top margin `Spacing.two`.
