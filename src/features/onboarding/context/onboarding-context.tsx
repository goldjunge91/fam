import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { markOnboardingCompleted, updateProfile } from '@/features/auth/api';
import { persistOnboardingCompleted } from '@/features/auth/onboarding-session';
import { useSession } from '@/features/auth/session-provider';
import { saveModulePreferences } from '@/features/settings/module-preferences';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getSupabase } from '@/lib/supabase';
import { triggerHouseholdsPull } from '@/lib/sync/household-bootstrap-sync';

import type {
  HouseholdOnboardingData,
  ModulePreferencesData,
  OnboardingProfileData,
  OnboardingState,
  PermissionsOnboardingData,
} from '../types';

interface OnboardingContextType {
  state: OnboardingState;
  updateProfileData: (data: Partial<OnboardingProfileData>) => void;
  updateHouseholdData: (data: Partial<HouseholdOnboardingData>) => void;
  updateModulesData: (data: Partial<ModulePreferencesData>) => void;
  updatePermissionsData: (data: Partial<PermissionsOnboardingData>) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  /** `true`, wenn alles gespeichert wurde. Nur dann darf weiternavigiert werden. */
  completeOnboarding: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

const initialOnboardingState: OnboardingState = {
  currentStep: 1,
  profile: {},
  household: { choice: 'solo' },
  modules: {
    fridge: true,
    shoppingList: true,
    calories: true,
    recipes: true,
    mealPlanner: true,
  },
  permissions: {
    notificationsRequested: false,
    cameraRequested: false,
  },
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [state, setState] = useState<OnboardingState>(initialOnboardingState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfileData = (data: Partial<OnboardingProfileData>) => {
    setState((prev) => ({ ...prev, profile: { ...prev.profile, ...data } }));
  };

  const updateHouseholdData = (data: Partial<HouseholdOnboardingData>) => {
    setState((prev) => ({ ...prev, household: { ...prev.household, ...data } }));
  };

  const updateModulesData = (data: Partial<ModulePreferencesData>) => {
    setState((prev) => ({ ...prev, modules: { ...prev.modules, ...data } }));
  };

  const updatePermissionsData = (data: Partial<PermissionsOnboardingData>) => {
    setState((prev) => ({ ...prev, permissions: { ...prev.permissions, ...data } }));
  };

  const setStep = (step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  };

  const nextStep = () => {
    setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
  };

  const prevStep = () => {
    setState((prev) => ({ ...prev, currentStep: Math.max(1, prev.currentStep - 1) }));
  };

  const completeOnboarding = async (): Promise<boolean> => {
    // Ohne Session gibt es nichts zu speichern — und `create_household` ist
    // nur an `authenticated` vergeben, der Aufruf endete in
    // "permission denied for function create_household". Frueher lief die
    // Funktion hier still ins Leere und der Aufrufer navigierte trotzdem
    // weiter.
    if (!session) {
      setError('Du bist nicht angemeldet. Bitte melde dich zuerst an.');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Save profile data if filled
      if (Object.keys(state.profile).length > 0) {
        const { error: profileErr } = await updateProfile(session.user.id, {
          displayName: state.profile.displayName,
          birthDate: state.profile.birthDate,
          heightCm: state.profile.heightCm,
          sex: state.profile.sex,
          activityLevel: state.profile.activityLevel,
        });

        if (profileErr) {
          setError(profileErr.message);
          setIsLoading(false);
          return false;
        }
      }

      // 1b. Modul-Auswahl speichern (#95) — anders als der Profil-Block oben
      // immer, da state.modules ueber den Default-State immer alle fuenf Keys
      // traegt (nie "leer"). Ohne diesen Aufruf verwirft completeOnboarding
      // die Auswahl aus ModuleSelectorForm bisher stillschweigend.
      const { error: modulesErr } = await saveModulePreferences(session.user.id, state.modules);
      if (modulesErr) {
        setError(modulesErr.message);
        setIsLoading(false);
        return false;
      }

      // 2. Failsafe Household-Prüfung: Stellt sicher, dass der Nutzer in der DB mindestens einem Haushalt angehört
      const supabase = getSupabase();
      const { data: existingHouseholds, error: hhErr } = await supabase
        .from('households')
        .select('id')
        .limit(1);

      if (hhErr) {
        console.warn('Hinweis beim Prüfen bestehender Haushalte:', hhErr.message);
      }

      if (!existingHouseholds || existingHouseholds.length === 0) {
        if (state.household.choice === 'create') {
          const name = state.household.name?.trim() || 'Mein Haushalt';
          const { error: createErr } = await supabase.rpc('create_household', {
            household_name: name,
          });
          if (createErr) {
            setError(`Fehler beim Erstellen des Haushalts: ${createErr.message}`);
            setIsLoading(false);
            return false;
          }
        } else if (state.household.choice === 'join' && state.household.inviteCode) {
          const { error: redeemErr } = await supabase.rpc('redeem_invite', {
            invite_token: state.household.inviteCode,
          });
          if (redeemErr) {
            setError(`Fehler beim Einlösen des Einladungscodes: ${redeemErr.message}`);
            setIsLoading(false);
            return false;
          }
        } else {
          const { error: createErr } = await supabase.rpc('create_household', {
            household_name: 'Mein Haushalt',
          });
          if (createErr) {
            setError(`Fehler beim Erstellen des Haushalts: ${createErr.message}`);
            setIsLoading(false);
            return false;
          }
        }
      }

      // Der Haushalt entstand gerade per RPC, nicht ueber die Mutation aus
      // `household/api.ts` — der lokale Spiegel weiss also nichts davon. Ohne
      // diesen Pull sieht der angemeldete Bereich weiterhin null Haushalte
      // (liest nur den bisherigen lokalen Stand) und schickt den Nutzer
      // direkt wieder ins Anlege-Formular, aus dem er gerade kam.
      await triggerHouseholdsPull(session.user.id, queryClient);

      // Markiert das Konto serverseitig als fertig onboarded (`profiles.onboarding_completed_at`).
      // Ohne diesen Aufruf blieb die Spalte fuer immer `null` — der Guard in
      // `(app)/_layout.tsx` erkennt den Nutzer dann nur so lange als fertig
      // an, wie das In-Memory-Flag aus `persistOnboardingCompleted()` lebt,
      // und schickt ihn nach jedem Hot Reload/Neustart zurueck ins Onboarding.
      const { error: markCompletedErr } = await markOnboardingCompleted(session.user.id);
      if (markCompletedErr) {
        setError(markCompletedErr.message);
        setIsLoading(false);
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });

      // Onboarding-Flag persistieren
      await persistOnboardingCompleted();
      trackAnalyticsEvent('onboarding_completed');
      setIsLoading(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
      setIsLoading(false);
      return false;
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        updateProfileData,
        updateHouseholdData,
        updateModulesData,
        updatePermissionsData,
        setStep,
        nextStep,
        prevStep,
        completeOnboarding,
        isLoading,
        error,
      }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding muss innerhalb von OnboardingProvider verwendet werden');
  }
  return context;
}
