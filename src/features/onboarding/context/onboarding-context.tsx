import { createContext, type ReactNode, useContext, useState } from 'react';
import { updateProfile } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-provider';
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
  completeOnboarding: () => Promise<void>;
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
  },
  permissions: {
    notificationsRequested: false,
    cameraRequested: false,
  },
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
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

  const completeOnboarding = async () => {
    if (!session) return;
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
          return;
        }
      }
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
      setIsLoading(false);
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
