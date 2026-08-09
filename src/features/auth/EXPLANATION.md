# Comprehensive Technical Documentation: `src/features/auth`

This document provides a line-by-line and section-by-section breakdown of all non-test source files in the `src/features/auth` directory (including components and onboarding subdirectories).

---

## Table of Contents

1. [`src/features/auth/api.ts`](#1-srcfeaturesauthapits)
2. [`src/features/auth/auth-schemas.ts`](#2-srcfeaturesauthauth-schemasts)
3. [`src/features/auth/components/pending-auth-banner.tsx`](#3-srcfeaturesauthcomponentspending-auth-bannertsx)
4. [`src/features/auth/forgot-password-screen.tsx`](#4-srcfeaturesauthforgot-password-screentsx)
5. [`src/features/auth/onboarding/step-create-household.tsx`](#5-srcfeaturesauthonboardingstep-create-householdtsx)
6. [`src/features/auth/onboarding/step-household-info.tsx`](#6-srcfeaturesauthonboardingstep-household-infotsx)
7. [`src/features/auth/onboarding/step-indicator.tsx`](#7-srcfeaturesauthonboardingstep-indicatortsx)
8. [`src/features/auth/onboarding/step-inventory.tsx`](#8-srcfeaturesauthonboardingstep-inventorytsx)
9. [`src/features/auth/onboarding/step-profile.tsx`](#9-srcfeaturesauthonboardingstep-profiletsx)
10. [`src/features/auth/onboarding/step-welcome.tsx`](#10-srcfeaturesauthonboardingstep-welcometsx)
11. [`src/features/auth/onboarding-session.ts`](#11-srcfeaturesauthonboarding-sessionts)
12. [`src/features/auth/reset-password-screen.tsx`](#12-srcfeaturesauthreset-password-screentsx)
13. [`src/features/auth/session-provider.tsx`](#13-srcfeaturesauthsession-providertsx)
14. [`src/features/auth/sign-in-screen.tsx`](#14-srcfeaturesauthsign-in-screentsx)
15. [`src/features/auth/sign-out.ts`](#15-srcfeaturesauthsign-outts)
16. [`src/features/auth/sign-up-screen.tsx`](#16-srcfeaturesauthsign-up-screentsx)

---

## 1. `src/features/auth/api.ts`

### File Overview
`api.ts` houses all network calls to Supabase Authentication and user profile database interactions, as well as error message translation utilities for user-facing UI feedback.

### Line-by-Line / Section Breakdown

- **Lines 1–6:** Imports Supabase `AuthError` type, `@tanstack/react-query`'s `useQuery` hook, Expo's `Linking` module, `ProfileInput` type from `auth-schemas`, and the Supabase client getter `getSupabase`.
```ts
1: import type { AuthError } from '@supabase/supabase-js';
2: import { useQuery } from '@tanstack/react-query';
3: import * as Linking from 'expo-linking';
4: 
5: import type { ProfileInput } from '@/features/auth/auth-schemas';
6: import { getSupabase } from '@/lib/supabase';
```

- **Lines 8–13:** JSDoc documentation explaining the function `authErrorMessage` which maps technical, English Supabase error messages into clear, localized German feedback.
- **Lines 14–53:** `export function authErrorMessage(error: AuthError | Error | null): string | null`
  - **Line 15:** Returns `null` if no error object is provided.
  - **Line 17:** Normalizes error message text to lower case for consistent substring checking (`raw = error.message.toLowerCase()`).
  - **Lines 21–23:** Checks for `'invalid login credentials'` and returns `'E-Mail oder Passwort stimmt nicht.'`. *Design rationale:* Does not disclose whether the email address exists in the system to prevent user enumeration attacks.
  - **Lines 24–26:** Checks for `'email not confirmed'` and instructs user to check their email inbox.
  - **Lines 27–29:** Checks for `'user already registered'` or `'already been registered'` and prompts the user to sign in or reset password.
  - **Lines 30–32:** Maps password length violations to `'Das Passwort ist zu kurz.'`.
  - **Lines 33–35:** Maps email rate limits to `'Zu viele Versuche. Bitte warte einen Moment.'`.
  - **Lines 39–45:** Unifies expired or invalid OTP tokens, magic link tokens, and OTP link errors into a clear instruction: `'Der Code ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.'`.
  - **Lines 48–50:** Handles mobile network failures (`'network request failed'`, `'fetch failed'`) with connection check prompts.
  - **Line 52:** Fallback returning the raw `error.message` if no specific rule matches.

- **Lines 55–64:** `export async function signInWithOAuthProvider(provider: 'apple' | 'google')`
  - **Line 56:** Creates application redirect URL via `Linking.createURL('/(app)')`.
  - **Lines 57–62:** Calls `getSupabase().auth.signInWithOAuth` with specified provider and redirect URL.
  - **Line 63:** Returns `{ data, error }` object.

- **Lines 66–87:** `export async function signUp(email: string, password: string)`
  - **Lines 67–83:** Extensive architectural comment explaining why `emailRedirectTo` is explicitly **omitted**. Deep linking schemes (`fam://`) fail when emails are opened on external devices or browsers without app deep link handling. Disabling redirect relies on server-side `email_confirmed_at` updates alongside 6-digit OTP codes.
  - **Lines 84–87:** Calls `getSupabase().auth.signUp({ email, password })` and returns the result.

- **Lines 89–107:** `export async function confirmSignUpWithCode(email: string, token: string)`
  - Explains code verification mechanism via `getSupabase().auth.verifyOtp` with `type: 'signup'`. Upon success, Supabase immediately returns a valid session.

- **Lines 109–112:** `export async function resendConfirmationEmail(email: string)`
  - Calls `getSupabase().auth.resend({ type: 'signup', email })`.

- **Lines 114–117:** `export async function signIn(email: string, password: string)`
  - Authenticates via password using `getSupabase().auth.signInWithPassword({ email, password })`.

- **Lines 119–122:** `export async function signOut()`
  - Signs out the active user via `getSupabase().auth.signOut()`.

- **Lines 124–134:** `export async function requestPasswordReset(email: string)`
  - Configures deep link redirect to `/reset-password` using `Linking.createURL('/reset-password')` and triggers `resetPasswordForEmail`.

- **Lines 136–139:** `export async function updatePassword(password: string)`
  - Updates user credentials using `getSupabase().auth.updateUser({ password })`.

- **Lines 140–155:** `export function useProfile(userId: string | undefined)`
  - React Query hook fetching user profile record from Supabase table `profiles`. Query is conditional (`enabled: Boolean(userId)`).

- **Lines 157–177:** `export async function updateProfile(userId: string, input: ProfileInput)`
  - Updates profile metadata (`display_name`, `birth_date`, `sex`, `height_cm`, `activity_level`, `onboarding_completed_at`). Uses `update` instead of `upsert` because the profile row is pre-created by database trigger `on_auth_user_created`.

- **Lines 179–188:** `export async function markOnboardingCompleted(userId: string)`
  - Explicitly updates `onboarding_completed_at` timestamp in table `profiles`.

---

## 2. `src/features/auth/auth-schemas.ts`

### File Overview
`auth-schemas.ts` defines Zod validation schemas for input fields across login, registration, password resets, verification codes, date parsing, and onboarding profiles, along with utility helpers.

### Line-by-Line / Section Breakdown

- **Lines 1–9:** Imports `z` from `zod` and provides architectural documentation emphasizing pure client-side validation without side effects or I/O dependencies.
- **Lines 11–19:** `const email` Zod schema: trims, converts to lowercase for display consistency, checks minimum length of 1, and validates standard email formatting with localized German error messages.
- **Lines 21–32:** `const password` Zod schema: enforces 8–72 characters. Rationale explains why strict character class requirements are avoided (length provides stronger security without forcing predictable password patterns like `"Passwort1!"`).
- **Lines 34–40:** `signInSchema`: validates `email` and checks non-empty `password`. *Rationale:* Does not enforce minimum 8 characters on login so legacy accounts get server-side auth errors instead of client-side validation blocks.
- **Lines 42–51:** `signUpSchema`: validates `email`, `password`, and `passwordConfirmation`, with `.refine()` verifying equality between password and confirmation.
- **Lines 53:** `resetRequestSchema`: validates email object for password reset requests.
- **Lines 55–70:** `confirmationCodeSchema`: validates 6-digit numeric OTP code (`/^\d{6}$/`) after trimming whitespace.
- **Lines 71–79:** `newPasswordSchema`: validates new password and matching password confirmation.
- **Lines 81–111:** `getDeviceDateFormat()`: inspects `Intl.DateTimeFormat().resolvedOptions().locale` to determine local device date formats (`en-US` uses `MM/DD/YYYY`, default/German uses `TT.MM.JJJJ`). Includes try-catch safety wrapper.
- **Lines 113–157:** `normalizeDateInput(raw: string): string | null`
  - Parses date strings across three supported patterns:
    1. ISO format: `YYYY-MM-DD`
    2. German / European format: `DD.MM.YYYY`
    3. US format: `MM/DD/YYYY`
  - Validates month, day, and year boundaries using native `Date` object comparisons and returns normalized ISO string `YYYY-MM-DD` or `null`.
- **Lines 159–194:** `profileSchema`: validates optional profile fields:
  - `displayName`: trimmed string (max 80 chars).
  - `birthDate`: transformed via `normalizeDateInput` and refined to ensure date is not in the future.
  - `sex`: enum (`'male' | 'female'`) used for BMR calculations.
  - `heightCm`: positive number up to 299.
  - `activityLevel`: enum (`'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'`).
- **Lines 196–199:** Inferred TypeScript types (`ConfirmationCodeInput`, `SignInInput`, `SignUpInput`, `ProfileInput`).
- **Lines 201–216:** `fieldErrors(error: z.ZodError)`: maps Zod validation issues into key-value pairs (field name -> first error message).

---

## 3. `src/features/auth/components/pending-auth-banner.tsx`

### File Overview
`pending-auth-banner.tsx` is an interactive banner component presented during the email verification pending state. It handles animation loops, OTP code entry, email resends, session polling, and deep-link status tracking.

### Line-by-Line / Section Breakdown

- **Lines 1–19:** Component imports including React hooks, React Native UI/animation primitives, custom design system components (`Button`, `TextField`, `ThemedText`), auth API helpers, Zod validation schema, theme hook, deep link state listener, and Supabase getter.
- **Lines 20–30:** `interface PendingAuthBannerProps`: defines props (`email`, `onConfirmed`, optional `onChangeEmail`, optional `password`).
- **Lines 32–52:** Component declaration and internal state hooks:
  - UI states: `resending`, `resendStatus`, `resendFailed`, `cooldown`, `code`, `codeError`, `confirming`, `recovering`.
  - Animated refs: `pulseAnim` (scale), `pulseOpacity` (alpha), `liveDotAnim` (status dot pulse).
- **Lines 53–110:** `useEffect` for animation loops:
  - Parallel loop scaling liquid pulse ring (1 to 1.25) and fading opacity (0.4 to 0.15).
  - Sequence loop pulsing live activity indicator dot (0.3 to 1 opacity).
- **Lines 111–118:** `useEffect` for cooldown timer: decrements `cooldown` state every 1000ms until reaching 0.
- **Lines 120–128:** `useEffect` subscribing to deep link auth errors, populating `codeError` with translated error strings.
- **Lines 130–159:** `useEffect` for session polling and auth state change subscription:
  - Polls `getSupabase().auth.getSession()` every 3000ms.
  - Listens to `onAuthStateChange` to invoke `onConfirmed()` immediately once a session is established.
- **Lines 160–204:** `useEffect` for multi-device confirmation polling (when `password` is provided):
  - Periodically attempts `signIn(email, password)` every 10 seconds.
  - If signed in and `user.email_confirmed_at` is populated, calls `onConfirmed()`.
  - If signed in but unconfirmed, calls `signOut()` immediately.
  - *Rate limit rationale:* Uses 10s interval to prevent exceeding Supabase sign-in rate limits (30 attempts / 5 mins).
- **Lines 205–233:** `handleConfirmCode()`: validates 6-digit code via `confirmationCodeSchema`, executes `confirmSignUpWithCode`, sets errors or calls `onConfirmed()`.
- **Lines 234–270:** `handleAlreadyConfirmed()`: fallback action when email link was clicked in external browser. Attempts sign-in, validates `email_confirmed_at`, and signs out if unconfirmed.
- **Lines 272–297:** `handleResend()`: executes `resendConfirmationEmail`, presents informational status (noting Supabase returns 200 regardless of account existence to prevent email enumeration), and sets 60-second cooldown timer.
- **Lines 299–420:** Rendered JSX structure:
  - Animated hero badge with glowing pulse ring and envelope icon.
  - Live status header with pulsing indicator dot and "Bestätigung ausstehend".
  - Styled email capsule badge displaying current email.
  - Detailed explanation text.
  - 6-digit code entry `TextField` (restricting input to digits only) and "Bestätigen" `Button`.
  - Dynamic resend feedback text.
  - Action buttons: "Bestätigungs-E-Mail erneut senden" (with cooldown countdown), "Jetzt prüfen" (if password exists), and "Andere E-Mail-Adresse verwenden".
- **Lines 421–495:** `styles` object created via `StyleSheet.create` for cards, hero elements, live dots, code inputs, and button spacing.

---

## 4. `src/features/auth/forgot-password-screen.tsx`

### File Overview
`forgot-password-screen.tsx` provides the screen component for requesting a password reset email.

### Line-by-Line / Section Breakdown

- **Lines 1–12:** Component imports (`router` from `expo-router`, `useState`, components `Button`, `Card`, `Screen`, `TextField`, `ThemedText`, `Spacing`, auth API functions, and schema validators).
- **Lines 14–20:** `ForgotPasswordScreen` component state initialization (`email`, `errors`, `formError`, `loading`, `sent`).
- **Lines 21–42:** `handleSubmit()`:
  - Validates email with `resetRequestSchema`.
  - Invokes `requestPasswordReset(parsed.data.email)`.
  - Sets `formError` on failure or sets `sent` state to `true`.
- **Lines 44–62:** Conditional rendered JSX when email has been sent (`sent === true`):
  - Displays neutral card text (`"Falls es zu ... ein Konto gibt..."`) designed to prevent email enumeration disclosure.
  - Renders button navigating back to login screen (`router.replace('/sign-in')`).
- **Lines 64–96:** Main form rendered JSX:
  - `Screen` container titled `"Passwort zurücksetzen"`.
  - `Card` holding email `TextField` with keyboard settings (`autoComplete="email"`, `keyboardType="email-address"`).
  - Error text display.
  - Submit button `"Link anfordern"`.
  - Secondary `"Zurück"` button triggering `router.back()`.
- **Lines 98–100:** `styles` definition specifying form item gap.

---

## 5. `src/features/auth/onboarding/step-create-household.tsx`

### File Overview
`step-create-household.tsx` manages Step 5 of the onboarding process, allowing users to create a new household or redeem pending household invitations.

### Line-by-Line / Section Breakdown

- **Lines 1–15:** Imports React hooks, React Native UI components, design system elements, household API query and mutation hooks (`useHouseholds`, `useCreateHouseholdMutation`, `useRedeemInviteMutation`), and `consumePendingInviteToken`.
- **Lines 16–26:** `StepCreateHousehold({ onNext })` declaration and internal state (`householdName`, `householdError`, `redeeming`, `redeemedStatus`).
- **Lines 27–43:** `useEffect` hook handling pending invite tokens:
  - Checks if user does not already belong to a household (`!currentHousehold`).
  - Calls `consumePendingInviteToken()` and automatically redeems the token via `redeemInviteMutation.mutateAsync()`.
- **Lines 45–67:** `handleCreateHousehold()`:
  - Advances immediately (`onNext()`) if user is already in a household.
  - Validates non-empty household name input.
  - Triggers `createHouseholdMutation.mutateAsync(trimmed)` and advances on success.
- **Lines 69–125:** Rendered JSX structure:
  - `Card` titled `"Schritt 5: Haushalt"`.
  - If `currentHousehold` exists: displays green success banner with household name and `"Weiter zu Schritt 6"` button.
  - If no household: displays invite redemption status or instructions, `TextField` for household name, error display, and `"Haushalt erstellen & weiter"` button with loading indicators.
- **Lines 127–144:** `styles` definition for form layout and success banner styling.

---

## 6. `src/features/auth/onboarding/step-household-info.tsx`

### File Overview
`step-household-info.tsx` renders Step 3 of onboarding, presenting information about shared household features.

### Line-by-Line / Section Breakdown

- **Lines 1–6:** Imports `StyleSheet`, `View`, `Card`, `ThemedText`, and `Spacing`.
- **Lines 7–35:** `StepHouseholdInfo` component rendering informational feature rows:
  - Introductory subtitle text.
  - Feature Row 1 (👥): `"Haushalt erstellen oder beitreten"` detailing invitation code functionality.
  - Feature Row 2 (📱): `"Gleichzeitiges Abgleichen"` detailing multi-device real-time synchronization.
- **Lines 37–54:** `styles` definition for list layout, row alignment, feature icons, and flex container text.

---

## 7. `src/features/auth/onboarding/step-indicator.tsx`

### File Overview
`step-indicator.tsx` renders horizontal progress indicator dots reflecting the active step in the multi-step onboarding wizard.

### Line-by-Line / Section Breakdown

- **Lines 1–5:** Imports `StyleSheet`, `View`, `Spacing`, and `useTheme`.
- **Lines 6–16:** `StepIndicator({ currentStep, totalSteps = 6 })` declaration, acquiring theme and generating step IDs (`step-1` to `step-6`).
- **Lines 18–34:** Rendered dot mapping:
  - Determines if dot `i + 1` matches `currentStep`.
  - Applies dynamic width (22 for active, 8 for inactive) and background color (`theme.accent` for active, `theme.border` for inactive).
- **Lines 38–50:** `styles` definition centering dot containers with rounded border radius.

---

## 8. `src/features/auth/onboarding/step-inventory.tsx`

### File Overview
`step-inventory.tsx` renders Step 2 of onboarding, highlighting inventory management and expiration date tracking capabilities.

### Line-by-Line / Section Breakdown

- **Lines 1–6:** Imports `StyleSheet`, `View`, `Card`, `ThemedText`, and `Spacing`.
- **Lines 7–35:** `StepInventory` component rendering feature cards:
  - Feature Row 1 (📍): `"Vordefinierte Lagerorte"` (fridge, freezer, pantry).
  - Feature Row 2 (⏰): `"MHD-Erinnerungen"` (quick expiration date buttons and visual indicators).
- **Lines 37–54:** `styles` definition configuring feature row layout and typography styling.

---

## 9. `src/features/auth/onboarding/step-profile.tsx`

### File Overview
`step-profile.tsx` renders Step 6 of onboarding, presenting optional form fields for user profile metadata (display name, birth date, height, sex, activity level) used for calorie estimation.

### Line-by-Line / Section Breakdown

- **Lines 1–9:** Imports `Pressable`, `StyleSheet`, `View`, UI components (`Card`, `TextField`, `ThemedText`), `Spacing`, `getDeviceDateFormat`, and `useTheme`.
- **Lines 10–16:** `ACTIVITY_LEVELS` constant array defining 5 activity tiers (`sedentary`, `light`, `moderate`, `active`, `very_active`) with German labels.
- **Lines 18–21:** `SEX_OPTIONS` constant array defining sex options (`male`, `female`) for BMR calculation logic.
- **Lines 23–59:** `ChoiceRow<T>` generic component rendering multi-select pill buttons:
  - Uses `Pressable` with accessibility attributes (`accessibilityRole="radio"`, `accessibilityState={{ selected }}`).
  - Dynamic pill styling based on selection state (`theme.accent` background when selected).
- **Lines 61–85:** `StepProfile` props signature accepting profile fields and error record.
- **Lines 86–130:** Rendered JSX structure:
  - First `Card` titled `"Schritt 6: Dein Profil (Optional)"`: contains inputs for Name, Birth date (with dynamic localized placeholder from `getDeviceDateFormat()`), and Height in cm.
  - Second `Card` titled `"Berechnungsbasis"`: contains sex choice row.
  - Third `Card` titled `"Aktivitätslevel"`: contains activity level choice row.
- **Lines 132–151:** `styles` definition for form fields, choice containers, and selected pill text styling.

---

## 10. `src/features/auth/onboarding/step-welcome.tsx`

### File Overview
`step-welcome.tsx` renders Step 1 of onboarding, providing an introductory overview of app capabilities.

### Line-by-Line / Section Breakdown

- **Lines 1–6:** Imports `StyleSheet`, `View`, `Card`, `ThemedText`, and `Spacing`.
- **Lines 7–45:** `StepWelcome` component rendering welcome card with feature rows:
  - Feature Row 1 (🧊): `"Vorräte im Blick"` (fridge and pantry management).
  - Feature Row 2 (🛒): `"Geteilte Einkaufsliste"` (shared real-time shopping list).
  - Feature Row 3 (🔄): `"Offline & Sync"` (offline-first architecture with background sync).
- **Lines 47–64:** `styles` definition for layout gap and flex layout styling.

---

## 11. `src/features/auth/onboarding-session.ts`

### File Overview
`onboarding-session.ts` manages the dual-tier tracking state (in-memory vs. `SecureStore`) determining whether a user has completed or seen onboarding.

### Line-by-Line / Section Breakdown

- **Lines 1–17:** Architectural comment detailing dual-tier persistence:
  1. *In-Memory Flag (`completedInCurrentSession`):* Prevents an active logged-in user from seeing onboarding repeatedly during a single app session.
  2. *SecureStore Flag (`fam_onboarding_completed_v1`):* Differentiates a brand-new installation (no flag -> show onboarding) from an existing logged-out user (flag present -> show login screen).
- **Lines 19–21:** Imports `expo-secure-store` and defines constant `ONBOARDING_KEY = 'fam_onboarding_completed_v1'`.
- **Lines 23–32:** `completedInCurrentSession` module variable and helper functions `markOnboardingSessionCompleted()` and `isOnboardingSessionCompleted()`.
- **Lines 34–46:** `export async function persistOnboardingCompleted(): Promise<void>`
  - Marks in-memory flag completed.
  - Persists `'true'` to `SecureStore` under `ONBOARDING_KEY`. Includes graceful catch fallback.
- **Lines 48–60:** `export async function hasSeenOnboarding(): Promise<boolean>`
  - Reads `ONBOARDING_KEY` from `SecureStore` and returns `true` if stored value is `'true'`. Returns `false` on missing key or read failure.

---

## 12. `src/features/auth/reset-password-screen.tsx`

### File Overview
`reset-password-screen.tsx` provides the password update screen target after a user opens a password reset deep link.

### Line-by-Line / Section Breakdown

- **Lines 1–13:** Imports `router` from `expo-router`, `useState`, components `Button`, `Card`, `Screen`, `TextField`, `ThemedText`, `Spacing`, auth API `updatePassword`, `authErrorMessage`, `newPasswordSchema`, and `fieldErrors`.
- **Lines 14–21:** Component doc comment noting Supabase establishes a recovery session when opening the reset deep link, allowing `updateUser` to succeed directly.
- **Lines 22–28:** `ResetPasswordScreen` component state initialization (`password`, `passwordConfirmation`, `errors`, `formError`, `loading`).
- **Lines 29–51:** `handleSubmit()`:
  - Validates inputs via `newPasswordSchema`.
  - Executes `updatePassword(parsed.data.password)`.
  - Sets translated error message on failure or replaces route to root `/` on success.
- **Lines 53–91:** Rendered JSX structure:
  - `Screen` titled `"Neues Passwort"`.
  - `Card` holding secure text entry `TextField`s for new password and password confirmation.
  - Error feedback text.
  - Submit button `"Passwort speichern"`.
- **Lines 93–95:** `styles` definition specifying form layout gap.

---

## 13. `src/features/auth/session-provider.tsx`

### File Overview
`session-provider.tsx` creates and manages the React Context state for user sessions and onboarding status, coordinating application boot state.

### Line-by-Line / Section Breakdown

- **Lines 1–6:** Imports Supabase `Session` type, React Context primitives (`createContext`, `use`, `useEffect`, `useState`), `getSupabase`, `startSupabaseAutoRefresh`, and `hasSeenOnboarding`.
- **Lines 7–25:** `type SessionState` definition:
  - `session`: active Supabase session or `null`.
  - `isLoading`: boolean indicating whether session or onboarding flags are still loading.
  - `seenOnboarding`: boolean flag retrieved from `hasSeenOnboarding()`.
  - `error`: initialization error or `null`.
- **Lines 27–36:** `SessionContext` creation and `useSession()` custom hook export.
- **Lines 38–45:** `SessionProvider` component state initialization with `isLoading: true`.
- **Lines 46–58:** `useEffect` initialization: gets Supabase client. Catches missing env vars or missing native `SecureStore` modules gracefully without crashing application boot.
- **Lines 60–75:** Executes `Promise.all` reading `getSupabase().auth.getSession()` and `hasSeenOnboarding()` in parallel before clearing `isLoading` state.
- **Lines 77–83:** Registers Supabase `onAuthStateChange` listener to update active session state across auth events (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`).
- **Lines 85:** Starts Supabase background token refresh loop via `startSupabaseAutoRefresh()`.
- **Lines 87–91:** Cleanup function unsubscribing auth listener and stopping token auto-refresh loop.
- **Lines 94:** Renders `SessionContext` provider wrapping `children`.

---

## 14. `src/features/auth/sign-in-screen.tsx`

### File Overview
`sign-in-screen.tsx` provides the primary authentication screen for existing users to sign in via email/password or OAuth providers (Apple, Google).

### Line-by-Line / Section Breakdown

- **Lines 1–13:** Imports `Link` from `expo-router`, React hooks, React Native components (`KeyboardAvoidingView`, `Platform`, `StyleSheet`, `View`), custom UI components (`Button`, `Card`, `Screen`, `TextField`, `ThemedText`), `Spacing`, auth API functions (`signIn`, `signInWithOAuthProvider`, `authErrorMessage`), and `signInSchema`.
- **Lines 14–20:** `SignInScreen` state initialization (`email`, `password`, `errors`, `formError`, `loading`).
- **Lines 21–43:** `handleSubmit()`:
  - Validates credentials using `signInSchema`.
  - Calls `signIn(parsed.data.email, parsed.data.password)`.
  - Sets translated `formError` on failure.
- **Lines 45–127:** Rendered JSX structure:
  - `Screen` titled `"Anmelden"`.
  - `KeyboardAvoidingView` configured for iOS padding.
  - `Card` holding email `TextField`, password `TextField`, error text, submit button `"Anmelden"`.
  - Divider text `"oder anmelden mit"`.
  - OAuth login buttons (`" Mit Apple anmelden"`, `"🌐 Mit Google anmelden"`).
  - Navigation links to registration (`/sign-up`) and password recovery (`/forgot-password`).
- **Lines 129–142:** `styles` definition for form gap, divider centering, and navigation links.

---

## 15. `src/features/auth/sign-out.ts`

### File Overview
`sign-out.ts` provides the comprehensive user logout workflow, performing server-side session revocation and local data cleanup.

### Line-by-Line / Section Breakdown

- **Lines 1–5:** Imports `QueryClient` type, `signOut` function from `api.ts`, and `deleteLocalDatabase` from `lib/db/client`.
- **Lines 6–12:** Architectural comment explaining logout execution order: server logout must execute **before** local data deletion to ensure a network error does not leave a cleared local app state with a valid server session.
- **Lines 13–21:** `export async function signOutAndClearLocalData(queryClient: QueryClient)`
  - Calls `await signOut()`. If server logout returns an error, returns `{ error }` immediately to prevent premature data wipe.
- **Lines 22–27:** Calls `queryClient.clear()` to erase in-memory React Query cache, preventing previous user data from rendering for a subsequent login on the same device.
- **Lines 29–44:** Local SQLite database cleanup:
  - Calls `await deleteLocalDatabase()` inside a try-catch block.
  - Catches database deletion errors gracefully and logs warning (`'[auth] lokale Datenbank nicht geloescht:'`). *Design rationale:* A database deletion failure must not fail the overall logout process, as the session is already invalidated server-side.
  - Returns `{ error: null }`.

---

## 16. `src/features/auth/sign-up-screen.tsx`

### File Overview
`sign-up-screen.tsx` provides the account registration screen supporting email/password registration, OAuth authentication, and pending verification banner integration.

### Line-by-Line / Section Breakdown

- **Lines 1–14:** Component imports including `router` from `expo-router`, React hooks, React Native UI components, custom design system components, auth API functions (`signUp`, `signInWithOAuthProvider`), schema helpers (`signUpSchema`, `fieldErrors`), and `PendingAuthBanner`.
- **Lines 15–23:** `SignUpScreen` state initialization (`email`, `password`, `passwordConfirmation`, `errors`, `formError`, `loading`, `pendingEmail`).
- **Lines 24–53:** `handleSubmit()`:
  - Validates registration fields with `signUpSchema`.
  - Executes `signUp(parsed.data.email, parsed.data.password)`.
  - Handles error via `authErrorMessage(error)`.
  - If no immediate session returned (`!data.session`), sets `pendingEmail` state to trigger verification banner view.
  - If session returned, replaces route to `/onboarding`.
- **Lines 55–66:** Conditional rendered JSX when verification is pending (`pendingEmail !== null`):
  - Renders `PendingAuthBanner` wrapped in `Screen` container titled `"Konto aktivieren"`.
- **Lines 68–156:** Main form rendered JSX structure:
  - `Screen` titled `"Konto erstellen"`.
  - `KeyboardAvoidingView` handling keyboard offsets.
  - `Card` containing `TextField` inputs for email, password, and password confirmation.
  - Form error display and submit button `"Konto erstellen"`.
  - Divider text and Apple / Google OAuth buttons.
  - Secondary note clarifying data privacy (shared inventory vs. private health metrics).
  - Secondary button navigating to existing login (`router.replace('/sign-in')`).
- **Lines 158–166:** `styles` definition configuring form spacing and divider alignment.
