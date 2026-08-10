# App Directory Routing & Layout Documentation (`src/app`)

This directory contains the route components and layouts for the Expo Router application. The directory structure uses file-based routing with route groups (`(app)`, `(auth)`), nested stack layouts (`household`, `settings`), modal routes (`add-item`), and standalone screens (`onboarding`).

---

## Table of Contents
1. [`_layout.tsx`](#1-layouttsx)
2. [`add-item.tsx`](#2-add-itemtsx)
3. [`onboarding.tsx`](#3-onboardingtsx)
4. [`(app)/_layout.tsx`](#4-applayouttsx)
5. [`(app)/fridge.tsx`](#5-appfridgetsx)
6. [`(app)/index.tsx`](#6-appindextsx)
7. [`(app)/profile.tsx`](#7-appprofiletsx)
8. [`(app)/recipes.tsx`](#8-apprecipestsx)
9. [`(app)/settings.tsx`](#9-appsettingstsx)
10. [`(app)/shopping-list.tsx`](#10-appshopping-listtsx)
11. [`(auth)/_layout.tsx`](#11-authlayouttsx)
12. [`(auth)/forgot-password.tsx`](#12-authforgot-passwordtsx)
13. [`(auth)/reset-password.tsx`](#13-authreset-passwordtsx)
14. [`(auth)/sign-in.tsx`](#14-authsign-intsx)
15. [`(auth)/sign-up.tsx`](#15-authsign-uptsx)
16. [`household/_layout.tsx`](#16-householdlayouttsx)
17. [`household/children.tsx`](#17-householdchildrentsx)
18. [`household/create.tsx`](#18-householdcreatetsx)
19. [`household/join.tsx`](#19-householdjointsx)
20. [`household/members.tsx`](#20-householdmemberstsx)
21. [`household/storage-locations.tsx`](#21-householdstorage-locationstsx)
22. [`settings/_layout.tsx`](#22-settingslayouttsx)
23. [`settings/profile.tsx`](#23-settingsprofiletsx)
24. [`settings/sync-debug.tsx`](#24-settingssync-debugtsx)

---

## 1. `_layout.tsx`

**File Path:** `src/app/_layout.tsx`  
**Description:** Root layout for the application. Configures context providers (`QueryClientProvider`, `SessionProvider`, `ActiveHouseholdProvider`, `ThemeProvider`), global overlays (`AnimatedSplashOverlay`, `SyncStatusBanner`), deep link listeners (for auth magic links, password resets, and household invites), query environment sync, splash screen auto-hiding, and conditional protected navigation routes.

### Line-by-Line / Block Breakdown

#### Lines 1–17: Imports
```tsx
1: import { QueryClientProvider } from '@tanstack/react-query';
2: import * as Linking from 'expo-linking';
3: import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
4: import * as SplashScreen from 'expo-splash-screen';
5: import { useEffect } from 'react';
6: import { useColorScheme } from 'react-native';
7: 
8: import { AnimatedSplashOverlay } from '@/components/animated-icon';
9: import { SyncStatusBanner } from '@/components/sync-status-banner';
10: import { SessionProvider, useSession } from '@/features/auth/session-provider';
11: import { parseAuthErrorFromUrl, parseAuthTokensFromUrl } from '@/lib/auth-deep-link';
12: import { setAuthDeepLinkError } from '@/lib/auth-deep-link-state';
13: import { env } from '@/lib/env';
14: import { savePendingInviteToken } from '@/lib/pending-invite';
15: import { queryClient, startQueryEnvironmentSync } from '@/lib/query-client';
16: import { getSupabase } from '@/lib/supabase';
```
- **What it does:** Imports essential libraries for TanStack Query, Expo linking, navigation, splash screen management, theme context, authentication, deep-link handling, environment variables, pending household invite storage, and Supabase client initialization.
- **Why:** Establishes all dependencies required at the application root for global state management, theme switching, deep link processing, and root layout structure.

---

#### Line 18: Native Splash Screen Holding
```tsx
18: SplashScreen.preventAutoHideAsync();
```
- **What it does:** Calls `SplashScreen.preventAutoHideAsync()` immediately at module load time.
- **Why:** Prevents Expo's native splash screen from automatically dismissing before authentication state and onboarding status are fully initialized from storage.

---

#### Lines 20–36: Navigation Flow Documentation (JSDoc)
```tsx
20: /**
21:  * Wechselt zwischen angemeldetem und nicht angemeldetem Bereich.
...
36:  */
```
- **What it does:** Documents the three primary user startup flows (New User, Out-of-session User, Authenticated User) and the `forceOnboarding` debug override.
- **Why:** Clarifies architectural decisions regarding authentication and onboarding navigation states for developer maintainability.

---

#### Lines 37–73: `RootNavigator` Component
```tsx
37: function RootNavigator() {
38:   const { session, isLoading, seenOnboarding } = useSession();
39: 
40:   useEffect(() => {
41:     // Splash erst ausblenden, wenn Session UND Onboarding-Flag gelesen sind.
42:     if (!isLoading) SplashScreen.hideAsync();
43:   }, [isLoading]);
44: 
45:   // Solange geladen wird, keine Gruppe rendern: "noch unbekannt" ist nicht
46:   // dasselbe wie "nicht angemeldet".
47:   if (isLoading) return null;
48: 
49:   const forceOnboarding = env.forceOnboarding;
50: 
51:   // Neuer User: kein Flag gesetzt ODER forceOnboarding aktiv → Onboarding
52:   const isNewUser = !seenOnboarding || forceOnboarding;
53: 
54:   return (
55:     <Stack screenOptions={{ headerShown: false }}>
56:       {/* /onboarding ist immer erreichbar — es ist der Einstieg fuer neue User
57:           und wird auch fuer eingeloggte User mit unvollstaendigem Profil benoetigt. */}
58:       <Stack.Screen name="onboarding" />
59: 
60:       {/* Eingeloggte User ODER neuer User (via Onboarding einloggen) */}
61:       <Stack.Protected guard={!!session || isNewUser}>
62:         <Stack.Screen name="(app)" />
63:         <Stack.Screen name="household" />
64:         <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
65:       </Stack.Protected>
66: 
67:       {/* Login-Screen: nur fuer bekannte User die sich ausgeloggt haben */}
68:       <Stack.Protected guard={!session && !isNewUser}>
69:         <Stack.Screen name="(auth)" />
70:       </Stack.Protected>
71:     </Stack>
72:   );
73: }
```
- **What it does:**
  - Lines 38–43: Evaluates authentication state (`session`, `isLoading`, `seenOnboarding`) and hides the splash screen once loading is complete.
  - Line 47: Returns `null` during loading to avoid premature navigation or screen flicker.
  - Lines 49–52: Calculates `isNewUser` based on onboarding history or debug configuration (`env.forceOnboarding`).
  - Lines 54–72: Configures the root navigation stack using Expo Router's `<Stack>` and `<Stack.Protected>` route guards. Onboarding is accessible globally; main app routes (`(app)`, `household`, `add-item` modal) require a session or new user state; authentication screens (`(auth)`) are presented to existing logged-out users.
- **Why:** Enforces application-wide navigation security, modal presentation options, and smooth user onboarding flow transitions.

---

#### Line 75: Import `ActiveHouseholdProvider`
```tsx
75: import { ActiveHouseholdProvider } from '@/features/household/active-household-provider';
```
- **What it does:** Imports the household context provider component.
- **Why:** Required to supply household context to all child routes inside `RootLayout`.

---

#### Lines 77–150: `RootLayout` Default Export Component
```tsx
77: export default function RootLayout() {
78:   const colorScheme = useColorScheme();
79: 
80:   useEffect(() => {
81:     function handleUrl(url: string | null) {
82:       if (!url) return;
83:       try {
...
115:         const parsed = Linking.parse(url);
116:         const token = parsed.queryParams?.token;
117:         if (typeof token === 'string' && token.trim()) {
118:           savePendingInviteToken(token.trim());
119:         }
120:       } catch (err) {
121:         console.error('Fehler beim Parsen des Deep Links:', err);
122:       }
123:     }
124: 
125:     Linking.getInitialURL().then(handleUrl);
126:     const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
127:     return () => subscription.remove();
128:   }, []);
129: 
132:   useEffect(() => {
133:     // Bindet TanStack Query an AppState und Netzwerkstatus — siehe query-client.ts.
134:     return startQueryEnvironmentSync();
135:   }, []);
136: 
137:   return (
138:     <QueryClientProvider client={queryClient}>
139:       <SessionProvider>
140:         <ActiveHouseholdProvider>
141:           <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
142:             <AnimatedSplashOverlay />
143:             <SyncStatusBanner />
144:             <RootNavigator />
145:           </ThemeProvider>
146:         </ActiveHouseholdProvider>
147:       </SessionProvider>
148:     </QueryClientProvider>
149:   );
150: }
```
- **What it does:**
  - Lines 78, 141: Reads the current device color scheme (`light` vs `dark`) and passes the corresponding Navigation theme (`DarkTheme` vs `DefaultTheme`) to `ThemeProvider`.
  - Lines 80–130: Initializes a deep link handling effect. Extracts access/refresh tokens from implicit hash fragments via `parseAuthTokensFromUrl` and restores session state in Supabase, captures auth deep-link error parameters via `parseAuthErrorFromUrl`, or saves incoming household invite query parameters (`token`) using `savePendingInviteToken`. Listeners are attached to `Linking.getInitialURL()` and `Linking.addEventListener('url', ...)`.
  - Lines 132–135: Synchronizes TanStack Query cache auto-refetching with app focus state and network connectivity via `startQueryEnvironmentSync()`.
  - Lines 137–149: Renders the nested global provider stack (`QueryClientProvider` -> `SessionProvider` -> `ActiveHouseholdProvider` -> `ThemeProvider`) along with global UI overlays (`AnimatedSplashOverlay`, `SyncStatusBanner`) and the `RootNavigator`.
- **Why:** Provides centralized app configuration, automatic auth link exchange, theme integration, offline sync status indication, and clean unmounting logic.

---

## 2. `add-item.tsx`

**File Path:** `src/app/add-item.tsx`  
**Description:** Route entry point for adding items to the inventory, rendered as a modal screen.

### Line-by-Line Breakdown

```tsx
1: import { AddItemScreen } from '@/features/inventory/add-item-screen';
2: 
3: export default function AddItemRoute() {
4:   return <AddItemScreen />;
5: }
6: 
```
- **Line 1:** Imports `AddItemScreen` feature component from `@/features/inventory/add-item-screen`.
- **Lines 3–5:** Exports `AddItemRoute` default functional component rendering `<AddItemScreen />`.
- **Why:** Keeps file-based routing lightweight by delegating screen UI logic and business state to the modular feature directory.

---

## 3. `onboarding.tsx`

**File Path:** `src/app/onboarding.tsx`  
**Description:** Route entry point for the user onboarding flow.

### Line-by-Line Breakdown

```tsx
1: import { OnboardingFlow } from '@/features/onboarding/onboarding-flow';
2: 
3: export default function OnboardingRoute() {
4:   return <OnboardingFlow />;
5: }
6: 
```
- **Line 1:** Imports `OnboardingFlow` from `@/features/onboarding/onboarding-flow`.
- **Lines 3–5:** Exports `OnboardingRoute` default functional component returning `<OnboardingFlow />`.
- **Why:** Decouples file-based routing from multi-step onboarding implementation logic.

---

## 4. `(app)/_layout.tsx`

**File Path:** `src/app/(app)/_layout.tsx`  
**Description:** Layout wrapper for the authenticated core app section (`(app)`). Manages background sync for the active household, automatic invite token redemption, profile/household loading spinners, onboarding completion checks, and tab navigation rendering.

### Line-by-Line / Block Breakdown

#### Lines 1–13: Imports
```tsx
1: import { Redirect, router } from 'expo-router';
2: import { useEffect } from 'react';
3: import { ActivityIndicator, View } from 'react-native';
4: 
5: import AppTabs from '@/components/app-tabs';
6: import { useProfile } from '@/features/auth/api';
7: import { isOnboardingSessionCompleted } from '@/features/auth/onboarding-session';
8: import { useSession } from '@/features/auth/session-provider';
9: import { useActiveHousehold } from '@/features/household/active-household-provider';
10: import { useRedeemInviteMutation } from '@/features/household/api';
11: import { env } from '@/lib/env';
12: import { clearPendingInviteToken, peekPendingInviteToken } from '@/lib/pending-invite';
13: import { useSyncEngine } from '@/lib/sync/sync-runner';
```
- **What it does:** Imports router navigation helpers (`Redirect`, `router`), React state hooks, loading indicators, main bottom tabs (`AppTabs`), auth queries/session state, household context hooks, pending invite helpers, and offline database sync runners.
- **Why:** Serves as the operational hub for authenticated users by connecting background sync, access guards, and tab navigation.

---

#### Lines 15–70: `AppLayoutContent` Component
```tsx
15: function AppLayoutContent() {
16:   const { session } = useSession();
17:   const userId = session?.user.id;
18:   const { data: profile, isLoading: profileLoading } = useProfile(userId);
19:   const { activeHouseholdId, households, isLoading: householdsLoading } = useActiveHousehold();
20:   const redeemInvite = useRedeemInviteMutation();
21: 
22:   // Automatischer Sync für den aktiven Haushalt
23:   useSyncEngine(activeHouseholdId ?? undefined);
24: 
25:   useEffect(() => {
26:     // Nur lesen, nicht loeschen (#128): Dieser Effekt laeuft auf jedem Mount...
...
44:   }, [redeemInvite]);
45: 
46:   if (profileLoading || householdsLoading) {
47:     return (
48:       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
49:         <ActivityIndicator size="large" />
50:       </View>
51:     );
52:   }
53: 
54:   // Onboarding Guard (#104)...
55:   const isUncompleted = profile
56:     ? (profile as { onboarding_completed_at?: string | null }).onboarding_completed_at == null
57:     : false;
58:   const shouldPrompt = (env.forceOnboarding || isUncompleted) && !isOnboardingSessionCompleted();
59: 
60:   if (shouldPrompt) {
61:     return <Redirect href="/onboarding" />;
62:   }
63: 
64:   // Wenn der Nutzer in gar keinem Haushalt Mitglied ist, leiten wir ihn auf die Erstellen-Seite um
65:   if (!households || households.length === 0) {
66:     return <Redirect href="/household/create" />;
67:   }
68: 
69:   return <AppTabs />;
70: }
```
- **What it does:**
  - Lines 16–20: Obtains current `session`, user profile via `useProfile`, active household state via `useActiveHousehold`, and invite redemption mutation via `useRedeemInviteMutation`.
  - Line 23: Invokes `useSyncEngine` with `activeHouseholdId` to run background synchronization between local storage and Supabase remote database.
  - Lines 25–44: Checks for non-destructive pending invite tokens via `peekPendingInviteToken()`. If found, attempts mutation execution (`redeemInvite.mutateAsync`). On success, clears the stored token via `clearPendingInviteToken()` and redirects to root (`/`). On failure, retains token so manual join (`/household/join`) can retry.
  - Lines 46–52: Displays a centered `<ActivityIndicator>` full-screen spinner while profile or household query data is loading.
  - Lines 54–62: Checks if user's profile onboarding timestamp is null or forced by config. If incomplete and not dismissed for current session (`!isOnboardingSessionCompleted()`), redirects to `/onboarding`.
  - Lines 64–67: Checks if user belongs to any household. If member list is empty, redirects to `/household/create`.
  - Line 69: Renders `<AppTabs />` when all guards pass.
- **Why:** Protects app features with strict validation checks (profile onboarding status & household membership) while handling automated invite link processing and background data sync seamlessly.

---

#### Lines 72–75: `AppLayout` Export Component
```tsx
72: /** Angemeldeter Bereich. Der Guard sitzt im Root-Layout. */
73: export default function AppLayout() {
74:   return <AppLayoutContent />;
75: }
```
- **What it does:** Wraps `AppLayoutContent` as the default export for the `(app)` group layout route.
- **Why:** Maintains standard Expo Router file export patterns while isolating internal layout hooks inside `AppLayoutContent`.

---

## 5. `(app)/fridge.tsx`

**File Path:** `src/app/(app)/fridge.tsx`  
**Description:** Route entry point for the fridge inventory tab screen.

### Line-by-Line Breakdown

```tsx
1: import { FridgeScreen } from '@/features/fridge/fridge-screen';
2: 
3: export default function FridgeRoute() {
4:   return <FridgeScreen />;
5: }
6: 
```
- **Line 1:** Imports `FridgeScreen` from `@/features/fridge/fridge-screen`.
- **Lines 3–5:** Exports default `FridgeRoute` component rendering `<FridgeScreen />`.
- **Why:** Connects tab route `/(app)/fridge` to the fridge feature module.

---

## 6. `(app)/index.tsx`

**File Path:** `src/app/(app)/index.tsx`  
**Description:** Default route entry point for the main app dashboard tab.

### Line-by-Line Breakdown

```tsx
1: import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
2: 
3: export default function DashboardRoute() {
4:   return <DashboardScreen />;
5: }
6: 
```
- **Line 1:** Imports `DashboardScreen` from `@/features/dashboard/dashboard-screen`.
- **Lines 3–5:** Exports default `DashboardRoute` component rendering `<DashboardScreen />`.
- **Why:** Serves as the home screen (`/`) route inside the `(app)` group.

---

## 7. `(app)/profile.tsx`

**File Path:** `src/app/(app)/profile.tsx`  
**Description:** Route alias entry point for profile view within `(app)`.

### Line-by-Line Breakdown

```tsx
1: import { SettingsScreen } from '@/features/settings/settings-screen';
2: 
3: export default function ProfileRoute() {
4:   return <SettingsScreen />;
5: }
6: 
```
- **Line 1:** Imports `SettingsScreen` from `@/features/settings/settings-screen`.
- **Lines 3–5:** Exports default `ProfileRoute` rendering `<SettingsScreen />`.
- **Why:** Maps the `/(app)/profile` route to settings screen component.

---

## 8. `(app)/recipes.tsx`

**File Path:** `src/app/(app)/recipes.tsx`  
**Description:** Route entry point for the recipes tab screen.

### Line-by-Line Breakdown

```tsx
1: import { RecipesScreen } from '@/features/recipes/recipes-screen';
2: 
3: export default function RecipesRoute() {
4:   return <RecipesScreen />;
5: }
6: 
```
- **Line 1:** Imports `RecipesScreen` from `@/features/recipes/recipes-screen`.
- **Lines 3–5:** Exports default `RecipesRoute` rendering `<RecipesScreen />`.
- **Why:** Connects tab route `/(app)/recipes` to the recipes feature module.

---

## 9. `(app)/settings.tsx`

**File Path:** `src/app/(app)/settings.tsx`  
**Description:** Route entry point for the settings tab screen.

### Line-by-Line Breakdown

```tsx
1: import { SettingsScreen } from '@/features/settings/settings-screen';
2: 
3: export default function SettingsRoute() {
4:   return <SettingsScreen />;
5: }
6: 
```
- **Line 1:** Imports `SettingsScreen` from `@/features/settings/settings-screen`.
- **Lines 3–5:** Exports default `SettingsRoute` rendering `<SettingsScreen />`.
- **Why:** Connects tab route `/(app)/settings` to the settings feature module.

---

## 10. `(app)/shopping-list.tsx`

**File Path:** `src/app/(app)/shopping-list.tsx`  
**Description:** Route entry point for the shopping list tab screen.

### Line-by-Line Breakdown

```tsx
1: import { ShoppingListScreen } from '@/features/shopping-list/shopping-list-screen';
2: 
3: export default function ShoppingListRoute() {
4:   return <ShoppingListScreen />;
5: }
6: 
```
- **Line 1:** Imports `ShoppingListScreen` from `@/features/shopping-list/shopping-list-screen`.
- **Lines 3–5:** Exports default `ShoppingListRoute` rendering `<ShoppingListScreen />`.
- **Why:** Connects tab route `/(app)/shopping-list` to the shopping list feature module.

---

## 11. `(auth)/_layout.tsx`

**File Path:** `src/app/(auth)/_layout.tsx`  
**Description:** Stack layout wrapper for authentication routes (`(auth)` group).

### Line-by-Line Breakdown

```tsx
1: import { Stack } from 'expo-router';
2: 
3: /** Anmeldebereich. Header aus, die Screens bringen ihre eigenen Titel mit. */
4: export default function AuthLayout() {
5:   return <Stack screenOptions={{ headerShown: false }} />;
6: }
7: 
```
- **Line 1:** Imports `Stack` navigator from `expo-router`.
- **Lines 3–6:** Exports default `AuthLayout` component configured with `headerShown: false` so auth screens customize their header navigation UI independently.
- **Why:** Provides layout stack container for sign-in, sign-up, password reset, and forgot password routes.

---

## 12. `(auth)/forgot-password.tsx`

**File Path:** `src/app/(auth)/forgot-password.tsx`  
**Description:** Route entry point for requesting password reset emails.

### Line-by-Line Breakdown

```tsx
1: import { ForgotPasswordScreen } from '@/features/auth/forgot-password-screen';
2: 
3: export default function ForgotPasswordRoute() {
4:   return <ForgotPasswordScreen />;
5: }
6: 
```
- **Line 1:** Imports `ForgotPasswordScreen` from `@/features/auth/forgot-password-screen`.
- **Lines 3–5:** Exports default `ForgotPasswordRoute` rendering `<ForgotPasswordScreen />`.
- **Why:** Links `/forgot-password` route to authentication feature module.

---

## 13. `(auth)/reset-password.tsx`

**File Path:** `src/app/(auth)/reset-password.tsx`  
**Description:** Route entry point for confirming password reset with code or deep link token.

### Line-by-Line Breakdown

```tsx
1: import { ResetPasswordScreen } from '@/features/auth/reset-password-screen';
2: 
3: export default function ResetPasswordRoute() {
4:   return <ResetPasswordScreen />;
5: }
6: 
```
- **Line 1:** Imports `ResetPasswordScreen` from `@/features/auth/reset-password-screen`.
- **Lines 3–5:** Exports default `ResetPasswordRoute` rendering `<ResetPasswordScreen />`.
- **Why:** Links `/reset-password` route to authentication feature module.

---

## 14. `(auth)/sign-in.tsx`

**File Path:** `src/app/(auth)/sign-in.tsx`  
**Description:** Route entry point for user sign-in.

### Line-by-Line Breakdown

```tsx
1: import { SignInScreen } from '@/features/auth/sign-in-screen';
2: 
3: export default function SignInRoute() {
4:   return <SignInScreen />;
5: }
6: 
```
- **Line 1:** Imports `SignInScreen` from `@/features/auth/sign-in-screen`.
- **Lines 3–5:** Exports default `SignInRoute` rendering `<SignInScreen />`.
- **Why:** Links `/sign-in` route to authentication feature module.

---

## 15. `(auth)/sign-up.tsx`

**File Path:** `src/app/(auth)/sign-up.tsx`  
**Description:** Route entry point for user registration.

### Line-by-Line Breakdown

```tsx
1: import { SignUpScreen } from '@/features/auth/sign-up-screen';
2: 
3: export default function SignUpRoute() {
4:   return <SignUpScreen />;
5: }
6: 
```
- **Line 1:** Imports `SignUpScreen` from `@/features/auth/sign-up-screen`.
- **Lines 3–5:** Exports default `SignUpRoute` rendering `<SignUpScreen />`.
- **Why:** Links `/sign-up` route to authentication feature module.

---

## 16. `household/_layout.tsx`

**File Path:** `src/app/household/_layout.tsx`  
**Description:** Stack layout wrapper for household management sub-routes (`/household/*`).

### Line-by-Line Breakdown

```tsx
1: import { Stack } from 'expo-router';
2: 
3: export default function HouseholdLayout() {
4:   return <Stack screenOptions={{ headerShown: false }} />;
5: }
6: 
```
- **Line 1:** Imports `Stack` navigator from `expo-router`.
- **Lines 3–5:** Exports default `HouseholdLayout` component rendering stack with headers hidden.
- **Why:** Provides nested stack container for household routes (children, creation, joining, members, storage locations).

---

## 17. `household/children.tsx`

**File Path:** `src/app/household/children.tsx`  
**Description:** Route entry point for managing child profiles in active household.

### Line-by-Line Breakdown

```tsx
1: import { ChildProfilesScreen } from '@/features/household/child-profiles-screen';
2: 
3: export default function ChildrenRoute() {
4:   return <ChildProfilesScreen />;
5: }
6: 
```
- **Line 1:** Imports `ChildProfilesScreen` from `@/features/household/child-profiles-screen`.
- **Lines 3–5:** Exports default `ChildrenRoute` rendering `<ChildProfilesScreen />`.
- **Why:** Connects `/household/children` route to household feature screen.

---

## 18. `household/create.tsx`

**File Path:** `src/app/household/create.tsx`  
**Description:** Route entry point for creating a new household.

### Line-by-Line Breakdown

```tsx
1: import { CreateHouseholdScreen } from '@/features/household/create-household-screen';
2: 
3: export default function CreateHouseholdRoute() {
4:   return <CreateHouseholdScreen />;
5: }
6: 
```
- **Line 1:** Imports `CreateHouseholdScreen` from `@/features/household/create-household-screen`.
- **Lines 3–5:** Exports default `CreateHouseholdRoute` rendering `<CreateHouseholdScreen />`.
- **Why:** Connects `/household/create` route to household feature screen.

---

## 19. `household/join.tsx`

**File Path:** `src/app/household/join.tsx`  
**Description:** Route entry point for joining an existing household via invite code/token.

### Line-by-Line Breakdown

```tsx
1: import { JoinHouseholdScreen } from '@/features/household/join-household-screen';
2: 
3: export default function JoinHouseholdRoute() {
4:   return <JoinHouseholdScreen />;
5: }
6: 
```
- **Line 1:** Imports `JoinHouseholdScreen` from `@/features/household/join-household-screen`.
- **Lines 3–5:** Exports default `JoinHouseholdRoute` rendering `<JoinHouseholdScreen />`.
- **Why:** Connects `/household/join` route to household feature screen.

---

## 20. `household/members.tsx`

**File Path:** `src/app/household/members.tsx`  
**Description:** Route entry point for managing household members and invitations.

### Line-by-Line Breakdown

```tsx
1: import { MembersScreen } from '@/features/household/members-screen';
2: 
3: export default function MembersRoute() {
4:   return <MembersScreen />;
5: }
6: 
```
- **Line 1:** Imports `MembersScreen` from `@/features/household/members-screen`.
- **Lines 3–5:** Exports default `MembersRoute` rendering `<MembersScreen />`.
- **Why:** Connects `/household/members` route to household feature screen.

---

## 21. `household/storage-locations.tsx`

**File Path:** `src/app/household/storage-locations.tsx`  
**Description:** Route entry point for managing household storage locations (fridge, pantry, freezer, etc.).

### Line-by-Line Breakdown

```tsx
1: import { StorageLocationsScreen } from '@/features/inventory/storage-locations-screen';
2: 
3: export default function StorageLocationsRoute() {
4:   return <StorageLocationsScreen />;
5: }
6: 
```
- **Line 1:** Imports `StorageLocationsScreen` from `@/features/inventory/storage-locations-screen`.
- **Lines 3–5:** Exports default `StorageLocationsRoute` rendering `<StorageLocationsScreen />`.
- **Why:** Connects `/household/storage-locations` route to inventory storage location management feature.

---

## 22. `settings/_layout.tsx`

**File Path:** `src/app/settings/_layout.tsx`  
**Description:** Stack layout wrapper for settings sub-routes (`/settings/*`).

### Line-by-Line Breakdown

```tsx
1: import { Stack } from 'expo-router';
2: 
3: export default function SettingsLayout() {
4:   return <Stack screenOptions={{ headerShown: false }} />;
5: }
6: 
```
- **Line 1:** Imports `Stack` navigator from `expo-router`.
- **Lines 3–5:** Exports default `SettingsLayout` component rendering stack with headers hidden.
- **Why:** Provides nested stack container for settings sub-routes (profile editing, sync debug tool).

---

## 23. `settings/profile.tsx`

**File Path:** `src/app/settings/profile.tsx`  
**Description:** Route entry point for user profile editing.

### Line-by-Line Breakdown

```tsx
1: import { EditProfileScreen } from '@/features/settings/edit-profile-screen';
2: 
3: export default function ProfileRoute() {
4:   return <EditProfileScreen />;
5: }
6: 
```
- **Line 1:** Imports `EditProfileScreen` from `@/features/settings/edit-profile-screen`.
- **Lines 3–5:** Exports default `ProfileRoute` rendering `<EditProfileScreen />`.
- **Why:** Connects `/settings/profile` route to profile editing feature screen.

---

## 24. `settings/sync-debug.tsx`

**File Path:** `src/app/settings/sync-debug.tsx`  
**Description:** Route entry point for offline synchronization debugging UI.

### Line-by-Line Breakdown

```tsx
1: import { SyncDebugScreen } from '@/features/settings/sync-debug-screen';
2: 
3: export default function SyncDebugRoute() {
4:   return <SyncDebugScreen />;
5: }
6: 
```
- **Line 1:** Imports `SyncDebugScreen` from `@/features/settings/sync-debug-screen`.
- **Lines 3–5:** Exports default `SyncDebugRoute` rendering `<SyncDebugScreen />`.
- **Why:** Connects `/settings/sync-debug` route to developer/admin sync diagnostic screen.
