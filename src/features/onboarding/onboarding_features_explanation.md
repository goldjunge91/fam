# Dokumentation & Zeilenweise Erklärung: `src/features/onboarding`

Diese Dokumentation enthält eine lückenlose Erklärung aller 13 Dateien im Modul `src/features/onboarding`. Jede Datei ist in Blöcke und Zeilen unterteilt, inklusive Funktionsbeschreibung und Zweck im Gesamtkontext der App.

---

## Inhaltsverzeichnis

1. [`types.ts`](#1-typests)
2. [`onboarding.test.ts`](#2-onboardingtestts)
3. [`context/onboarding-context.tsx`](#3-contextonboarding-contexttsx)
4. [`onboarding-flow.tsx`](#4-onboarding-flowtsx)
5. [`onboarding-flow.test.tsx`](#5-onboarding-flowtesttsx)
6. [`components/welcome-carousel.tsx`](#6-componentswelcome-carouseltsx)
7. [`components/account-step.tsx`](#7-componentsaccount-steptsx)
8. [`components/account-step.test.tsx`](#8-componentsaccount-steptesttsx)
9. [`components/profile-step-form.tsx`](#9-componentsprofile-step-formtsx)
10. [`components/household-step.tsx`](#10-componentshousehold-steptsx)
11. [`components/module-selector.tsx`](#11-componentsmodule-selectortsx)
12. [`components/permissions-step.tsx`](#12-componentspermissions-steptsx)
13. [`components/complete-step.tsx`](#13-componentscomplete-steptsx)

---

## 1. `types.ts`
**Pfad:** `src/features/onboarding/types.ts`  
**Zweck:** Definierung aller TypeScript-Typen, Interfaces und Aufzählungen, die im gesamten Onboarding-Prozess für Zustand und Formulardaten genutzt werden.

```typescript
1: export type SexOption = 'male' | 'female';
2: 
3: export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
4: 
5: export type WeightGoal = 'lose_fast' | 'lose' | 'maintain' | 'gain' | 'gain_fast';
```
- **Zeile 1:** `SexOption`: Beschränkt die Option für das biologische Geschlecht auf `'male'` oder `'female'` zur Berechnung des Grundumsatzes (BMR).
- **Zeile 3:** `ActivityLevel`: Definiert 5 Stufen der Alltagsaktivität (sitzend bis sehr aktiv) für den Leistungsumsatz.
- **Zeile 5:** `WeightGoal`: Definiert das Gewichtsziel des Nutzers (schnell abnehmen, abnehmen, halten, zunehmen, schnell zunehmen).

```typescript
7: export interface OnboardingProfileData {
8:   displayName?: string;
9:   birthDate?: string;
10:  heightCm?: number;
11:  weightKg?: number;
12:  goalWeightKg?: number;
13:  sex?: SexOption;
14:  activityLevel?: ActivityLevel;
15:  weightGoal?: WeightGoal;
16: }
```
- **Zeilen 7–16:** Interface für die eingegebenen Profildaten im Schritt 3. Alle Felder sind optional (`?`), da dieser Schritt übersprungen werden kann.

```typescript
18: export type HouseholdChoice = 'create' | 'join' | 'solo';
19: 
20: export interface HouseholdOnboardingData {
21:   choice: HouseholdChoice;
22:   name?: string;
23:   inviteCode?: string;
24: }
```
- **Zeile 18:** `HouseholdChoice`: Drei Wege beim Haushalt (`create` = neu erstellen, `join` = beitreten, `solo` = alleine nutzen).
- **Zeilen 20–24:** `HouseholdOnboardingData`: Hält die getroffene Wahl sowie optional den eingegebenen Haushaltsnamen oder Einladungscode.

```typescript
26: export interface ModulePreferencesData {
27:   fridge: boolean;
28:   shoppingList: boolean;
29:   calories: boolean;
30:   recipes: boolean;
31: }
```
- **Zeilen 26–31:** Booleans für die 4 Hauptmodule der App. Legt fest, welche Features der Nutzer aktivieren möchte.

```typescript
33: export interface PermissionsOnboardingData {
34:   notificationsRequested: boolean;
35:   cameraRequested: boolean;
36: }
```
- **Zeilen 33–36:** Status der angeforderten Geräteberechtigungen (Push-Benachrichtigungen und Kamera).

```typescript
38: export interface OnboardingState {
39:   currentStep: number;
40:   profile: OnboardingProfileData;
41:   household: HouseholdOnboardingData;
42:   modules: ModulePreferencesData;
43:   permissions: PermissionsOnboardingData;
44: }
```
- **Zeilen 38–44:** Der zentrale Gesamtzustand des Onboardings, der alle Teilschritte und Daten sowie die aktuelle Schrittnummer (`currentStep`) vereint.

---

## 2. `onboarding.test.ts`
**Pfad:** `src/features/onboarding/onboarding.test.ts`  
**Zweck:** Unit-Tests für Plausibilitätsprüfungen und Standardwerte der Onboarding-Typen.

```typescript
1: import { describe, expect, test } from '@jest/globals';
2: import type {
3:   HouseholdOnboardingData,
4:   ModulePreferencesData,
5:   OnboardingProfileData,
6: } from './types';
```
- **Zeilen 1–6:** Import von Jest Testfunktionen und den Onboarding-Typen.

```typescript
8: describe('Onboarding State Validation', () => {
9:   test('Profil-Körperwerte Plausibilität', () => {
10:     const validProfile: OnboardingProfileData = {
11:       displayName: 'Max',
12:       heightCm: 180,
13:       weightKg: 75,
14:       sex: 'male',
15:       activityLevel: 'moderate',
16:     };
17: 
18:     expect(validProfile.heightCm).toBeGreaterThanOrEqual(50);
19:     expect(validProfile.heightCm).toBeLessThanOrEqual(250);
20:     expect(validProfile.weightKg).toBeGreaterThanOrEqual(20);
21:     expect(validProfile.weightKg).toBeLessThanOrEqual(300);
22:   });
```
- **Zeilen 8–22:** Prüft, ob valide Körperwerte für Größe (50–250 cm) und Gewicht (20–300 kg) den Plausibilitätsgrenzen entsprechen.

```typescript
24:   test('Haushalt Setup Standard-Werte', () => {
25:     const defaultHousehold: HouseholdOnboardingData = {
26:       choice: 'solo',
27:     };
28: 
29:     expect(defaultHousehold.choice).toBe('solo');
30:     expect(defaultHousehold.name).toBeUndefined();
31:   });
```
- **Zeilen 24–31:** Verifiziert, dass die Standardauswahl für den Haushalt auf `'solo'` steht und kein Name gesetzt ist.

```typescript
33:   test('Modulpräferenzen sind standardmäßig alle aktiv', () => {
34:     const defaultModules: ModulePreferencesData = {
35:       fridge: true,
36:       shoppingList: true,
37:       calories: true,
38:       recipes: true,
39:     };
40: 
41:     expect(defaultModules.fridge).toBe(true);
42:     expect(defaultModules.shoppingList).toBe(true);
43:     expect(defaultModules.calories).toBe(true);
44:     expect(defaultModules.recipes).toBe(true);
45:   });
46: });
```
- **Zeilen 33–46:** Prüft, ob nach Standard alle vier Module (`fridge`, `shoppingList`, `calories`, `recipes`) aktiviert sind.

---

## 3. `context/onboarding-context.tsx`
**Pfad:** `src/features/onboarding/context/onboarding-context.tsx`  
**Zweck:** React Context & Provider zur Verwaltung des Onboarding-Zustands über alle Schritte hinweg sowie Ausführung des finalen Speicherns in Supabase.

```typescript
1: import { createContext, type ReactNode, useContext, useState } from 'react';
2: import { updateProfile } from '@/features/auth/api';
3: import { persistOnboardingCompleted } from '@/features/auth/onboarding-session';
4: import { useSession } from '@/features/auth/session-provider';
5: import { getSupabase } from '@/lib/supabase';
6: import type { ... } from '../types';
```
- **Zeilen 1–12:** Importiert React-Hooks, Supabase-Funktionen zum Speichern des Profils/Haushalts sowie die lokal definierten Typen.

```typescript
14: interface OnboardingContextType {
15:   state: OnboardingState;
16:   updateProfileData: (data: Partial<OnboardingProfileData>) => void;
17:   updateHouseholdData: (data: Partial<HouseholdOnboardingData>) => void;
18:   updateModulesData: (data: Partial<ModulePreferencesData>) => void;
19:   updatePermissionsData: (data: Partial<PermissionsOnboardingData>) => void;
20:   setStep: (step: number) => void;
21:   nextStep: () => void;
22:   prevStep: () => void;
23:   completeOnboarding: () => Promise<void>;
24:   isLoading: boolean;
25:   error: string | null;
26: }
```
- **Zeilen 14–26:** Schnittstelle des Contexts, welche Funktionen zum Updaten von Daten/Schritten sowie Lade- und Fehlerzustände definiert.

```typescript
28: const initialOnboardingState: OnboardingState = {
29:   currentStep: 1,
30:   profile: {},
31:   household: { choice: 'solo' },
32:   modules: { fridge: true, shoppingList: true, calories: true, recipes: true },
33:   permissions: { notificationsRequested: false, cameraRequested: false },
34: };
35: 
36: const OnboardingContext = createContext<OnboardingContextType | null>(null);
```
- **Zeilen 28–44:** Erstellt den initialen Zustand (Schritt 1, Solo-Haushalt, alle Module an) und initialisiert den React Context.

```typescript
46: export function OnboardingProvider({ children }: { children: ReactNode }) {
47:   const { session } = useSession();
48:   const [state, setState] = useState<OnboardingState>(initialOnboardingState);
49:   const [isLoading, setIsLoading] = useState(false);
50:   const [error, setError] = useState<string | null>(null);
```
- **Zeilen 46–50:** Provider-Komponente für den Zustand; holt die aktuelle User-Session.

```typescript
52:   const updateProfileData = (data: Partial<OnboardingProfileData>) => {
53:     setState((prev) => ({ ...prev, profile: { ...prev.profile, ...data } }));
54:   };
55:   const updateHouseholdData = ...
56:   const updateModulesData = ...
57:   const updatePermissionsData = ...
```
- **Zeilen 52–66:** Immutables Aktualisieren der jeweiligen Teilzustände (`profile`, `household`, `modules`, `permissions`).

```typescript
68:   const setStep = (step: number) => setState((prev) => ({ ...prev, currentStep: step }));
72:   const nextStep = () => setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
76:   const prevStep = () => setState((prev) => ({ ...prev, currentStep: Math.max(1, prev.currentStep - 1) }));
```
- **Zeilen 68–78:** Navigationshelfer zum Vor- und Zurückblättern oder direkten Anspringen eines Schritts.

```typescript
80:   const completeOnboarding = async () => {
81:     if (!session) return;
82:     setIsLoading(true);
83:     setError(null);
84: 
85:     try {
86:       // 1. Save profile data if filled
87:       if (Object.keys(state.profile).length > 0) {
88:         const { error: profileErr } = await updateProfile(session.user.id, {
89:           displayName: state.profile.displayName,
90:           birthDate: state.profile.birthDate,
91:           heightCm: state.profile.heightCm,
92:           sex: state.profile.sex,
93:           activityLevel: state.profile.activityLevel,
94:         });
95:         if (profileErr) { setError(profileErr.message); setIsLoading(false); return; }
96:       }
```
- **Zeilen 80–101:** `completeOnboarding`: Speichert zuerst die eingegebenen Profildaten in der Datenbank (`updateProfile`), sofern welche angegeben wurden.

```typescript
103:      // 2. Failsafe Household-Prüfung
104:      const supabase = getSupabase();
105:      const { data: existingHouseholds, error: hhErr } = await supabase
106:        .from('households')
107:        .select('id')
108:        .limit(1);
109:
114:      if (!existingHouseholds || existingHouseholds.length === 0) {
115:        if (state.household.choice === 'create') {
116:          const name = state.household.name?.trim() || 'Mein Haushalt';
117:          const { error: createErr } = await supabase.rpc('create_household', { household_name: name });
118:          if (createErr) { setError(...); setIsLoading(false); return; }
125:        } else if (state.household.choice === 'join' && state.household.inviteCode) {
126:          const { error: redeemErr } = await supabase.rpc('redeem_invite', { invite_token: state.household.inviteCode });
127:          if (redeemErr) { setError(...); setIsLoading(false); return; }
134:        } else {
135:          const { error: createErr } = await supabase.rpc('create_household', { household_name: 'Mein Haushalt' });
136:          if (createErr) { setError(...); setIsLoading(false); return; }
143:        }
144:      }
```
- **Zeilen 103–144:** Prüft defensiv, ob der User bereits in einem Haushalt ist. Falls nicht, ruft es je nach Auswahl die Supabase-RPC-Funktionen `create_household` oder `redeem_invite` auf.

```typescript
147:      await persistOnboardingCompleted();
148:      setIsLoading(false);
149:    } catch (e) { ... }
153:  };
```
- **Zeilen 147–153:** Setzt das lokale Flag `onboarding_completed` in AsyncStorage/SecureStore, damit beim nächsten App-Start nicht erneut das Onboarding aufgerufen wird.

```typescript
155:  return (
156:    <OnboardingContext.Provider value={{ state, ... }}>
170:      {children}
171:    </OnboardingContext.Provider>
172:  );
173: }
175: export function useOnboarding() {
176:   const context = useContext(OnboardingContext);
177:   if (!context) throw new Error('useOnboarding muss innerhalb von OnboardingProvider verwendet werden');
178:   return context;
179: }
```
- **Zeilen 155–181:** Stellt den Context-Provider für Kind-Komponenten bereit und exportiert den Custom-Hook `useOnboarding`.

---

## 4. `onboarding-flow.tsx`
**Pfad:** `src/features/onboarding/onboarding-flow.tsx`  
**Zweck:** Hauptkomponente für das Onboarding. Verwaltet die Fortschrittsanzeige, den Notausstieg/Abmelden-Button und rendert den jeweils aktiven Schritt (1–7).

```typescript
1: import { useQueryClient } from '@tanstack/react-query';
2: import { Pressable, StyleSheet, Text, View } from 'react-native';
3: import { Screen } from '@/components/screen';
...
15: import { OnboardingProvider, useOnboarding } from './context/onboarding-context';
```
- **Zeilen 1–15:** Importiert UI-Komponenten, Hooks, Notausstiegsfunktionen und alle 7 Schritt-Komponenten.

```typescript
17: const TOTAL_STEPS = 7;
```
- **Zeile 17:** Definiert die Gesamtanzahl der Schritte im Onboarding (7).

```typescript
19: function OnboardingContent() {
20:   const theme = useTheme();
21:   const { session } = useSession();
22:   const queryClient = useQueryClient();
23:   const { state, setStep, nextStep } = useOnboarding();
24:   const currentStep = state.currentStep;
```
- **Zeilen 19–24:** Innere Komponente; holt Theme, Session, QueryClient und den aktuellen Schrittzustand.

```typescript
26:   // Notausstieg (#128): Abmelden wenn der Account in ungültigem Zustand steckt
32:   async function handleEmergencySignOut() {
33:     await signOutAndClearLocalData(queryClient);
34:     setStep(1);
35:   }
```
- **Zeilen 26–35:** Ermöglicht dem Nutzer ein sofortiges Abmelden, falls er in Schritt 2 feststeckt oder mit falschem Konto angemeldet ist.

```typescript
38:   <Screen title={currentStep === 1 ? 'Willkommen' : `Schritt ${currentStep} von ${TOTAL_STEPS}`}>
39:     {currentStep > 1 && currentStep < TOTAL_STEPS && (
40:       <View style={styles.progressContainer}>
41:         <View style={styles.progressRow}>
42:           {Array.from({ length: TOTAL_STEPS }).map((_, idx) => {
43:             const stepNum = idx + 1;
44:             const active = stepNum <= currentStep;
45:             return <View key={stepNum} style={[styles.progressBar, { backgroundColor: active ? theme.accent : theme.border }]} />;
46:           })}
47:         </View>
58:         {session && (
59:           <Pressable onPress={handleEmergencySignOut} style={styles.signOutLink}>
60:             <Text style={[styles.signOutText, { color: theme.textSecondary }]}>Nicht du? Abmelden und neu starten</Text>
61:           </Pressable>
62:         )}
63:       </View>
64:     )}
```
- **Zeilen 38–66:** Rendert den Titel in der Headerbar sowie zwischen Schritt 2 und 6 die Balken-Fortschrittsanzeige (Progress-Bar) und den Abmelde-Link.

```typescript
68:     {currentStep === 1 && <WelcomeCarousel onStart={() => setStep(2)} />}
69:     {currentStep === 2 && <AccountStepForm onNext={() => setStep(3)} />}
70:     {currentStep === 3 && <ProfileStepForm onNext={nextStep} onSkip={nextStep} />}
71:     {currentStep === 4 && <HouseholdStepForm onNext={nextStep} onSkip={nextStep} />}
72:     {currentStep === 5 && <ModuleSelectorForm onNext={nextStep} onSkip={nextStep} />}
73:     {currentStep === 6 && <PermissionsStepForm onNext={nextStep} onSkip={nextStep} />}
74:     {currentStep === 7 && <CompleteStepForm />}
75:   </Screen>
```
- **Zeilen 68–75:** Bedingtes Rendering des jeweiligen Schrittes anhand von `currentStep`.

```typescript
79: export function OnboardingFlow() {
80:   return (
81:     <OnboardingProvider>
82:       <OnboardingContent />
83:     </OnboardingProvider>
84:   );
85: }
```
- **Zeilen 79–85:** Haupt-Export; umschließt den `OnboardingContent` mit dem `OnboardingProvider`.

```typescript
87: const styles = StyleSheet.create({ ... });
```
- **Zeilen 87–110:** Stile für Fortschrittsbalken, Abmelde-Link und Abstände.

---

## 5. `onboarding-flow.test.tsx`
**Pfad:** `src/features/onboarding/onboarding-flow.test.tsx`  
**Zweck:** Integrationstest für das Zusammenspiel der Onboarding-Schritte, insbesondere zur Vermeidung des "Bruchteil-Sekunden-Bugs" beim E-Mail-Bewerbungsprozess.

```typescript
1: import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
2: import { fireEvent, render, screen } from '@testing-library/react-native';
3: import { SafeAreaProvider } from 'react-native-safe-area-context';
4: import { OnboardingFlow } from './onboarding-flow';
```
- **Zeilen 1–5:** Import der Testing-Tools und der Onboarding-Komponente.

```typescript
6: const initialMetrics = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
```
- **Zeilen 6–9:** Mocking-Werte für `SafeAreaProvider`.

```typescript
11: const mockSignUp = jest.fn();
12: const mockSignIn = jest.fn();
17: let capturedAuthStateCallback: ((event: string, session: unknown) => void) | undefined;
18: const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null } });
```
- **Zeilen 11–18:** Variablen zum Einfangen des Auth-State-Callbacks und Steuern des Session-Status.

```typescript
20: jest.mock('expo-router', () => ({ ... }));
27: jest.mock('@/features/auth/api', () => ({ ... }));
36: jest.mock('@/features/auth/onboarding-session', () => ({ ... }));
44: jest.mock('@/lib/supabase', () => ({ ... }));
```
- **Zeilen 20–55:** Mocks für Router, Auth-API, Session-Persistierung und Supabase Auth Callbacks.

```typescript
56: async function renderFlow() { ... }
67: async function advanceToPendingConfirmation() { ... }
```
- **Zeilen 56–80:** Helferfunktionen zum Aufbauen des Flow-Wrappers und Durchklicken bis zum Warteraum (E-Mail Bestätigung ausstehend).

```typescript
82: describe('OnboardingFlow — Bestaetigung waehrend Schritt 2 (#Bruchteil-Sekunde-Bug)', () => {
95:   it('landet bei Schritt 3 (ProfileStepForm), wenn onAuthStateChange und der 3s-Session-Poll gleichzeitig feuern', async () => {
96:     jest.useFakeTimers();
98:     await advanceToPendingConfirmation();
...
105:    capturedAuthStateCallback?.('SIGNED_IN', confirmedSession);
106:    await jest.advanceTimersByTimeAsync(3000);
108:    expect(await screen.findByText('Schritt 3 von 7')).toBeTruthy();
109:    expect(screen.queryByText('Schritt 4 von 7')).toBeNull();
110:    expect(screen.queryByText('Schritt 5 von 7')).toBeNull();
111:  });
112: });
```
- **Zeilen 82–113:** Testet, dass die Anwendung exakt bei Schritt 3 landet und nicht versehentlich Schritte überspringt, wenn Auth-Event und Polling zeitgleich eintreffen.

---

## 6. `components/welcome-carousel.tsx`
**Pfad:** `src/features/onboarding/components/welcome-carousel.tsx`  
**Zweck:** Schritt 1 des Onboardings: Ein Willkommens-Karussell mit 3 Folien zur Vorstellung der Kern-Features.

```typescript
7: const SLIDES = [
8:   { id: 'slide-1', icon: '🏠', title: 'Haushalt & Vorrat an einem Ort', description: '...' },
15:  { id: 'slide-2', icon: '🛒', title: 'Geteilte Einkaufsliste', description: '...' },
22:  { id: 'slide-3', icon: '🍎', title: 'Privates Kalorien-Tracking', description: '...' },
29: ];
```
- **Zeilen 7–29:** Array mit den 3 Karussell-Folien (Icons, Titel, Beschreibungstexte).

```typescript
31: interface WelcomeCarouselProps {
32:   onStart: () => void;
33: }
34: 
35: export function WelcomeCarousel({ onStart }: WelcomeCarouselProps) {
36:   const [slideIndex, setSlideIndex] = useState(0);
37:   const theme = useTheme();
38: 
39:   const isLast = slideIndex === SLIDES.length - 1;
40:   const current = SLIDES[slideIndex];
```
- **Zeilen 31–40:** Komponente verwaltet den lokalen Index `slideIndex`. Prüft, ob die letzte Folie erreicht ist.

```typescript
43:   return (
44:     <View style={styles.container}>
45:       <View style={[styles.iconContainer, { backgroundColor: theme.backgroundElement }]}>
46:         <Text style={styles.iconText}>{current.icon}</Text>
47:       </View>
48:       <Text style={[styles.title, { color: theme.text }]}>{current.title}</Text>
50:       <Text style={[styles.description, { color: theme.textSecondary }]}>{current.description}</Text>
```
- **Zeilen 43–53:** Rendert das große Icon, den Titel und die Beschreibung der aktuellen Folie.

```typescript
54:       <View style={styles.paginationRow}>
55:         {SLIDES.map((slide, idx) => (
56:           <Pressable
57:             key={slide.id}
58:             onPress={() => setSlideIndex(idx)}
59:             style={[styles.dot, { backgroundColor: idx === slideIndex ? theme.accent : theme.border, width: idx === slideIndex ? 24 : 8 }]}
66:           />
67:         ))}
68:       </View>
```
- **Zeilen 54–68:** Klickbare Pagination-Punkte (Dots) am unteren Rand. Der aktive Punkt breitet sich auf 24px Ausdehnung aus.

```typescript
70:       <View style={styles.buttonContainer}>
71:         {isLast ? (
72:           <Button label="Jetzt starten" onPress={onStart} />
73:         ) : (
74:           <Button label="Weiter" onPress={() => setSlideIndex((prev) => Math.min(SLIDES.length - 1, prev + 1))} />
78:         )}
79:       </View>
```
- **Zeilen 70–79:** Rendert den Button *"Weiter"* bei den ersten zwei Folien und den Button *"Jetzt starten"* auf der letzten Folie.

```typescript
84: const styles = StyleSheet.create({ ... });
```
- **Zeilen 84–128:** Styling der Folien, Ziffern, Abstände und Buttons.

---

## 7. `components/account-step.tsx`
**Pfad:** `src/features/onboarding/components/account-step.tsx`  
**Zweck:** Schritt 2 des Onboardings: Registrieren oder Anmelden des Nutzers oder Anzeige des aktiven Kontos.

```typescript
11: interface AccountStepFormProps {
12:   onNext: () => void;
13: }
14: 
15: export function AccountStepForm({ onNext }: AccountStepFormProps) {
16:   const { session } = useSession();
17:   const theme = useTheme();
18:   const [authMode, setAuthMode] = useState<'sign_up' | 'sign_in'>('sign_up');
19:   const [authEmail, setAuthEmail] = useState('');
20:   const [authPassword, setAuthPassword] = useState('');
21:   const [authLoading, setAuthLoading] = useState(false);
22:   const [authError, setAuthError] = useState<string | null>(null);
23:   const [pendingEmail, setPendingEmail] = useState<string | null>(null);
```
- **Zeilen 11–24:** Zustand für Auth-Modus (Registrierung/Login), Formularfelder, Ladezustand, Fehler und ausstehende E-Mail-Bestätigung.

```typescript
26:   async function handleAuthSubmit() {
27:     if (authLoading) return;
28:     setAuthError(null);
29:     if (!authEmail.trim() || !authPassword) {
30:       setAuthError('Bitte E-Mail und Passwort eingeben.');
31:       return;
32:     }
34:     setAuthLoading(true);
35:     const result = authMode === 'sign_up' ? await signUp(authEmail.trim(), authPassword) : await signIn(authEmail.trim(), authPassword);
39:     setAuthLoading(false);
41:     if (result.error) { setAuthError(authErrorMessage(result.error)); return; }
48:     if (authMode === 'sign_up' && !result.data?.session) {
49:       setPendingEmail(authEmail.trim());
50:       return;
51:     }
53:     onNext();
54:   }
```
- **Zeilen 26–54:** Führt Registrierung oder Login durch. Ist eine E-Mail-Bestätigung erforderlich (keine direkte Session), wird `pendingEmail` gesetzt.

```typescript
56:   if (pendingEmail) {
57:     return (
58:       <View style={styles.container}>
59:         <PendingAuthBanner email={pendingEmail} password={authPassword} onConfirmed={onNext} onChangeEmail={() => setPendingEmail(null)} />
65:       </View>
66:     );
67:   }
```
- **Zeilen 56–67:** Zeigt das `PendingAuthBanner` (Warteraum auf E-Mail-Bestätigung), solange der Account noch nicht per Link oder Code bestätigt wurde.

```typescript
76:   {session ? (
77:     <View style={styles.activeContainer}>
78:       <View style={[styles.activeBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
83:         <Text style={[styles.activeTitle, { color: theme.accent }]}>✓ Angemeldet als: {session.user.email}</Text>
84:         <Text style={[styles.activeDesc, { color: theme.textSecondary }]}>Dein Account ist aktiv...</Text>
89:       </View>
91:       <Button label="Weiter" onPress={onNext} />
92:     </View>
93:   ) : ( ... )}
```
- **Zeilen 76–93:** Wenn der Nutzer bereits angemeldet ist, wird ein Status-Banner mit seiner E-Mail-Adresse und ein einfacher *"Weiter"* Button angezeigt.

```typescript
94:   <View style={styles.form}>
95:     <View style={[styles.tabToggle, { borderColor: theme.border }]}>
96:       <Pressable onPress={() => setAuthMode('sign_up')} style={[styles.tabButton, authMode === 'sign_up' && { backgroundColor: theme.accent }]}>
97:         <Text style={...}>Registrieren</Text>
98:       </Pressable>
110:      <Pressable onPress={() => setAuthMode('sign_in')} style={[styles.tabButton, authMode === 'sign_in' && { backgroundColor: theme.accent }]}>
111:        <Text style={...}>Anmelden</Text>
112:      </Pressable>
124:    </View>
126:    <TextField label="E-Mail Adresse" value={authEmail} onChangeText={setAuthEmail} ... />
135:    <TextField label="Passwort" value={authPassword} onChangeText={setAuthPassword} secureTextEntry ... />
144:    {authError && <Text style={{ color: theme.danger, fontSize: 13 }}>{authError}</Text>}
146:    <Button label={authMode === 'sign_up' ? 'Konto erstellen & weiter' : 'Anmelden & weiter'} onPress={handleAuthSubmit} loading={authLoading} />
151:  </View>
```
- **Zeilen 94–154:** Rendert den Tab-Umschalter (Registrieren vs. Anmelden), die Textfelder für E-Mail & Passwort sowie den Submit-Button.

```typescript
157: const styles = StyleSheet.create({ ... });
```
- **Zeilen 157–207:** Stylesheet für Layout, Eingabefelder und Buttons.

---

## 8. `components/account-step.test.tsx`
**Pfad:** `src/features/onboarding/components/account-step.test.tsx`  
**Zweck:** Unit-Tests für das `AccountStepForm` bezüglich Warteraum-Verhalten und erfolgreichem Anmelden.

```typescript
1: import { fireEvent, render, screen } from '@testing-library/react-native';
2: import { AccountStepForm } from './account-step';
...
13: jest.mock('@/features/auth/components/pending-auth-banner', () => ({ ... }));
```
- **Zeilen 1–34:** Importe und Mocks für Auth API, PendingAuthBanner, SessionProvider und Theme.

```typescript
35: async function fillAndSubmit() {
36:   await fireEvent.changeText(screen.getByLabelText('E-Mail Adresse'), 'family@example.com');
37:   await fireEvent.changeText(screen.getByLabelText('Passwort'), 'supersecret');
38:   await fireEvent.press(screen.getByRole('button', { name: 'Konto erstellen & weiter' }));
39: }
```
- **Zeilen 35–39:** Helfer zum Ausfüllen der Textfelder und Drücken des Registrierungs-Buttons.

```typescript
41: describe('AccountStepForm', () => {
47:   it('zeigt den Warteraum statt onNext aufzurufen, wenn sign_up ohne Session zurueckkommt', async () => {
48:     mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
49:     const onNext = jest.fn();
51:     await render(<AccountStepForm onNext={onNext} />);
52:     await fillAndSubmit();
54:     expect(await screen.findByText('Warteraum: family@example.com')).toBeTruthy();
55:     expect(onNext).not.toHaveBeenCalled();
56:   });
```
- **Zeilen 47–56:** Testet, dass bei ausstehender E-Mail-Bestätigung das Warteraum-Banner erscheint und `onNext` noch nicht ausgelöst wird.

```typescript
58:   it('ruft onNext auf, wenn sign_up direkt eine Session liefert', async () => {
59:     mockSignUp.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
60:     const onNext = jest.fn();
62:     await render(<AccountStepForm onNext={onNext} />);
63:     await fillAndSubmit();
65:     expect(onNext).toHaveBeenCalled();
66:   });
67: });
```
- **Zeilen 58–67:** Testet, dass `onNext` sofort aufgerufen wird, wenn direkt eine Session vorhanden ist.

---

## 9. `components/profile-step-form.tsx`
**Pfad:** `src/features/onboarding/components/profile-step-form.tsx`  
**Zweck:** Schritt 3 des Onboardings: Erfassung von Körperdaten (Rufname, Geburtsdatum, Größe, Gewicht, Geschlecht, Ernährungsziel, Aktivitätslevel).

```typescript
12: const SEX_OPTIONS: { value: SexOption; label: string }[] = [...];
17: const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [...];
24: const GOAL_OPTIONS: { value: WeightGoal; label: string }[] = [...];
```
- **Zeilen 12–28:** Optionstabellen für Geschlecht, Aktivitätslevel und Ernährungsziel.

```typescript
35: export function ProfileStepForm({ onNext, onSkip }: ProfileStepFormProps) {
...
41:   const [displayName, setDisplayName] = useState(state.profile.displayName ?? '');
42:   const [birthDate, setBirthDate] = useState(state.profile.birthDate ?? '');
43:   const [heightCm, setHeightCm] = useState(state.profile.heightCm?.toString() ?? '');
44:   const [weightKg, setWeightKg] = useState(state.profile.weightKg?.toString() ?? '');
45:   const [sex, setSex] = useState<SexOption | undefined>(state.profile.sex);
46:   const [activityLevel, setActivityLevel] = useState<ActivityLevel | undefined>(state.profile.activityLevel);
49:   const [weightGoal, setWeightGoal] = useState<WeightGoal | undefined>(state.profile.weightGoal);
51:   const [errors, setErrors] = useState<Record<string, string>>({});
```
- **Zeilen 35–51:** Komponenten-State für alle Formularfelder, initialisiert aus dem Onboarding-Context.

```typescript
53:   useEffect(() => {
54:     if (userProfile) {
55:       if (userProfile.display_name) setDisplayName((prev) => prev || userProfile.display_name || '');
58:       if (userProfile.birth_date) setBirthDate((prev) => prev || userProfile.birth_date || '');
61:       if (userProfile.height_cm) setHeightCm((prev) => prev || String(userProfile.height_cm));
64:       if (userProfile.sex) setSex((prev) => prev || (userProfile.sex as SexOption));
67:       if (userProfile.activity_level) setActivityLevel((prev) => prev || (userProfile.activity_level as ActivityLevel));
70:     }
71:   }, [userProfile]);
```
- **Zeilen 53–71:** `useEffect`: Lädt vorausgefüllte Profildaten aus der Datenbank (falls bereits vorhanden), überschreibt jedoch keine vom Nutzer neu eingegebenen Werte.

```typescript
73:   const handleSubmit = () => {
74:     const newErrors: Record<string, string> = {};
76:     if (heightCm.trim()) {
77:       const h = Number(heightCm.replace(',', '.'));
78:       if (Number.isNaN(h) || h < 50 || h > 250) {
79:         newErrors.heightCm = 'Bitte eine verlässliche Größe (50–250 cm) eingeben';
80:       }
81:     }
83:     if (weightKg.trim()) {
84:       const w = Number(weightKg.replace(',', '.'));
85:       if (Number.isNaN(w) || w < 20 || w > 300) {
86:         newErrors.weightKg = 'Bitte ein verlässliches Gewicht (20–300 kg) eingeben';
87:       }
88:     }
90:     if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
95:     updateProfileData({ ... });
105:    onNext();
106:  };
```
- **Zeilen 73–106:** Validiert Größe und Gewicht, wandelt Kommas in Punkte um, updated den Context und ruft `onNext()` auf.

```typescript
109:  return (
110:    <View style={styles.container}>
116:      <TextField label="Rufname / Anzeigename" value={displayName} onChangeText={setDisplayName} ... />
123:      <TextField label="Geburtsdatum (JJJJ-MM-TT)" value={birthDate} onChangeText={setBirthDate} ... />
131:      <View style={styles.inputRow}>
133:        <TextField label="Größe (cm)" value={heightCm} onChangeText={setHeightCm} ... />
144:        <TextField label="Gewicht (kg)" value={weightKg} onChangeText={setWeightKg} ... />
154:      </View>
```
- **Zeilen 109–154:** Rendert Eingabefelder für Name, Geburtsdatum sowie zweispaltig Größe und Gewicht.

```typescript
156:      <Text style={...}>Berechnungsbasis (Geschlecht)</Text>
159:      <View style={styles.sexRow}>{SEX_OPTIONS.map(...)}</View>
181:      <Text style={...}>Ernährungsziel</Text>
182:      <View style={styles.goalStack}>{GOAL_OPTIONS.map(...)}</View>
204:      <Text style={...}>Aktivitätslevel im Alltag</Text>
205:      <View style={styles.activityStack}>{ACTIVITY_OPTIONS.map(...)}</View>
```
- **Zeilen 156–226:** Auswahllisten/Karten für Geschlecht, Ernährungsziel und Aktivitätslevel.

```typescript
228:      <View style={styles.buttonRow}>
230:        <Button label="Weiter" onPress={handleSubmit} />
233:        <Button label="Später ausfüllen" variant="secondary" onPress={onSkip} />
235:      </View>
238:  );
```
- **Zeilen 228–238:** Buttons für Weiter oder Überspringen (*"Später ausfüllen"*).

---

## 10. `components/household-step.tsx`
**Pfad:** `src/features/onboarding/components/household-step.tsx`  
**Zweck:** Schritt 4 des Onboardings: Haushalt erstellen, einem bestehenden Haushalt per Code beitreten oder alleine fortfahren.

```typescript
20: export function HouseholdStepForm({ onNext, onSkip }: HouseholdStepFormProps) {
23:   const { data: households } = useHouseholds();
24:   const activeHousehold = households?.[0];
26:   const createHouseholdMutation = useCreateHouseholdMutation();
27:   const redeemInviteMutation = useRedeemInviteMutation();
29:   const [choice, setChoice] = useState<HouseholdChoice>(...);
32:   const [householdName, setHouseholdName] = useState(state.household.name ?? '');
33:   const [inviteCode, setInviteCode] = useState(state.household.inviteCode ?? '');
34:   const [errorMsg, setErrorMsg] = useState<string | null>(null);
```
- **Zeilen 20–36:** Bindet Haushalt-Mutationen ein und hält Eingaben für Name und Einladungscode.

```typescript
38:   const handleNext = async () => {
39:     setErrorMsg(null);
41:     updateHouseholdData({ choice, name: ..., inviteCode: ... });
47:     if (activeHousehold) { onNext(); return; }
52:     try {
53:       if (choice === 'create') {
55:         await createHouseholdMutation.mutateAsync(name);
56:       } else if (choice === 'join') {
62:         await redeemInviteMutation.mutateAsync(code);
63:       } else if (choice === 'solo') {
64:         await createHouseholdMutation.mutateAsync('Mein Haushalt');
65:       }
66:       onNext();
67:     } catch (err) { ... }
74:   };
```
- **Zeilen 38–74:** Verarbeitet die Haushaltsentscheidung. Ruft bei Bedarf direkt die Mutation zum Erstellen (`create_household`) oder Beitreten (`redeem_invite`) auf.

```typescript
84:   {activeHousehold ? (
85:     <View style={styles.activeCard}>
90:       <Text style={styles.activeBadge}>✓ Aktiver Haushalt erkannt</Text>
91:       <Text style={styles.activeTitle}>{activeHousehold.name}</Text>
92:     </View>
93:   ) : null}
```
- **Zeilen 84–93:** Hebt einen bereits in der Datenbank existierenden Haushalt des Nutzers grün hervor.

```typescript
95:   <View style={styles.choiceList}>
96:     {/* Karte: Neuen Haushalt erstellen */}
118:    {/* Karte: Einem Haushalt beitreten */}
139:    {/* Karte: Vorerst alleine nutzen */}
164:  </View>
```
- **Zeilen 95–164:** 3 klickbare Auswahlkarten für Erstellen, Beitreten oder Solo-Nutzung.

```typescript
166:  {choice === 'create' && <TextField label="Name deines Haushalts" value={householdName} onChangeText={setHouseholdName} ... />}
176:  {choice === 'join' && <TextField label="6-stelliger Einladungscode" value={inviteCode} onChangeText={setInviteCode} ... />}
```
- **Zeilen 166–185:** Rendert dynamisch das passende Textfeld je nach ausgewählter Option.

```typescript
193:  <View style={styles.buttonRow}>
195:    <Button label="Weiter" onPress={handleNext} loading={isPending} />
198:    <Button label="Überspringen" variant="secondary" onPress={onSkip} disabled={isPending} />
200:  </View>
```
- **Zeilen 193–200:** Weiter- und Überspringen-Buttons mit Ladezustand.

---

## 11. `components/module-selector.tsx`
**Pfad:** `src/features/onboarding/components/module-selector.tsx`  
**Zweck:** Schritt 5 des Onboardings: Auswahl und Aktivierung der gewünschten App-Module (Vorrat, Einkaufsliste, Kalorienzähler, Rezepte).

```typescript
12: export function ModuleSelectorForm({ onNext, onSkip }: ModuleSelectorFormProps) {
13:   const theme = useTheme();
14:   const { state, updateModulesData } = useOnboarding();
16:   const toggle = (key: keyof typeof state.modules) => {
17:     updateModulesData({ [key]: !state.modules[key] });
18:   };
```
- **Zeilen 12–18:** `toggle`: Schaltet den Boolean des jeweiligen Moduls um und speichert ihn im Onboarding-Context.

```typescript
27:   <View style={styles.moduleList}>
28:     {/* Modul 1: Kühlschrank & Vorrat */}
38:     <Text style={...}>🧊 Kühlschrank & Vorrat</Text>
43:     <Switch value={state.modules.fridge} onValueChange={() => toggle('fridge')} />
46:     {/* Modul 2: Geteilte Einkaufsliste */}
57:     <Text style={...}>🛒 Geteilte Einkaufsliste</Text>
63:     <Switch value={state.modules.shoppingList} onValueChange={() => toggle('shoppingList')} />
66:     {/* Modul 3: Kalorienzähler & Tagebuch */}
76:     <Text style={...}>🍎 Kalorienzähler & Tagebuch</Text>
83:     <Switch value={state.modules.calories} onValueChange={() => toggle('calories')} />
86:     {/* Modul 4: Rezept-Manager & Meal-Planner */}
96:     <Text style={...}>📖 Rezept-Manager & Meal-Planner</Text>
103:    <Switch value={state.modules.recipes} onValueChange={() => toggle('recipes')} />
105:  </View>
```
- **Zeilen 27–105:** Rendert 4 klickbare Zeilen inklusive Schalter (`Switch`) für die Aktivierung/Deaktivierung der Module.

```typescript
107:  <View style={styles.buttonRow}>
109:    <Button label="Weiter" onPress={onNext} />
112:    <Button label="Überspringen" variant="secondary" onPress={onSkip} />
114:  </View>
```
- **Zeilen 107–114:** Standard Navigationselemente für Vorwärts und Überspringen.

---

## 12. `components/permissions-step.tsx`
**Pfad:** `src/features/onboarding/components/permissions-step.tsx`  
**Zweck:** Schritt 6 des Onboardings: Anforderung von System-Berechtigungen (Benachrichtigungen für Mindesthaltbarkeitsdatum und Kamera für Barcode/QR-Scanner).

```typescript
9: // Defensiver Import: expo-camera ist nur in einem nativen Dev-Build verfügbar.
11: let requestCameraPermissionsAsync: any = null;
12: try {
13:   const ExpoCamera = require('expo-camera');
14:   if (ExpoCamera?.requestCameraPermissionsAsync) {
15:     requestCameraPermissionsAsync = ExpoCamera.requestCameraPermissionsAsync;
16:   }
17: } catch { requestCameraPermissionsAsync = null; }
```
- **Zeilen 9–19:** Defensiver `require`-Aufruf von `expo-camera`. Verhindert Abstürze im Webbrowser oder in Umgebungen, in denen Native Modules nicht verfügbar sind.

```typescript
26: export function PermissionsStepForm({ onNext, onSkip }: PermissionsStepFormProps) {
30:   const [notifications, setNotifications] = useState(state.permissions.notificationsRequested ?? true);
33:   const [camera, setCamera] = useState(state.permissions.cameraRequested ?? true);
```
- **Zeilen 26–34:** Hält den Schalter-Status für Benachrichtigungen und Kamera.

```typescript
35:   const handlePermissions = async () => {
37:     if (camera && requestCameraPermissionsAsync) {
38:       try { await requestCameraPermissionsAsync(); } catch {}
43:     }
46:     if (notifications) {
47:       try { await requestNotificationPermissions(); } catch {}
52:     }
54:     updatePermissionsData({ notificationsRequested: notifications, cameraRequested: camera });
58:     onNext();
59:   };
```
- **Zeilen 35–59:** Löst beim Klicken auf *"Festlegen & Weiter"* den echten System-Dialog für Kamera und Push-Benachrichtigungen aus (mit Try-Catch Abfederung).

```typescript
68:   <View style={styles.permissionList}>
80:     <Text style={...}>🔔 Benachrichtigungen</Text>
85:     <Switch value={notifications} onValueChange={setNotifications} />
100:    <Text style={...}>📷 Kamera-Zugriff</Text>
105:    <Switch value={camera} onValueChange={setCamera} />
108:  </View>
```
- **Zeilen 68–108:** Klickbare Karten mit Switchen für Benachrichtigungen und Kamera.

```typescript
110:  <View style={styles.buttonRow}>
112:    <Button label="Festlegen & Weiter" onPress={handlePermissions} />
115:    <Button label="Jetzt nicht" variant="secondary" onPress={onSkip} />
117:  </View>
```
- **Zeilen 110–117:** Aktions-Buttons zum Speichern der Rechte oder Überspringen (*"Jetzt nicht"*).

---

## 13. `components/complete-step.tsx`
**Pfad:** `src/features/onboarding/components/complete-step.tsx`  
**Zweck:** Schritt 7 des Onboardings: Abschluss-Screen, der den Nutzer beglückwünscht, das Onboarding über den Context in Supabase speichert und auf das Dashboard navigiert.

```typescript
9: export function CompleteStepForm() {
10:   const theme = useTheme();
11:   const { state, completeOnboarding, isLoading, error } = useOnboarding();
12:   const { data: households } = useHouseholds();
```
- **Zeilen 9–12:** Holen des Onboarding-Contexts und des aktuellen Haushalts.

```typescript
14:   const handleFinish = async () => {
15:     await completeOnboarding();
16:     router.replace('/');
17:   };
```
- **Zeilen 14–17:** `handleFinish`: Ruft `completeOnboarding()` auf (speichert Profil/Haushalt & setzt Onboarding-Flag) und leitet den Nutzer mit `router.replace('/')` zum Hauptscreen um.

```typescript
19:   const householdName =
20:     households?.[0]?.name ||
21:     (state.household.choice === 'create'
22:       ? state.household.name || 'deinen neuen Haushalt'
23:       : state.household.choice === 'join'
24:         ? 'deinen Haushalt'
25:         : 'deinen persönlichen Bereich');
```
- **Zeilen 19–25:** Ermittelt dynamisch den Haushaltsnamen für den Willkommenstext.

```typescript
27:   return (
28:     <View style={styles.container}>
30:       <Text style={styles.icon}>🎉</Text>
33:       <Text style={[styles.heading, { color: theme.text }]}>Alles bereit!</Text>
34:       <Text style={[styles.subheading, { color: theme.textSecondary }]}>
35:         {`Dein Profil ist eingerichtet und du bist startklar für ${householdName}.`}
36:       </Text>
38:       {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}
40:       <View style={styles.buttonContainer}>
41:         <Button
42:           label={isLoading ? 'Speichern...' : 'Zum Dashboard'}
43:           onPress={handleFinish}
44:           loading={isLoading}
45:         />
46:       </View>
47:     </View>
48:   );
49: }
```
- **Zeilen 27–49:** Rendert das Konfetti-Icon 🎉, die Bestätigungsmeldung, eventuelle Fehler beim Speichern sowie den Button *"Zum Dashboard"*.

```typescript
51: const styles = StyleSheet.create({ ... });
```
- **Zeilen 51–88:** Zentrierendes Layout-Styling für den Abschluss-Bildschirm.
