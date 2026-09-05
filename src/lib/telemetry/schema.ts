export type TelemetryValue = string | number;
export type TelemetryProperties = Record<string, TelemetryValue>;

/** Einzige typisierte Quelle für kuratierte Produkt-Events beider Analytics-Ziele. */
export type ProductTelemetryEventMap = {
  'paywall.view.completed': { source: string; offering_id?: string; tier?: string };
  'purchase.checkout.started': {
    package_id: string;
    period?: string;
    tier?: string;
    price?: number;
    currency?: string;
  };
  'purchase.checkout.completed': { package_id?: string; period?: string; tier?: string };
  'purchase.checkout.cancelled': { package_id?: string; tier?: string };
  'purchase.checkout.failed': {
    package_id?: string;
    tier?: string;
    error_code?: string;
    error_message?: string;
  };
  'purchase.restore.started': Record<string, never>;
  'purchase.restore.completed': Record<string, never>;
  'purchase.restore.failed': { error_code?: string; error_message?: string };
  'onboarding.flow.started': Record<string, never>;
  'onboarding.step.viewed': { step: string };
  'onboarding.flow.completed': Record<string, never>;
  'household.create.completed': Record<string, never>;
  'household.join.completed': Record<string, never>;
  'household.leave.completed': Record<string, never>;
  'household.delete.completed': Record<string, never>;
  'household.member_update.completed': { role: string };
  'household.member_remove.completed': Record<string, never>;
  'product.barcode_scan.completed': { found: boolean };
  'product.barcode_scan.failed': Record<string, never>;
  'recipe.create.completed': Record<string, never>;
  'recipe.update.completed': Record<string, never>;
  'recipe.delete.completed': Record<string, never>;
  'meal_suggestion.request.completed': {
    result: 'suggestions' | 'no_safe_suggestion' | 'shopping_question';
    suggestion_count: number;
    priority_food_count: number;
    fallback_used: boolean;
  };
  'meal_suggestion.view.completed': { suggestion_count: number };
  'meal_suggestion.cook_review.completed': {
    reviewed_item_count: number;
    consumed_item_count: number;
    consumed_quantity_known: boolean;
  };
  'meal_suggestion.save.completed': { source: 'catalog' | 'model_generated' };
  'shopping_item.create.completed': Record<string, never>;
  'shopping_item.update.completed': Record<string, never>;
  'shopping_item.check.completed': Record<string, never>;
  'shopping_item.uncheck.completed': Record<string, never>;
  'shopping_item.delete.completed': Record<string, never>;
  'inventory_item.create.completed': Record<string, never>;
  'inventory_item.update.completed': Record<string, never>;
  'inventory_item.consume.completed': {
    depleted: boolean;
    quantity_known: boolean;
    quantity?: number;
    unit?: 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'package' | 'portion';
  };
  'inventory_item.waste.completed': {
    reason: 'expired' | 'spoiled' | 'unwanted' | 'other';
    quantity_known: boolean;
    quantity?: number;
    unit?: 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'package' | 'portion';
  };
  'inventory_item.delete.completed': Record<string, never>;
  'inventory_item.restore.completed': Record<string, never>;
  'meal_plan_entry.create.completed': { meal_slot: string };
  'meal_plan_entry.update.completed': Record<string, never>;
  'meal_plan_entry.delete.completed': Record<string, never>;
  'meal_plan.reuse.completed': { copied_count: number };
  'sync.manual.started': { source: string };
  'sync.manual.completed': { source: string };
  'sync.manual.failed': { source: string };
  'screen.view.completed': { screen: string };
  'screen.leave.completed': { screen: string; duration_seconds: number };
  'dev_tools.telemetry_test.completed': {
    timestamp: number;
    platform: string;
    source: string;
  };
};

export const TELEMETRY_EVENTS = {
  errorOccurred: 'error.occurred',
  warningOccurred: 'warning.occurred',
  operationSlow: 'operation.slow',
  operationHanging: 'operation.hanging',
  appStarted: 'app.started',
  appBackgrounded: 'app.backgrounded',
  previousSessionUnclean: 'app.previous_session.unclean',
  routeChanged: 'route.changed',
  cameraLabBlocked: 'camera.lab.blocked',
} as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[keyof typeof TELEMETRY_EVENTS] | string;

export const SLOW_OPERATION_THRESHOLD_MS = 1_000;
export const HANGING_OPERATION_THRESHOLD_MS = 2_000;
