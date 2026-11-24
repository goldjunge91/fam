/**
 * Zentrale Quelle fuer die statische Beschreibung aller App-Features und
 * Top-Level-Module: Schluessel, Titel, Routen, Remote-Flags und Einstellungen.
 *
 * Laufzeitwerte gehoeren nicht hierher. Nutzerentscheidungen kommen aus
 * `module-preferences.ts`, lokale Entwickler-Overrides aus `dev-settings.ts`.
 */
import type { FamIconName } from '@/components/icons/fam-icon';
import type { SpeedDialColorKey } from '@/components/theme/index';
import type { MealType } from '@/features/calorie-tracking/api';
import type { ModulePreferences } from '@/features/settings/module-preferences';
import type { FeatureFlagKey } from '@/lib/observability/providers/posthog';

/** Lokales Datum, nicht UTC — sonst rutscht das Datum kurz nach Mitternacht. */
function todayIso(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Grobe Tageszeit-Heuristik, damit der Schnellzugriff nicht mit einer leeren Mahlzeit startet. */
function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export type DrawerGroupKey = 'today' | 'household' | 'private';

export type NavigationFeatureKey =
  | 'navigation.features.brochures'
  | 'navigation.features.overview'
  | 'navigation.features.fridge'
  | 'navigation.features.shoppingList'
  | 'navigation.features.recipes'
  | 'navigation.features.assistant'
  | 'navigation.features.mealPlanner'
  | 'navigation.features.calories'
  | 'navigation.features.workouts'
  | 'navigation.features.low-carb'
  | 'navigation.features.shoppingStt';

export type NavigationGroupTitleKey =
  | 'navigation.groups.today'
  | 'navigation.groups.household'
  | 'navigation.groups.private';

export type NavigationSpeedDialKey =
  | 'navigation.speedDial.fridge'
  | 'navigation.speedDial.shoppingList'
  | 'navigation.speedDial.recipes'
  | 'navigation.speedDial.assistant'
  | 'navigation.speedDial.calories';

export type ModuleTitleKey =
  | 'common.modules.fridge.title'
  | 'common.modules.shoppingList.title'
  | 'common.modules.calories.title'
  | 'common.modules.recipes.title'
  | 'common.modules.mealPlanner.title';

export type ModuleDescriptionKey =
  | 'common.modules.fridge.description'
  | 'common.modules.shoppingList.description'
  | 'common.modules.calories.description'
  | 'common.modules.recipes.description'
  | 'common.modules.mealPlanner.description';

export interface DrawerConfig {
  group: DrawerGroupKey;
  href: string;
  icon: FamIconName | 'calendarDay';
  order?: number;
}

export interface SpeedDialConfig {
  title: NavigationSpeedDialKey;
  icon: FamIconName;
  href: string | (() => string);
  backgroundToken: SpeedDialColorKey;
  order?: number;
}

export interface SettingsConfig {
  iconEmoji: string;
  title: ModuleTitleKey;
  desc: ModuleDescriptionKey;
  order?: number;
}

export interface FeatureDefinition {
  /** Eindeutige Feature-ID */
  id: string;
  /** Übersetzungsschlüssel für den Anzeigenamen */
  title: NavigationFeatureKey;
  /** Wenn gesetzt: Top-Level Modul, das in den Nutzereinstellungen an/abwählbar ist */
  moduleKey?: keyof ModulePreferences;
  /** Wenn gesetzt: Sub-Feature, das an ein übergeordnetes Hauptmodul gekoppelt ist */
  parentModule?: keyof ModulePreferences;
  /** Remote-Gate via PostHog */
  featureFlag?: FeatureFlagKey;
  /** Konfiguration für den Navigation-Drawer */
  drawer?: DrawerConfig;
  /** Konfiguration für das Plus-Button Speed-Dial Menü */
  speedDial?: SpeedDialConfig;
  /** Konfiguration für Module-Settings / Onboarding */
  settings?: SettingsConfig;
}

export const APP_FEATURES = [
  {
    id: 'brochures',
    title: 'navigation.features.brochures',
    moduleKey: 'fridge', // Falls wir keinen eigenen moduleKey einführen, binden wir es ans Haushalts-Modul
    drawer: {
      group: 'household',
      href: '/brochures',
      icon: 'shopping',
      order: 4,
    },
  },
  {
    id: 'overview',
    title: 'navigation.features.overview',
    drawer: {
      group: 'today',
      href: '/',
      icon: 'overview',
      order: 1,
    },
  },
  {
    id: 'fridge',
    title: 'navigation.features.fridge',
    moduleKey: 'fridge',
    drawer: {
      group: 'household',
      href: '/fridge',
      icon: 'fridge',
      order: 1,
    },
    speedDial: {
      title: 'navigation.speedDial.fridge',
      icon: 'fridge',
      href: '/add-item',
      backgroundToken: 'speedDialPantry',
      order: 1,
    },
    settings: {
      iconEmoji: '🧊',
      title: 'common.modules.fridge.title',
      desc: 'common.modules.fridge.description',
      order: 1,
    },
  },
  {
    id: 'shoppingList',
    title: 'navigation.features.shoppingList',
    moduleKey: 'shoppingList',
    drawer: {
      group: 'household',
      href: '/shopping-list',
      icon: 'shopping',
      order: 2,
    },
    speedDial: {
      title: 'navigation.speedDial.shoppingList',
      icon: 'shopping',
      href: '/shopping-list?action=add',
      backgroundToken: 'speedDialShopping',
      order: 2,
    },
    settings: {
      iconEmoji: '🛒',
      title: 'common.modules.shoppingList.title',
      desc: 'common.modules.shoppingList.description',
      order: 2,
    },
  },
  {
    id: 'shoppingStt',
    title: 'navigation.features.shoppingStt',
    parentModule: 'shoppingList',
    featureFlag: 'shopping-stt',
  },
  {
    id: 'recipes',
    title: 'navigation.features.recipes',
    moduleKey: 'recipes',
    featureFlag: 'module-recipes',
    drawer: {
      group: 'household',
      href: '/recipes',
      icon: 'recipes',
      order: 3,
    },
    speedDial: {
      title: 'navigation.speedDial.recipes',
      icon: 'recipes',
      href: '/recipe/create',
      backgroundToken: 'speedDialRecipes',
      order: 4,
    },
    settings: {
      iconEmoji: '📖',
      title: 'common.modules.recipes.title',
      desc: 'common.modules.recipes.description',
      order: 4,
    },
  },
  {
    id: 'assistant',
    title: 'navigation.features.assistant',
    drawer: {
      group: 'today',
      href: '/assistant',
      icon: 'assistant',
      order: 2,
    },
    speedDial: {
      title: 'navigation.speedDial.assistant',
      icon: 'assistant',
      href: '/assistant',
      backgroundToken: 'speedDialAssistant',
      order: 5,
    },
  },
  {
    id: 'mealPlanner',
    title: 'navigation.features.mealPlanner',
    moduleKey: 'mealPlanner',
    featureFlag: 'module-meal-planner',
    drawer: {
      group: 'household',
      href: '/meal-planner',
      icon: 'calendarDay',
      order: 4,
    },
    settings: {
      iconEmoji: '🗓️',
      title: 'common.modules.mealPlanner.title',
      desc: 'common.modules.mealPlanner.description',
      order: 5,
    },
  },
  {
    id: 'calories',
    title: 'navigation.features.calories',
    moduleKey: 'calories',
    featureFlag: 'module-calories',
    drawer: {
      group: 'private',
      href: '/diary',
      icon: 'diary',
      order: 1,
    },
    speedDial: {
      title: 'navigation.speedDial.calories',
      icon: 'diary',
      href: () => `/add-food-entry?date=${todayIso()}&mealType=${defaultMealType()}`,
      backgroundToken: 'speedDialCalories',
      order: 3,
    },
    settings: {
      iconEmoji: '🍎',
      title: 'common.modules.calories.title',
      desc: 'common.modules.calories.description',
      order: 3,
    },
  },
  {
    id: 'workouts',
    title: 'navigation.features.workouts',
    parentModule: 'calories',
    featureFlag: 'workout-log',
  },
  {
    id: 'low-carb',
    title: 'navigation.features.low-carb',
    parentModule: 'calories',
    featureFlag: 'low-carb-tracking',
  },
] as const satisfies readonly FeatureDefinition[];

export type FeatureId = (typeof APP_FEATURES)[number]['id'];

/** Liefert die statische Definition eines Features anhand seiner ID. */
export function getFeature(id: FeatureId | (string & {})): FeatureDefinition | undefined {
  const allFeatures: readonly FeatureDefinition[] = APP_FEATURES;
  return allFeatures.find((f) => f.id === id);
}

/** Findet das Feature, das ein bestimmtes Remote-Flag besitzt. */
export function getFeatureByFlag(featureFlag: FeatureFlagKey): FeatureDefinition | undefined {
  const allFeatures: readonly FeatureDefinition[] = APP_FEATURES;
  return allFeatures.find((f) => f.featureFlag === featureFlag);
}

export const DRAWER_GROUPS_META: readonly {
  key: DrawerGroupKey;
  title: NavigationGroupTitleKey;
  hideTitle?: boolean;
}[] = [
  { key: 'today', title: 'navigation.groups.today', hideTitle: true },
  { key: 'household', title: 'navigation.groups.household', hideTitle: true },
  { key: 'private', title: 'navigation.groups.private', hideTitle: true },
];

export type DrawerRouteItem = {
  id: string;
  label: NavigationFeatureKey;
  href: string;
  icon: FamIconName | 'calendarDay';
  feature: FeatureDefinition;
};

export type DrawerGroup = {
  key: DrawerGroupKey;
  title: NavigationGroupTitleKey;
  hideTitle?: boolean;
  routes: DrawerRouteItem[];
};

/** Baut die nach Navigationsgruppe und Reihenfolge sortierten Drawer-Routen. */
export function getDrawerGroups(): DrawerGroup[] {
  const allFeatures: readonly FeatureDefinition[] = APP_FEATURES;
  return DRAWER_GROUPS_META.map((meta) => {
    const matchingFeatures = allFeatures
      .filter((f) => f.drawer?.group === meta.key)
      .sort((a, b) => (a.drawer?.order ?? 99) - (b.drawer?.order ?? 99));

    const routes: DrawerRouteItem[] = matchingFeatures.map((f) => ({
      id: f.id,
      label: f.title,
      href: f.drawer?.href ?? '/',
      icon: f.drawer?.icon ?? 'overview',
      feature: f,
    }));

    return {
      key: meta.key,
      title: meta.title,
      hideTitle: meta.hideTitle,
      routes,
    };
  });
}

export type SpeedDialOptionItem = {
  id: string;
  title: NavigationSpeedDialKey;
  icon: FamIconName;
  href: string | (() => string);
  backgroundToken: SpeedDialColorKey;
  feature: FeatureDefinition;
};

/** Liefert die aktivierbaren Schnellaktionen in ihrer Anzeigereihenfolge. */
export function getSpeedDialOptions(): SpeedDialOptionItem[] {
  const allFeatures: readonly FeatureDefinition[] = APP_FEATURES;
  return allFeatures
    .filter((f): f is FeatureDefinition & { speedDial: SpeedDialConfig } => Boolean(f.speedDial))
    .sort((a, b) => (a.speedDial.order ?? 99) - (b.speedDial.order ?? 99))
    .map((f) => ({
      id: f.id,
      title: f.speedDial.title,
      icon: f.speedDial.icon,
      href: f.speedDial.href,
      backgroundToken: f.speedDial.backgroundToken,
      feature: f,
    }));
}

export type SettingsModuleItem = {
  key: keyof ModulePreferences;
  icon: string;
  title: ModuleTitleKey;
  desc: ModuleDescriptionKey;
  featureFlag?: FeatureFlagKey;
  feature: FeatureDefinition;
};

/** Leitet die Modul-Schalter fuer die Einstellungen aus der Registry ab. */
export function getSettingsModules(): SettingsModuleItem[] {
  const allFeatures: readonly FeatureDefinition[] = APP_FEATURES;
  return allFeatures
    .filter(
      (
        f,
      ): f is FeatureDefinition & {
        moduleKey: keyof ModulePreferences;
        settings: SettingsConfig;
      } => Boolean(f.moduleKey && f.settings),
    )
    .sort((a, b) => (a.settings.order ?? 99) - (b.settings.order ?? 99))
    .map((f) => ({
      key: f.moduleKey,
      icon: f.settings.iconEmoji,
      title: f.settings.title,
      desc: f.settings.desc,
      featureFlag: f.featureFlag,
      feature: f,
    }));
}
