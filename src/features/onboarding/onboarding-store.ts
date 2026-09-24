import { useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { useSession } from '@/features/auth/session-provider';
import { createWeightEntry, latestWeightEntryQueryKey } from '@/features/calorie-tracking/api';
import { markOnboardingCompleted } from '@/features/onboarding/api';
import { persistOnboardingCompleted } from '@/features/onboarding/onboarding-completion';
import { updateProfile } from '@/features/profile/api';
import { saveModulePreferences } from '@/features/settings/module-preferences';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { debugWarn } from '@/lib/observability/debug-log';
import { triggerHouseholdsPull } from '@/lib/sync/household-bootstrap-sync';
import type {
  HouseholdOnboardingData,
  ModulePreferencesData,
  OnboardingProfileData,
  OnboardingState,
  PermissionsOnboardingData,
} from './types';

const initialState: OnboardingState = {
  currentStep: 1,
  profile: {},
  household: { choice: 'solo' },
  modules: { fridge: true, shoppingList: true, calories: true, recipes: true, mealPlanner: true },
  permissions: {
    notificationsRequested: false,
    cameraRequested: false,
    microphoneRequested: false,
    locationRequested: false,
  },
};

interface OnboardingStore {
  state: OnboardingState;
  isLoading: boolean;
  error: string | null;
  updateProfileData: (data: Partial<OnboardingProfileData>) => void;
  updateHouseholdData: (data: Partial<HouseholdOnboardingData>) => void;
  updateModulesData: (data: Partial<ModulePreferencesData>) => void;
  updatePermissionsData: (data: Partial<PermissionsOnboardingData>) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStatus: (status: { isLoading?: boolean; error?: string | null }) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  state: initialState,
  isLoading: false,
  error: null,
  updateProfileData: (data) =>
    set(({ state }) => ({ state: { ...state, profile: { ...state.profile, ...data } } })),
  updateHouseholdData: (data) =>
    set(({ state }) => ({ state: { ...state, household: { ...state.household, ...data } } })),
  updateModulesData: (data) =>
    set(({ state }) => ({ state: { ...state, modules: { ...state.modules, ...data } } })),
  updatePermissionsData: (data) =>
    set(({ state }) => ({ state: { ...state, permissions: { ...state.permissions, ...data } } })),
  setStep: (step) => set(({ state }) => ({ state: { ...state, currentStep: step } })),
  nextStep: () => set(({ state }) => ({ state: { ...state, currentStep: state.currentStep + 1 } })),
  prevStep: () =>
    set(({ state }) => ({ state: { ...state, currentStep: Math.max(1, state.currentStep - 1) } })),
  setStatus: (status) => set(status),
  reset: () => set({ state: initialState, isLoading: false, error: null }),
}));

export function useOnboarding() {
  const store = useOnboardingStore();
  const { session } = useSession();
  const queryClient = useQueryClient();

  async function completeOnboarding(): Promise<boolean> {
    if (!session) {
      store.setStatus({ error: 'Du bist nicht angemeldet. Bitte melde dich zuerst an.' });
      return false;
    }
    store.setStatus({ isLoading: true, error: null });
    try {
      const state = useOnboardingStore.getState().state;
      const profileData = {
        displayName: state.profile.displayName,
        birthDate: state.profile.birthDate,
        heightCm: state.profile.heightCm,
        weightKg: state.profile.weightKg,
        sex: state.profile.sex,
        activityLevel: state.profile.activityLevel,
      };
      const hasProfileData = Object.values(profileData).some((value) => value !== undefined);
      if (hasProfileData) {
        const { error } = await updateProfile(session.user.id, profileData);
        if (error) throw error;
      }
      if (state.profile.weightKg !== undefined) {
        await createWeightEntry({ userId: session.user.id, weightKg: state.profile.weightKg });
        await queryClient.invalidateQueries({
          queryKey: latestWeightEntryQueryKey(session.user.id),
        });
      }
      const { error: modulesError } = await saveModulePreferences(session.user.id, state.modules);
      if (modulesError) throw modulesError;
      const supabase = getSupabase();
      const { data: households, error: householdError } = await supabase
        .from('households')
        .select('id')
        .limit(1);
      if (householdError) debugWarn('Hinweis beim Prüfen bestehender Haushalte:', householdError);
      if (!households?.length) {
        const request =
          state.household.choice === 'join' && state.household.inviteCode
            ? supabase.rpc('redeem_invite', { invite_token: state.household.inviteCode })
            : supabase.rpc('create_household', {
                household_name:
                  state.household.choice === 'create'
                    ? state.household.name?.trim() || 'Mein Haushalt'
                    : 'Mein Haushalt',
              });
        const { error } = await request;
        if (error) throw error;
      }
      await triggerHouseholdsPull(session.user.id, queryClient);
      const { error } = await markOnboardingCompleted(session.user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
      await persistOnboardingCompleted();
      trackAnalyticsEvent('onboarding.flow.completed');
      store.setStatus({ isLoading: false });
      return true;
    } catch (error) {
      store.setStatus({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Fehler beim Speichern',
      });
      return false;
    }
  }

  return { ...store, completeOnboarding };
}
