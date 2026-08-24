import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { FamIcon } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { Button, HeaderIconButton } from '@/components/ui/buttons';
import { type ItemSource, ItemSourceFilterRow } from '@/components/ui/item-source-filter';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useSession } from '@/features/auth/session-provider';
import { BarcodeScannerModal } from '@/features/inventory/barcode-scanner-modal';
import { persistOffProductIfNeeded } from '@/features/inventory/persist-off-product';
import {
  ProductSearchDropdown,
  type ProductSearchDropdownHandle,
} from '@/features/inventory/product-search-dropdown';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { recordProductUsage } from '@/lib/db/product-usage';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { formatAmount, formatPackageHint } from '@/lib/package-size';
import { useFeatureFlag } from '@/lib/posthog';
import { normalizeUnit, UNIT_OPTIONS } from '@/lib/units';
import {
  normalizePlacementZoneIdNullable,
  PLACEMENT_CLASSIFIER_VERSION,
  type PlacementZoneId,
} from '../classification/placement-taxonomy';
import type { CategorySource } from '../classification/types';
import { useAddShoppingItem } from '../hooks/use-shopping-list-mutations';
import type {
  ShoppingProductSuggestion,
  ShoppingSuggestionMode,
} from '../hooks/use-shopping-product-suggestions';
import { useStores } from '../hooks/use-stores';
import type { CategoryPreferenceMutation } from '../preferences/api';
import { resolvePlacementForItem } from '../preferences/api';
import type { CategoryFeedbackDraft } from '../preferences/feedback';
import { categoryFeedbackMetadata } from '../preferences/feedback-metadata';
import { EMPTY_CATEGORY_STATE } from './category-form-state';
import { PlacementZoneField, type PlacementZoneSelection } from './placement-zone-field';
import { ShoppingProductSuggestions } from './shopping-product-suggestions';

const NO_STORE = '__none__';
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
  return resolvePlacementForItem(input, { omitPreferenceScope: resetScope });
}

interface AddItemFormProps {
  householdId: string;
  initialStoreId?: string | null;
  onDismiss: () => void;
}

/** Fuer den Modal-Header (add-item-modal.tsx): schliesst die Suche von aussen. */
export type AddItemFormHandle = {
  closeSearch: () => void;
};

export const AddItemForm = forwardRef<AddItemFormHandle, AddItemFormProps>(function AddItemForm(
  { householdId, initialStoreId = null, onDismiss },
  ref,
) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [purchaseCount, setPurchaseCount] = useState(1);
  const [unit, setUnit] = useState('piece');
  const [packageSizeInput, setPackageSizeInput] = useState('');
  const [packageSizeUnit, setPackageSizeUnit] = useState('g');
  const [price, setPrice] = useState('');
  const [categoryState, setCategoryState] = useState(EMPTY_CATEGORY_STATE);
  const [placementSelection, setPlacementSelection] = useState<PlacementZoneSelection>({
    mode: 'automatic',
  });
  const [placementSelectionTouched, setPlacementSelectionTouched] = useState(false);
  const [pendingPreferenceResetScope, setPendingPreferenceResetScope] =
    useState<PreferenceScope | null>(null);
  const [storeId, setStoreId] = useState<string | null>(initialStoreId);
  const manualSelectionStoreIdRef = useRef<string | null | undefined>(undefined);
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<OpenFoodFactsProduct | null>(null);
  // Bekannte `product_id` aus einem Häufig/Zuletzt-Vorschlag (#UI-Feedback:
  // "2 Einträge auf der Liste, addiert nicht") — die Vorschläge kennen ihre
  // echte `product_id` bereits aus `product_usage`, aber `toProduct()` wandelt
  // sie in ein `OpenFoodFactsProduct` (nur Barcode) um; ist der Barcode dort
  // leer, findet `persistOffProductIfNeeded` keine/eine andere `product_id`
  // als beim selben Artikel aus der Live-Suche — der Merge-Check in
  // `shopping-list-merge.ts` verlangt exakte `product_id`-Übereinstimmung und
  // legt sonst eine zweite Zeile an, statt die Menge zu addieren.
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [source, setSource] = useState<ItemSource>('food');
  const [suggestionMode, setSuggestionMode] = useState<ShoppingSuggestionMode>('recent');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const productSearchRef = useRef<ProductSearchDropdownHandle>(null);

  const addItem = useAddShoppingItem();
  const addProductMutation = useAddProductMutation();
  const { data: stores = [] } = useStores(householdId);
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const feedbackEnabled = useFeatureFlag('shopping-category-feedback-alpha', false);

  const automaticSourceRef = useRef<CategorySource | null>(null);

  // Automatischer Modus (Abschnitt 10 "Hinzufügen"): klassifiziert bei jeder
  // Namens-/Produktänderung neu, solange keine manuelle Auswahl aktiv ist.
  // Eine manuelle Auswahl (`source === 'user'`) bleibt bei Namensänderungen
  // bewusst unangetastet — nur ein Produktwechsel (`handleSelectProduct`)
  // verwirft sie explizit wieder.
  useEffect(() => {
    if (placementSelection.mode === 'manual') return;

    const trimmed = name.trim();
    if (!trimmed) {
      automaticSourceRef.current = null;
      setCategoryState(EMPTY_CATEGORY_STATE);
      return;
    }

    let cancelled = false;
    resolveAutomaticPreview(
      {
        householdId,
        storeId,
        productId: selectedProductId ?? undefined,
        name: trimmed,
        categoryTags: selectedProduct?.categoryTags,
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
    name,
    selectedProductId,
    selectedProduct,
    householdId,
    storeId,
    placementSelection.mode,
    pendingPreferenceResetScope,
  ]);

  function handleSelectCategory(categoryId: PlacementZoneId) {
    manualSelectionStoreIdRef.current = storeId;
    setPlacementSelection({ mode: 'manual', zoneId: categoryId });
    setPlacementSelectionTouched(true);
    setPendingPreferenceResetScope(null);
    setCategoryState({
      categoryId,
      source: 'user',
      classifierVersion: PLACEMENT_CLASSIFIER_VERSION,
    });
  }

  /** Nur der Formularzustand ändert sich. Die Reset-Mutation läuft erst beim Speichern. */
  function handleSelectAutomatic() {
    setPlacementSelection({ mode: 'automatic' });
    setPlacementSelectionTouched(true);
    const knownScope = preferenceScopeForSource(automaticSourceRef.current, storeId);
    setPendingPreferenceResetScope(knownScope);

    // Legacy-Snapshots mit source=user verraten ihren historischen Scope
    // nicht. Der lokale Resolver schaut Store vor Haushalt nach und bestimmt
    // so den wirklich vorhandenen Preference-Scope, ohne ihn schon zu
    // entfernen. Der Save wiederholt diese Ermittlung synchron zu seiner
    // Transaktion, falls der Nutzer sehr schnell speichert.
    if (automaticSourceRef.current === 'user') {
      void resolvePlacementForItem({
        householdId,
        storeId,
        productId: selectedProductId,
        name: name.trim(),
        categoryTags: selectedProduct?.categoryTags,
      })
        .then((current) => {
          setPendingPreferenceResetScope(preferenceScopeForSource(current.source, storeId));
        })
        .catch((error) => {
          console.error('Einkaufsbereich konnte nicht lokal aufgelöst werden:', error);
        });
    }
  }

  const storeOptions = useMemo(
    () => [
      { value: NO_STORE, label: 'Ohne Markt' },
      ...stores.map((store) => ({ value: store.id, label: store.name })),
    ],
    [stores],
  );
  const parsedPackageSize = Number(packageSizeInput.replace(',', '.'));
  const packageSize =
    unit === 'package' && Number.isFinite(parsedPackageSize) && parsedPackageSize > 0
      ? parsedPackageSize
      : null;
  const packageHint = formatPackageHint(packageSize, packageSizeUnit);
  const purchaseAmount = formatAmount(purchaseCount, unit);

  function handleSelectProduct(product: OpenFoodFactsProduct) {
    // Muss VOR `setName` passieren — sonst haelt der Such-Effekt in
    // `product-search-dropdown.tsx` diesen Namenswechsel fuer neue Eingabe
    // und oeffnet die Trefferliste erneut (#UI-Feedback: "Auswaehlen eines
    // History-Artikels soll die Suchliste nicht ausloesen"). Deckt alle
    // Aufrufer ab, die den Namen von aussen setzen (Häufig/Zuletzt,
    // Barcode-Scan) — bei Auswahl direkt in der Dropdown-Zeile selbst ist der
    // Wert schon (redundant, aber harmlos) markiert.
    productSearchRef.current?.markSelected(product.name);
    setName(product.name);
    const productUnit = normalizeUnit(product.unit);
    const hasKnownPackageSize =
      product.quantity != null && ['g', 'kg', 'ml', 'l'].includes(productUnit);
    setUnit(hasKnownPackageSize ? 'package' : productUnit);
    setPackageSizeInput(hasKnownPackageSize ? String(product.quantity) : '');
    setPackageSizeUnit(hasKnownPackageSize ? productUnit : 'g');
    setSelectedProduct(product);
    setSelectedProductId(null);
    setNameError(null);
    // Produktwechsel darf eine manuelle Kategorie nicht unbemerkt uebernehmen
    // (Abschnitt 10) — zurueck in den automatischen Modus, der
    // Klassifikations-Effekt oben klassifiziert fuer das neue Produkt sofort neu.
    setPlacementSelection({ mode: 'automatic' });
    setPlacementSelectionTouched(false);
    setPendingPreferenceResetScope(null);
    setCategoryState(EMPTY_CATEGORY_STATE);
    manualSelectionStoreIdRef.current = undefined;
  }

  function handleStoreChange(nextStoreId: string | null) {
    const manualSelectionBelongsToPreviousStore =
      placementSelection.mode === 'manual' && manualSelectionStoreIdRef.current !== nextStoreId;

    setStoreId(nextStoreId);
    setPendingPreferenceResetScope(null);
    if (!manualSelectionBelongsToPreviousStore) return;

    manualSelectionStoreIdRef.current = undefined;
    setPlacementSelection({ mode: 'automatic' });
    setPlacementSelectionTouched(false);
    setCategoryState(EMPTY_CATEGORY_STATE);
  }

  function handleSelectSuggestion(
    product: OpenFoodFactsProduct,
    suggestion: ShoppingProductSuggestion,
  ) {
    handleSelectProduct(product);
    // Bekannte `product_id` direkt übernehmen statt sie ueber den (evtl.
    // leeren) Barcode neu aufzuloesen, siehe Kommentar bei `selectedProductId`.
    setSelectedProductId(suggestion.product_id ?? null);
    if (suggestion.last_store_id) setStoreId(suggestion.last_store_id);
  }

  /**
   * Schliesst nur die Tastatur, wenn woanders im Formular interagiert wird
   * (#UI-Feedback: "Keyboard verschwindet nicht" — aber die Trefferliste soll
   * dabei explizit offen bleiben, bis wirklich ein Artikel ausgewaehlt wird,
   * siehe `closeSearch` unten). `keyboardShouldPersistTaps="handled"` auf der
   * umschliessenden ScrollView (item-modal-shell.tsx) unterdrueckt das
   * automatische Zuklappen bei Taps auf andere Bedienelemente absichtlich
   * (sonst braeuchte jeder Button-Press zwei Taps) — deshalb hier explizit an
   * jeder Stelle aufgerufen, an der tatsaechlich etwas anderes bedient wird.
   */
  function dismissKeyboard() {
    Keyboard.dismiss();
  }

  /** Beendet die Suche vollstaendig (Trefferliste + Tastatur) — nur wenn
   * tatsaechlich ein Artikel/Vorschlag uebernommen wurde. */
  function closeSearch() {
    productSearchRef.current?.dismiss();
    Keyboard.dismiss();
  }

  // Erlaubt add-item-modal.tsx, die Suche beim Tap auf den Header zu
  // schliessen (#UI-Feedback: "Trefferliste laesst sich sonst nicht
  // schliessen ohne Auswahl") — der Ref lebt hier, nicht im Modal selbst.
  useImperativeHandle(ref, () => ({ closeSearch }));

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);

    const normalizedPrice = price.trim().replace('€', '').replace(',', '.').trim();
    const parsedPrice = normalizedPrice ? Number(normalizedPrice) : null;
    try {
      const productId =
        selectedProductId ??
        (selectedProduct
          ? await persistOffProductIfNeeded(selectedProduct, userId, addProductMutation)
          : null);

      const resolutionInput = {
        householdId,
        storeId,
        productId,
        name: trimmed,
        categoryTags: selectedProduct?.categoryTags,
      };
      const effectiveBeforeSelection = await resolvePlacementForItem(resolutionInput);
      const resetScope =
        placementSelectionTouched && placementSelection.mode === 'automatic'
          ? (pendingPreferenceResetScope ??
            preferenceScopeForSource(effectiveBeforeSelection.source, storeId))
          : null;
      const resolution = resetScope
        ? await resolvePlacementForItem(resolutionInput, { omitPreferenceScope: resetScope })
        : effectiveBeforeSelection;
      const globalClassification = resolution.globalClassification;
      const savedCategory =
        placementSelection.mode === 'manual'
          ? {
              placementZoneId: placementSelection.zoneId,
              source: 'user' as const,
              classifierVersion: globalClassification.classifierVersion,
            }
          : {
              placementZoneId: resolution.placementZoneId,
              source: resolution.source,
              classifierVersion: resolution.classifierVersion,
            };

      const preference: CategoryPreferenceMutation | undefined =
        placementSelectionTouched && placementSelection.mode === 'manual'
          ? {
              type: 'set',
              input: {
                householdId,
                keyType: productId ? 'product' : 'name',
                keyValue: productId ?? trimmed,
                categoryId: placementSelection.zoneId,
                storeId,
                createdBy: userId ?? null,
              },
            }
          : placementSelectionTouched && resetScope
            ? {
                type: 'reset',
                input: {
                  householdId,
                  keyType: productId ? 'product' : 'name',
                  keyValue: productId ?? trimmed,
                  storeId: resetScope === 'store' ? storeId : null,
                },
              }
            : undefined;

      const feedback: CategoryFeedbackDraft | undefined =
        feedbackEnabled && userId
          ? placementSelectionTouched && placementSelection.mode === 'manual'
            ? savedCategory.placementZoneId !== effectiveBeforeSelection.placementZoneId &&
              savedCategory.placementZoneId !== globalClassification.placementZoneId
              ? {
                  eventId: Crypto.randomUUID(),
                  eventType: 'manual_reassign',
                  inputMethod: 'add_form',
                  householdId,
                  actorUserId: userId,
                  productId,
                  barcode: selectedProduct?.barcode ?? resolution.barcode,
                  productName: trimmed,
                  storeId,
                  preferenceScope: storeId ? 'store' : 'household',
                  oldPlacementZone: effectiveBeforeSelection.placementZoneId,
                  newPlacementZone: savedCategory.placementZoneId,
                  predictedPlacementZone: globalClassification.placementZoneId,
                  oldCategorySource: effectiveBeforeSelection.source,
                  newCategorySource: 'user',
                  predictedProductFamily: globalClassification.productFamilyId,
                  predictedProductForm: globalClassification.productFormId,
                  classifierVersion: globalClassification.classifierVersion,
                  ...categoryFeedbackMetadata(),
                }
              : undefined
            : placementSelectionTouched && placementSelection.mode === 'automatic' && resetScope
              ? {
                  eventId: Crypto.randomUUID(),
                  eventType: 'reset_to_automatic',
                  inputMethod: 'add_form',
                  householdId,
                  actorUserId: userId,
                  productId,
                  barcode: selectedProduct?.barcode ?? resolution.barcode,
                  productName: trimmed,
                  storeId: resetScope === 'store' ? storeId : null,
                  preferenceScope: resetScope,
                  oldPlacementZone: effectiveBeforeSelection.placementZoneId,
                  newPlacementZone: resolution.placementZoneId,
                  predictedPlacementZone: globalClassification.placementZoneId,
                  oldCategorySource: effectiveBeforeSelection.source,
                  newCategorySource: resolution.source,
                  predictedProductFamily: globalClassification.productFamilyId,
                  predictedProductForm: globalClassification.productFormId,
                  classifierVersion: globalClassification.classifierVersion,
                  ...categoryFeedbackMetadata(),
                }
              : undefined
          : undefined;

      await addItem.mutateAsync({
        household_id: householdId,
        product_id: productId,
        name: trimmed,
        quantity: purchaseCount,
        unit,
        package_size: packageSize,
        package_size_unit: packageSize ? packageSizeUnit : null,
        category_id: savedCategory.placementZoneId,
        category_source: savedCategory.source,
        category_classifier_version: savedCategory.classifierVersion,
        store_id: storeId,
        price_estimate: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
        preference,
        feedback,
      });

      if (userId) {
        void getDatabase()
          .then((db) =>
            recordProductUsage(db, {
              id: Crypto.randomUUID(),
              userId,
              householdId,
              feature: 'shopping_list',
              productId,
              name: trimmed,
              brand: selectedProduct?.brand ?? null,
              barcode: selectedProduct?.barcode ?? null,
              quantity: packageSize ?? purchaseCount,
              unit: packageSize ? packageSizeUnit : unit,
            }),
          )
          .then(() => queryClient.invalidateQueries({ queryKey: ['product_usage'] }))
          .catch((err) => console.error('Fehler beim Protokollieren der Nutzung:', err));
      }

      onDismiss();
    } catch (error) {
      console.error('Fehler beim lokalen Speichern des Einkaufsartikels:', error);
      setNameError('Artikel konnte nicht gespeichert werden. Bitte erneut versuchen.');
    }
  }

  return (
    <View className="gap-[10px]">
      <ProductSearchDropdown
        ref={productSearchRef}
        label=""
        placeholder={source === 'dish' ? 'Gericht suchen…' : 'Artikel suchen'}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setSelectedProduct(null);
          setSelectedProductId(null);
          setPackageSizeInput('');
        }}
        onSelectProduct={handleSelectProduct}
        size="large"
        trailing={
          <HeaderIconButton
            label="Barcode scannen"
            onPress={() => {
              productSearchRef.current?.dismiss();
              setShowScanner(true);
            }}
            className="w-10 h-10 rounded-control bg-background-selected">
            <FamIcon name="camera" size={18} color={theme.accent} />
          </HeaderIconButton>
        }
      />

      {/* Die Produktsuche selbst liegt bewusst ausserhalb dieses Wrappers,
          damit Scrollen/Antippen im Dropdown-Panel nicht mit-dismissed wird.
          `Pressable` ist laut React-Native-Doku die aktuelle, empfohlene
          Touch-Komponente (TouchableWithoutFeedback gilt als veraltet) — ein
          eigener Handler direkt auf dem Responder-System (Capture/Bubble)
          erwies sich zuvor als unzuverlaessig (#UI-Feedback). `accessible=
          {false}`, damit VoiceOver weiterhin jedes Kind einzeln liest statt
          den ganzen Wrapper zu einem Knoten zu verschmelzen. Schliesst nur
          die Tastatur, nicht die Trefferliste — echte Bedienelemente rufen
          `dismissKeyboard()` zusaetzlich explizit auf, `KeyboardToolbar`
          (item-modal-shell.tsx) gibt einen "Fertig"-Button. */}
      <Pressable className="gap-[10px]" onPress={dismissKeyboard} accessible={false}>
        {nameError ? (
          <ThemedText type="body" themeColor="danger" className="font-medium">
            {nameError}
          </ThemedText>
        ) : null}

        {/* Quell- und Vorschlagsfilter (Lebensmittel/Gerichte, Zuletzt/Häufig) —
            dieselbe geteilte UI wie bei Vorrat (add-item-screen.tsx, #164). */}
        <ItemSourceFilterRow
          source={source}
          onSourceChange={(next) => {
            dismissKeyboard();
            setSource(next);
          }}
          sourceAccessibilityLabel="Quelle: Lebensmittel oder Gerichte"
          suggestionFilter={suggestionMode}
          onSuggestionFilterChange={(next) => {
            dismissKeyboard();
            setSuggestionMode(next);
          }}
          suggestionAccessibilityLabel="Vorschlagsfilter"
        />

        <ShoppingProductSuggestions
          userId={userId}
          householdId={householdId}
          mode={suggestionMode}
          selectedName={name}
          onSelect={(product, suggestion) => {
            // Auswahl eines Vorschlags uebernimmt den Artikel — beendet die
            // Suche komplett, anders als die reinen Nebeninteraktionen oben.
            closeSearch();
            handleSelectSuggestion(product, suggestion);
          }}
        />

        <View className="flex-row items-end gap-[9px]">
          <View className="flex-[1.15] gap-one">
            <ThemedText type="labelMuted">Einkaufsmenge</ThemedText>
            <QuantityStepper
              value={purchaseCount}
              onChange={(next) => {
                dismissKeyboard();
                setPurchaseCount(next);
              }}
              label="Einkaufsmenge"
              size="large"
            />
          </View>
          <View className="flex-1">
            <WheelPickerField
              label="Markt"
              value={storeId ?? NO_STORE}
              options={storeOptions}
              onChange={(value) => {
                dismissKeyboard();
                handleStoreChange(value === NO_STORE ? null : value);
              }}
              size="large"
            />
          </View>
        </View>

        <View className="border-t-hairline border-border">
          <Pressable
            onPress={() => {
              dismissKeyboard();
              setDetailsOpen((open) => !open);
            }}
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
              <PlacementZoneField
                selection={placementSelection}
                effectiveZoneId={normalizePlacementZoneIdNullable(categoryState.categoryId)}
                categoryOrder={stores
                  .find((store) => store.id === storeId)
                  ?.category_order?.split(',')}
                onSelectionChange={({ zoneId }) => handleSelectCategory(zoneId)}
                onSelectAutomatic={handleSelectAutomatic}
              />
              <WheelPickerField
                label="Einheit"
                value={unit}
                options={UNIT_OPTIONS}
                onChange={(next) => {
                  dismissKeyboard();
                  setUnit(next);
                }}
                size="large"
              />
              {unit === 'package' ? (
                <View className="flex-row items-end gap-two">
                  <View className="flex-[1.3]">
                    <TextField
                      label="Inhalt je Packung"
                      value={packageSizeInput}
                      onChangeText={setPackageSizeInput}
                      keyboardType="decimal-pad"
                      placeholder="z. B. 500"
                    />
                  </View>
                  <View className="flex-1">
                    <WheelPickerField
                      label="Einheit"
                      value={packageSizeUnit}
                      options={UNIT_OPTIONS.filter((option) =>
                        ['g', 'kg', 'ml', 'l', 'piece', 'portion'].includes(option.value),
                      )}
                      onChange={(next) => {
                        dismissKeyboard();
                        setPackageSizeUnit(next);
                      }}
                      size="large"
                    />
                  </View>
                </View>
              ) : null}
              <TextField
                label="Geschätzter Preis (optional)"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="z. B. 2,49 €"
                size="large"
              />
            </View>
          ) : null}
        </View>

        {/* Übersicht bewusst direkt über dem Hinzufügen-Button statt oben bei
            der Suche (#UI-Feedback) — letzter Check vor dem eigentlichen
            Abschluss, nicht mitten im Formular. */}
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
                {selectedProduct?.brand ?? 'Manueller Eintrag'}
              </ThemedText>
              {selectedProduct?.barcode ? (
                <ThemedText type="captionMuted" numberOfLines={1}>
                  EAN {selectedProduct.barcode}
                </ThemedText>
              ) : null}
            </View>
            <View className="items-end">
              <ThemedText type="default">{packageHint ?? purchaseAmount}</ThemedText>
              <ThemedText type="smallMuted">{packageHint ? 'Packungsinhalt' : 'Menge'}</ThemedText>
            </View>
          </View>
        ) : null}

        <Button
          label="Zur Einkaufsliste hinzufügen"
          onPress={handleAdd}
          loading={addItem.isPending}
          disabled={!name.trim()}
          size="large"
        />

        <BarcodeScannerModal
          visible={showScanner}
          onClose={() => setShowScanner(false)}
          onProductFound={handleSelectProduct}
        />
      </Pressable>
    </View>
  );
});
