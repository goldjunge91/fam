import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import { debugLog } from '@/lib/debug-log';
import { formatAmount } from '@/lib/package-size';
import { useFeatureFlag } from '@/lib/posthog';
import { UNIT_OPTIONS } from '@/lib/units';
import {
  normalizePlacementZoneIdNullable,
  PLACEMENT_CLASSIFIER_VERSION,
  type PlacementZoneId,
} from '../classification/placement-taxonomy';
import type { CategorySource } from '../classification/types';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import { useUpdateShoppingItem } from '../hooks/use-shopping-list-mutations';
import { useStores } from '../hooks/use-stores';
import type { CategoryPreferenceMutation } from '../preferences/api';
import { resolvePlacementForItem } from '../preferences/api';
import type { CategoryFeedbackInput } from '../preferences/feedback';
import { logCategoryFeedbackAlphaTrace } from '../preferences/feedback-debug';
import { categoryFeedbackMetadata } from '../preferences/feedback-metadata';
import type { CategoryFormState } from './category-form-state';
import { PlacementZoneField, type PlacementZoneSelection } from './placement-zone-field';

const NO_STORE = '__none__';

interface EditItemFormProps {
  item: LocalShoppingItem;
  onDismiss: () => void;
}

type PreferenceScope = 'store' | 'household';

function preferenceScopeForSource(
  source: CategorySource | null,
  _storeId: string | null,
): PreferenceScope | null {
  if (source === 'store_preference') return 'store';
  if (source === 'household_preference') return 'household';
  return null;
}

async function resolveAutomaticPreview(
  input: Parameters<typeof resolvePlacementForItem>[0],
  resetScope: PreferenceScope | null,
) {
  debugLog('LOG  [Placement] edit-item-form resolveAutomaticPreview', { input, resetScope });
  return resolvePlacementForItem(input, { omitPreferenceScope: resetScope });
}

/**
 * Bearbeitungsformular fuer einen bestehenden Artikel. Ausgangspunkt war,
 * dass ein Artikel ohne Markt sich gar nicht mehr aendern liess — bewusst
 * als vollstaendiges Formular wie beim Hinzufuegen statt eines reinen
 * Markt-Dialogs, weil hier noch weitere Punkte dazukommen werden.
 */
export function EditItemForm({ item, onDismiss }: EditItemFormProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState(
    item.price_estimate != null ? String(item.price_estimate) : '',
  );
  const [storeId, setStoreId] = useState<string | null>(item.store_id);
  const [nameError, setNameError] = useState<string | null>(null);
  const initialCategoryId = normalizePlacementZoneIdNullable(item.category_id);
  const initialSelection: PlacementZoneSelection =
    item.category_source === 'user'
      ? { mode: 'manual', zoneId: initialCategoryId ?? 'other' }
      : { mode: 'automatic' };
  const [placementSelection, setPlacementSelection] =
    useState<PlacementZoneSelection>(initialSelection);
  const [placementSelectionTouched, setPlacementSelectionTouched] = useState(false);
  const [pendingPreferenceResetScope, setPendingPreferenceResetScope] =
    useState<PreferenceScope | null>(null);
  const [storeContextChanged, setStoreContextChanged] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Abschnitt 10 "Bearbeiten": `category_id`/`category_source` werden aus dem
  // Eintrag initialisiert, nicht erneut ueber den Namen berechnet — anders
  // als im Add-Formular gibt es hier bewusst KEINEN Effekt, der bei einer
  // Namensaenderung neu klassifiziert.
  const [categoryState, setCategoryState] = useState<CategoryFormState>({
    categoryId: initialCategoryId,
    source: item.category_source,
    classifierVersion: item.category_classifier_version,
  });
  // Vergleichsbasis fuer "echte Kategorieaenderung" unten — bewusst der
  // Ausgangszustand, nicht der jeweils aktuelle `categoryState`.
  const initialCategory = useRef({
    categoryId: initialCategoryId,
    source: item.category_source,
  }).current;
  const initialStoreId = useRef(item.store_id).current;
  const automaticSourceRef = useRef<CategorySource | null>(item.category_source);
  const manualSelectionStoreIdRef = useRef<string | null>(
    initialSelection.mode === 'manual' ? item.store_id : null,
  );
  const resetScopeRequestRef = useRef(0);

  const updateItem = useUpdateShoppingItem();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: stores = [] } = useStores(item.household_id);
  const feedbackEnabled = useFeatureFlag('shopping-category-feedback-alpha', false);
  const storeOptions = [
    { value: NO_STORE, label: 'Ohne Markt' },
    ...stores.map((store) => ({ value: store.id, label: store.name })),
  ];

  useEffect(() => {
    if (placementSelection.mode === 'manual') return;
    if (!placementSelectionTouched && !storeContextChanged && storeId === initialStoreId) return;

    let cancelled = false;
    resolveAutomaticPreview(
      {
        householdId: item.household_id,
        storeId,
        productId: item.product_id ?? undefined,
        name: name.trim(),
      },
      pendingPreferenceResetScope,
    ).then((result) => {
      if (cancelled) return;
      automaticSourceRef.current = result.source;
      setCategoryState({
        categoryId: result.placementZoneId,
        source: result.source,
        classifierVersion: result.classifierVersion,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    item.household_id,
    item.product_id,
    name,
    storeId,
    initialStoreId,
    storeContextChanged,
    placementSelectionTouched,
    placementSelection.mode,
    pendingPreferenceResetScope,
  ]);

  function handleSelectCategory(categoryId: PlacementZoneId) {
    setPlacementSelection({ mode: 'manual', zoneId: categoryId });
    setPlacementSelectionTouched(true);
    setPendingPreferenceResetScope(null);
    manualSelectionStoreIdRef.current = storeId;
    setCategoryState({
      categoryId,
      source: 'user',
      classifierVersion: PLACEMENT_CLASSIFIER_VERSION,
    });
  }

  function handleSelectAutomatic() {
    setPlacementSelection({ mode: 'automatic' });
    setPlacementSelectionTouched(true);
    const knownScope = preferenceScopeForSource(automaticSourceRef.current, storeId);
    setPendingPreferenceResetScope(knownScope);

    if (automaticSourceRef.current === 'user') {
      const requestId = ++resetScopeRequestRef.current;
      void resolvePlacementForItem({
        householdId: item.household_id,
        storeId,
        productId: item.product_id,
        name: name.trim(),
      })
        .then((current) => {
          if (requestId !== resetScopeRequestRef.current) return;
          setPendingPreferenceResetScope(preferenceScopeForSource(current.source, storeId));
        })
        .catch((error) => {
          console.error(
            '[shopping-list] Automatischer Einkaufsbereich konnte nicht aufgelöst werden',
            error,
          );
        });
    }
  }

  function handleStoreChange(nextStoreId: string | null) {
    if (nextStoreId !== storeId) setStoreContextChanged(true);
    resetScopeRequestRef.current += 1;
    setStoreId(nextStoreId);
    setPendingPreferenceResetScope(null);

    if (placementSelection.mode === 'manual' && manualSelectionStoreIdRef.current !== nextStoreId) {
      manualSelectionStoreIdRef.current = null;
      setPlacementSelection({ mode: 'automatic' });
      setPlacementSelectionTouched(false);
    }
  }

  async function handleSave() {
    debugLog('LOG  [Placement] edit-item-form handleSave called', {
      itemId: item.id,
      name: name.trim(),
      quantity,
      unit,
      price,
      initialCategory: { categoryId: item.category_id, source: item.category_source },
      categoryState,
      placementSelectionTouched,
      placementSelectionMode: placementSelection.mode,
      manualZoneId: placementSelection.mode === 'manual' ? placementSelection.zoneId : null,
      storeContextChanged,
      storeId,
    });
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    const parsedPrice = price.trim() ? Number(price.trim().replace(',', '.')) : null;

    try {
      const resolutionInput = {
        householdId: item.household_id,
        storeId,
        productId: item.product_id,
        name: trimmed,
      };
      const effectiveBeforeSelection = await resolvePlacementForItem(resolutionInput);
      const resetScope =
        placementSelectionTouched && placementSelection.mode === 'automatic'
          ? (pendingPreferenceResetScope ??
            preferenceScopeForSource(effectiveBeforeSelection.source, storeId))
          : null;
      const resolved = resetScope
        ? await resolvePlacementForItem(resolutionInput, { omitPreferenceScope: resetScope })
        : effectiveBeforeSelection;
      const storeChanged = storeId !== initialStoreId;
      const keepInitialSnapshot =
        !placementSelectionTouched && !storeContextChanged && !storeChanged;
      const savedCategory =
        placementSelection.mode === 'manual'
          ? {
              categoryId: placementSelection.zoneId,
              source: 'user' as const,
              classifierVersion: PLACEMENT_CLASSIFIER_VERSION,
            }
          : keepInitialSnapshot
            ? {
                categoryId: initialCategory.categoryId ?? resolved.placementZoneId,
                source: initialCategory.source ?? resolved.source,
                classifierVersion: PLACEMENT_CLASSIFIER_VERSION,
              }
            : {
                categoryId: resolved.placementZoneId,
                source: resolved.source,
                classifierVersion: resolved.classifierVersion,
              };

      const explicitManualForCurrentStore =
        placementSelectionTouched &&
        placementSelection.mode === 'manual' &&
        manualSelectionStoreIdRef.current === storeId;
      const preference: CategoryPreferenceMutation | undefined = explicitManualForCurrentStore
        ? {
            type: 'set',
            input: {
              householdId: item.household_id,
              keyType: item.product_id ? 'product' : 'name',
              keyValue: item.product_id ?? trimmed,
              categoryId: placementSelection.zoneId,
              storeId,
              createdBy: userId ?? null,
            },
          }
        : placementSelectionTouched && placementSelection.mode === 'automatic' && resetScope
          ? {
              type: 'reset',
              input: {
                householdId: item.household_id,
                keyType: item.product_id ? 'product' : 'name',
                keyValue: item.product_id ?? trimmed,
                storeId: resetScope === 'store' ? storeId : null,
              },
            }
          : undefined;

      const globalClassification = resolved.globalClassification;
      const oldZone = initialCategory.categoryId ?? 'other';
      const newZone = savedCategory.categoryId;
      const sharedFeedback = {
        inputMethod: 'edit_form' as const,
        householdId: item.household_id,
        actorUserId: userId ?? '',
        shoppingListItemId: item.id,
        productId: item.product_id,
        barcode: resolved.barcode,
        productName: trimmed,
        oldPlacementZone: oldZone,
        newPlacementZone: newZone,
        predictedPlacementZone: globalClassification.placementZoneId,
        oldCategorySource: initialCategory.source ?? 'name_fallback',
        newCategorySource: savedCategory.source,
        predictedProductFamily: globalClassification.productFamilyId,
        predictedProductForm: globalClassification.productFormId,
        classifierVersion: globalClassification.classifierVersion,
        ...categoryFeedbackMetadata(),
      };
      const feedback: CategoryFeedbackInput | undefined =
        feedbackEnabled && userId
          ? explicitManualForCurrentStore &&
            oldZone !== newZone &&
            newZone !== globalClassification.placementZoneId
            ? {
                ...sharedFeedback,
                actorUserId: userId,
                eventId: Crypto.randomUUID(),
                eventType: 'manual_reassign',
                storeId,
                preferenceScope: storeId ? 'store' : 'household',
              }
            : placementSelectionTouched && placementSelection.mode === 'automatic' && resetScope
              ? {
                  ...sharedFeedback,
                  actorUserId: userId,
                  eventId: Crypto.randomUUID(),
                  eventType: 'reset_to_automatic',
                  storeId: resetScope === 'store' ? storeId : null,
                  preferenceScope: resetScope,
                }
              : undefined
          : undefined;

      logCategoryFeedbackAlphaTrace({
        origin: 'edit_form',
        featureFlagEnabled: feedbackEnabled,
        predictedPlacementZone: globalClassification.placementZoneId,
        savedPlacementZone: savedCategory.categoryId,
        savedCategorySource: savedCategory.source,
        preference,
        feedback,
      });

      await updateItem.mutateAsync({
        id: item.id,
        household_id: item.household_id,
        name: trimmed,
        quantity: Number(quantity) || 1,
        unit,
        category_id: savedCategory.categoryId,
        category_source: savedCategory.source,
        category_classifier_version: savedCategory.classifierVersion,
        store_id: storeId,
        price_estimate: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
        preference,
        feedback,
      });

      onDismiss();
    } catch (error) {
      console.error('[shopping-list] Artikel konnte nicht gespeichert werden', error);
      setNameError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    }
  }

  return (
    <View className="gap-[10px]">
      <TextField
        value={name}
        onChangeText={setName}
        placeholder="Artikelname"
        autoFocus
        size="large"
        textAlignVertical="center"
        error={nameError ?? undefined}
      />

      <View className="flex-row items-end gap-[9px]">
        <View className="flex-[1.15]">
          <TextField
            label="Einkaufsmenge"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="1"
            size="large"
            textAlignVertical="center"
          />
        </View>
        <View className="flex-1">
          <WheelPickerField
            label="Markt"
            value={storeId ?? NO_STORE}
            options={storeOptions}
            onChange={(value) => handleStoreChange(value === NO_STORE ? null : value)}
            size="large"
          />
        </View>
      </View>

      <View className="border-t-hairline border-border">
        <Pressable
          onPress={() => setDetailsOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          accessibilityLabel="Weitere Angaben"
          className="details-summary">
          <ThemedText type="body" themeColor="accent" className="font-medium">
            {detailsOpen ? '▾' : '›'}
          </ThemedText>
          <ThemedText type="body" themeColor="accent" className="font-medium">
            Weitere Angaben
          </ThemedText>
        </Pressable>

        {detailsOpen ? (
          <View className="gap-[10px] pb-one">
            <WheelPickerField
              label="Einheit"
              value={unit}
              options={UNIT_OPTIONS}
              onChange={setUnit}
              size="large"
            />
            <PlacementZoneField
              selection={placementSelection}
              effectiveZoneId={normalizePlacementZoneIdNullable(categoryState.categoryId)}
              categoryOrder={stores
                .find((store) => store.id === storeId)
                ?.category_order?.split(',')}
              onSelectionChange={({ zoneId }) => handleSelectCategory(zoneId)}
              onSelectAutomatic={handleSelectAutomatic}
            />
            <TextField
              label="Geschätzter Preis (optional)"
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="z. B. 2,49 €"
              size="large"
              textAlignVertical="center"
            />
          </View>
        ) : null}
      </View>

      {name.trim() ? (
        <View className="product-summary">
          <View className="flex-1 min-w-0">
            <ThemedText type="bodyBold" numberOfLines={1}>
              {name.trim()}
            </ThemedText>
            <ThemedText
              type="detail"
              themeColor="textSecondary"
              numberOfLines={1}
              className="font-medium">
              Bestehender Eintrag
            </ThemedText>
          </View>
          <View className="items-end">
            <ThemedText type="default">
              {formatAmount(Number(quantity.replace(',', '.')) || 1, unit)}
            </ThemedText>
            <ThemedText type="smallMuted">Menge</ThemedText>
          </View>
        </View>
      ) : null}

      <Button
        label="Speichern"
        onPress={handleSave}
        loading={updateItem.isPending}
        disabled={!name.trim()}
        size="large"
      />
    </View>
  );
}
