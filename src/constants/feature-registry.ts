import type { FamIconName } from '@/components/icons/fam-icon';
import type { MealType } from '@/features/calorie-tracking/api';
import type { ModulePreferences } from '@/features/settings/module-preferences';
import type { FeatureFlagKey } from '@/lib/posthog';

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

export interface DrawerConfig {
  group: DrawerGroupKey;
  href: string;
  icon: FamIconName | 'calendarDay';
  order?: number;
}

export interface SpeedDialConfig {
  title: string;
  icon: FamIconName;
  href: string | (() => string);
  backgroundColor: string;
  order?: number;
}

export interface SettingsConfig {
  iconEmoji: string;
  title: string;
  desc: string;
  order?: number;
}

export interface FeatureDefinition {
  /** Eindeutige Feature-ID */
  id: string;
  /** Anzeigename */
  title: string;
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
    title: 'Angebote',
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
    title: 'Übersicht',
    drawer: {
      group: 'today',
      href: '/',
      icon: 'overview',
      order: 1,
    },
  },
  {
    id: 'fridge',
    title: 'Vorrat',
    moduleKey: 'fridge',
    drawer: {
      group: 'household',
      href: '/fridge',
      icon: 'fridge',
      order: 1,
    },
    speedDial: {
      title: 'Vorratsartikel',
      icon: 'fridge',
      href: '/add-item',
      backgroundColor: '#F0E2DF',
      order: 1,
    },
    settings: {
      iconEmoji: '🧊',
      title: 'Kühlschrank & Vorrat',
      desc: 'Bestand verwalten, MHD-Ampel und Benachrichtigungen vor Ablauf.',
      order: 1,
    },
  },
  {
    id: 'shoppingList',
    title: 'Einkauf',
    moduleKey: 'shoppingList',
    drawer: {
      group: 'household',
      href: '/shopping-list',
      icon: 'shopping',
      order: 2,
    },
    speedDial: {
      title: 'Einkaufsartikel',
      icon: 'shopping',
      href: '/shopping-list?action=add',
      backgroundColor: '#EBE5F1',
      order: 2,
    },
    settings: {
      iconEmoji: '🛒',
      title: 'Geteilte Einkaufsliste',
      desc: 'Gemeinsam einkaufen und nach dem Abkassieren direkt im Kühlschrank speichern.',
      order: 2,
    },
  },
  {
    id: 'recipes',
    title: 'Rezepte',
    moduleKey: 'recipes',
    featureFlag: 'module-recipes',
    drawer: {
      group: 'household',
      href: '/recipes',
      icon: 'recipes',
      order: 3,
    },
    speedDial: {
      title: 'Rezept',
      icon: 'recipes',
      href: '/recipe/create',
      backgroundColor: '#E4EDE3',
      order: 4,
    },
    settings: {
      iconEmoji: '📖',
      title: 'Rezepte',
      desc: 'Im Haushalt geteilte Rezeptsammlung.',
      order: 4,
    },
  },
  {
    id: 'mealPlanner',
    title: 'Essensplan',
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
      title: 'Essensplan',
      desc: 'Wochenplanung fuer den Haushalt, Mahlzeiten Mitgliedern zuordnen.',
      order: 5,
    },
  },
  {
    id: 'calories',
    title: 'Tagebuch',
    moduleKey: 'calories',
    featureFlag: 'module-calories',
    drawer: {
      group: 'private',
      href: '/diary',
      icon: 'diary',
      order: 1,
    },
    speedDial: {
      title: 'Tagebucheintrag',
      icon: 'diary',
      href: () => `/add-food-entry?date=${todayIso()}&mealType=${defaultMealType()}`,
      backgroundColor: '#F3E9D7',
      order: 3,
    },
    settings: {
      iconEmoji: '🍎',
      title: 'Kalorienzähler & Tagebuch',
      desc: 'Privat Nährwerte erfassen, Makros tracken und Grundumsatz berechnen.',
      order: 3,
    },
  },
  {
    id: 'workouts',
    title: 'Workouts',
    parentModule: 'calories',
    featureFlag: 'workout-log',
  },
  {
    id: 'low-carb',
    title: 'Low-Carb Tracking',
    parentModule: 'calories',
    featureFlag: 'low-carb-tracking',
  },
] as const satisfies readonly FeatureDefinition[];

export type FeatureId = (typeof APP_FEATURES)[number]['id'];

export function getFeature(id: FeatureId | (string & {})): FeatureDefinition | undefined {
  const allFeatures: readonly FeatureDefinition[] = APP_FEATURES;
  return allFeatures.find((f) => f.id === id);
}

export const DRAWER_GROUPS_META: readonly {
  key: DrawerGroupKey;
  title: string;
  hideTitle?: boolean;
}[] = [
  { key: 'today', title: 'Heute', hideTitle: true },
  { key: 'household', title: 'Haushalt & Planung', hideTitle: true },
  { key: 'private', title: 'Privat', hideTitle: true },
];

export type DrawerRouteItem = {
  id: string;
  label: string;
  href: string;
  icon: FamIconName | 'calendarDay';
  feature: FeatureDefinition;
};

export type DrawerGroup = {
  key: DrawerGroupKey;
  title: string;
  hideTitle?: boolean;
  routes: DrawerRouteItem[];
};

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
  title: string;
  icon: FamIconName;
  href: string | (() => string);
  backgroundColor: string;
  feature: FeatureDefinition;
};

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
      backgroundColor: f.speedDial.backgroundColor,
      feature: f,
    }));
}

export type SettingsModuleItem = {
  key: keyof ModulePreferences;
  icon: string;
  title: string;
  desc: string;
  featureFlag?: FeatureFlagKey;
  feature: FeatureDefinition;
};

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
