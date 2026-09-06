import { debugLog } from '@/lib/debug-log';
import { UNIT_OPTIONS } from '@/lib/units';
import type { CategorySource } from '../classification/types';
import { resolvePlacementForItem } from '../preferences/api';

export const NO_STORE = '__none__';

export type PreferenceScope = 'store' | 'household';

export function preferenceScopeForSource(
  source: CategorySource | null,
  _storeId: string | null,
): PreferenceScope | null {
  if (source === 'store_preference') return 'store';
  if (source === 'household_preference') return 'household';
  return null;
}

export async function resolveAutomaticPreview(
  input: Parameters<typeof resolvePlacementForItem>[0],
  resetScope: PreferenceScope | null,
) {
  debugLog(' [Placement]  ℹ️ resolveAutomaticPreview', { input, resetScope });
  return resolvePlacementForItem(input, { omitPreferenceScope: resetScope });
}

export const PACKAGE_SIZE_UNIT_OPTIONS = UNIT_OPTIONS.filter((option) =>
  ['g', 'kg', 'ml', 'l', 'piece', 'portion'].includes(option.value),
);
