export type SexOption = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type WeightGoal = 'lose_fast' | 'lose' | 'maintain' | 'gain' | 'gain_fast';

export interface OnboardingProfileData {
  displayName?: string;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  goalWeightKg?: number;
  sex?: SexOption;
  activityLevel?: ActivityLevel;
  weightGoal?: WeightGoal;
}

export type HouseholdChoice = 'create' | 'join' | 'solo';

export interface HouseholdOnboardingData {
  choice: HouseholdChoice;
  name?: string;
  inviteCode?: string;
}

export interface ModulePreferencesData {
  fridge: boolean;
  shoppingList: boolean;
  calories: boolean;
  recipes: boolean;
}

export interface PermissionsOnboardingData {
  notificationsRequested: boolean;
  cameraRequested: boolean;
}

export interface OnboardingState {
  currentStep: number;
  profile: OnboardingProfileData;
  household: HouseholdOnboardingData;
  modules: ModulePreferencesData;
  permissions: PermissionsOnboardingData;
}
