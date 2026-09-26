import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  forwardRef,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  type StyleProp,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, TextField, Txt } from '@/constants/ui';
import { useOptionalActiveHousehold } from '@/features/household/active-household-provider';
import { useProductSearch } from '@/features/product-search/hooks/use-product-search';
import { usePreferredProductMarketName } from '@/features/product-search/preferred-market';
import type { CatalogProduct } from '@/features/product-search/types';

/** Wie nah am unteren Rand (px) das Nachladen beim Scrollen ausloest. */
const LOAD_MORE_THRESHOLD_PX = 70;

const PANEL_BOTTOM_MARGIN = 24;

/** Nie kleiner als das, selbst wenn oberhalb kaum Platz gemessen wird. */
const PANEL_MIN_HEIGHT = 140;

/** Bis die erste Messung vorliegt (Layout noch nicht bekannt), z.B. beim allerersten Render. */
const PANEL_FALLBACK_HEIGHT = 220;

/** Seitengroesse fuer das Nachladen beim Scrollen. */
const PAGE_SIZE = 100;

type ProductPanelPlacement = 'above' | 'below';

type ProductPanelLayout = {
  placement: ProductPanelPlacement;
  maxHeight: number;
};

export function calculateProductPanelLayout({
  anchorY,
  anchorHeight,
  windowHeight,
  keyboardTopY,
}: {
  anchorY: number;
  anchorHeight: number;
  windowHeight: number;
  keyboardTopY: number | null;
}): ProductPanelLayout {
  const bottomLimit = keyboardTopY ?? windowHeight;
  const availableBelow = bottomLimit - (anchorY + anchorHeight) - PANEL_BOTTOM_MARGIN;
  const availableAbove = anchorY - PANEL_BOTTOM_MARGIN;

  if (availableBelow < PANEL_MIN_HEIGHT && availableAbove > availableBelow) {
    return {
      placement: 'above',
      maxHeight: Math.max(availableAbove, PANEL_MIN_HEIGHT),
    };
  }

  return {
    placement: 'below',
    maxHeight: Math.max(availableBelow, PANEL_MIN_HEIGHT),
  };
}

const styles = StyleSheet.create((theme) => ({
  root: {
    position: 'relative',
    zIndex: 10,
  },
  trailingInside: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  outsideTrailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  outsideTrailingInput: {
    flex: 1,
    minWidth: 0,
  },
  searchCloseButton: {
    width: theme.space.xxl,
    height: theme.space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
  },
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 20,
    marginTop: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  panelAbove: {
    top: 'auto',
    bottom: '100%',
    marginTop: 0,
    marginBottom: theme.space.xs,
  },
  panelContent: {
    flexGrow: 1,
    paddingBottom: theme.space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.space.xxxl,
    gap: theme.space.sm,
    padding: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  thumb: {
    width: theme.space.xxl,
    height: theme.space.xxl,
    borderRadius: theme.radius.sm,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.xs,
    backgroundColor: theme.backgroundElement,
  },
  flex: {
    flex: 1,
  },
  loadingMore: {
    alignItems: 'center',
    paddingVertical: theme.space.sm,
  },
  errorState: {
    alignItems: 'center',
    gap: theme.space.sm,
    padding: theme.space.lg,
  },
  emptyState: {
    gap: theme.space.xs,
    paddingVertical: theme.space.xs,
  },
}));

interface ProductSearchDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectProduct: (product: CatalogProduct) => void;
  inputStyle?: StyleProp<TextStyle>;
  trailing?: ReactNode;
  trailingPlacement?: 'inside' | 'outside';
  size?: 'default' | 'large';
}

export type ProductSearchDropdownHandle = {
  dismiss: () => void;

  markSelected: (name: string) => void;
};

export const ProductSearchDropdown = forwardRef<
  ProductSearchDropdownHandle,
  ProductSearchDropdownProps
>(function ProductSearchDropdown(
  {
    label = 'Name',
    placeholder = 'z. B. Hafermilch',
    value,
    onChangeText,
    onSelectProduct,
    inputStyle,
    trailing,
    trailingPlacement = 'inside',
    size = 'default',
  },
  ref,
) {
  const { colors } = useTheme();
  const activeHousehold = useOptionalActiveHousehold();
  const preferredMarket = usePreferredProductMarketName(
    activeHousehold?.activeHouseholdId ?? undefined,
  );
  const [showDropdown, setShowDropdown] = useState(false);
  // Dynamische Panel-Hoehe (#Performance-Feedback: "Dropdown soll bis zum
  // Bildschirmrand gehen, nicht bei 3 Treffern abschneiden"), siehe
  // `updatePanelMaxHeight` weiter unten.
  const [panelMaxHeight, setPanelMaxHeight] = useState<number | null>(null);
  const [panelPlacement, setPanelPlacement] = useState<ProductPanelPlacement>('below');
  const wrapperRef = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  // Y-Koordinate (im selben Fenster-Koordinatensystem wie `measureInWindow`),
  // an der die Tastatur beginnt — `null` heisst keine Tastatur eingeblendet.
  // Bewusst `screenY` statt `endCoordinates.height`: Bei mancher iOS-Version
  // zaehlt die QuickType-/Vorschlagsleiste ueber der eigentlichen Tastatur
  // nicht in `.height` mit, `screenY` markiert dagegen zuverlaessig die
  // oberste sichtbare Kante (#UI-Feedback: "ein Artikel halb von der Tastatur
  // verdeckt" — trat trotz erhoehtem PANEL_BOTTOM_MARGIN weiter auf).
  const [keyboardTopY, setKeyboardTopY] = useState<number | null>(null);
  const deferredValue = useDeferredValue(value);
  // `value` aendert sich auch, wenn `onSelectProduct` den Query-Text auf den
  // gewaehlten Produktnamen setzt (siehe recipe-create-screen.tsx). Ohne diese
  // Markierung wuerde diese Aenderung als neue Eingabe zaehlen und das
  // Dropdown eine Suche spaeter erneut oeffnen — Auswahl wirkte dann wie 2x
  // noetig. Initialisiert mit `value` (statt `null`), damit ein bereits
  // befuellter Anfangswert beim (Re-)Mount nicht als neue Eingabe zaehlt —
  // sonst oeffnet sich beim Zurueckblaettern im Rezept-Wizard die Trefferliste
  // erneut fuer jede bereits ausgewaehlte Zutat (#UI-Feedback: "oeffnet sich
  // fuer alle Zutaten das Modal der Suche").
  const [selectedName, setSelectedName] = useState<string | null>(value);
  const currentValueRef = useRef(value);
  currentValueRef.current = value;
  const dismissedQueryRef = useRef<string | null>(null);

  function dismiss() {
    dismissedQueryRef.current = currentValueRef.current;
    setShowDropdown(false);
    Keyboard.dismiss();
  }

  useImperativeHandle(ref, () => ({
    dismiss,
    markSelected: (name) => {
      dismissedQueryRef.current = name;
      setSelectedName(name);
    },
  }));

  // Tastaturposition mitverfolgen, damit das Dropdown nicht dahinter
  // verschwindet oder von ihr verdeckt wird.
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTopY(event.endCoordinates.screenY);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardTopY(null));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Misst, wie viel Platz zwischen Suchfeld und unterem Rand (Tastatur oder
  // Bildschirmende) tatsaechlich frei ist, statt das Dropdown pauschal bei
  // 220px zu kappen. Laeuft beim Oeffnen sowie bei Rotation/Tastaturwechsel.
  useEffect(() => {
    if (!showDropdown) return;
    wrapperRef.current?.measureInWindow((_x, y, _width, height) => {
      const layout = calculateProductPanelLayout({
        anchorY: y,
        anchorHeight: height,
        windowHeight,
        keyboardTopY,
      });
      setPanelPlacement(layout.placement);
      setPanelMaxHeight(layout.maxHeight);
    });
  }, [showDropdown, windowHeight, keyboardTopY]);

  // Solange die Eingabe exakt der letzten Auswahl entspricht, wird nicht
  // gesucht. Sobald der Nutzer tippt, ist die Markierung verbraucht.
  useEffect(() => {
    if (selectedName !== null && selectedName !== deferredValue) setSelectedName(null);
  }, [deferredValue, selectedName]);

  const searchQuery = selectedName === deferredValue ? '' : deferredValue;
  const {
    results: suggestions,
    searching,
    loadingMore,
    failed,
    searched,
    loadMore,
    searchOnline,
    retry,
  } = useProductSearch(searchQuery, { preferredMarket, pageSize: PAGE_SIZE });

  useEffect(() => {
    if (searched && dismissedQueryRef.current !== currentValueRef.current) {
      setShowDropdown(true);
    }
  }, [searched]);

  const showErrorState = searched && !searching && failed && suggestions.length === 0;
  const showEmptyState = searched && !searching && !failed && suggestions.length === 0;
  const isTrailingOutside = trailingPlacement === 'outside';
  const loadingIndicator = (
    <ActivityIndicator
      size={isTrailingOutside ? 'large' : 'small'}
      color={colors.accent}
      style={isTrailingOutside ? { marginRight: space.md } : undefined}
    />
  );
  const searchCloseButton = showDropdown ? (
    <Press
      onPress={dismiss}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Suche schließen"
      style={styles.searchCloseButton}>
      <Txt variant="glyph" tone="secondary">
        ×
      </Txt>
    </Press>
  ) : null;

  const inputTrailing = isTrailingOutside ? (
    searching || searchCloseButton ? (
      <View style={styles.trailingInside}>
        {searching ? loadingIndicator : null}
        {searchCloseButton}
      </View>
    ) : undefined
  ) : searching || searchCloseButton ? (
    <View style={styles.trailingInside}>
      {searching ? loadingIndicator : null}
      {searchCloseButton}
      {trailing}
    </View>
  ) : (
    trailing
  );

  return (
    <View ref={wrapperRef} style={styles.root} onTouchStart={(event) => event.stopPropagation()}>
      <View style={isTrailingOutside ? styles.outsideTrailingRow : undefined}>
        <View style={isTrailingOutside ? styles.outsideTrailingInput : undefined}>
          <TextField
            label={label}
            placeholder={placeholder}
            value={value}
            style={inputStyle}
            trailing={inputTrailing}
            size={size}
            // Return-Taste schliesst nur die Tastatur, die Trefferliste bleibt
            // offen (#UI-Feedback: Liste soll erst bei tatsaechlicher Auswahl
            // zugehen, nicht schon beim blossen Wegnehmen der Tastatur).
            returnKeyType="search"
            onSubmitEditing={() => {
              void searchOnline();
              Keyboard.dismiss();
            }}
            onChangeText={(text) => {
              dismissedQueryRef.current = null;
              onChangeText(text);
              setShowDropdown(true);
            }}
          />
        </View>
        {isTrailingOutside ? trailing : null}
      </View>

      {showDropdown && (suggestions.length > 0 || showEmptyState || showErrorState) && (
        <ScrollView
          style={[
            styles.panel,
            panelPlacement === 'above' && styles.panelAbove,
            { maxHeight: panelMaxHeight ?? PANEL_FALLBACK_HEIGHT },
          ]}
          // maxHeight kommt aus der Live-Messung oben statt einer festen Klasse — die Liste soll
          // bis zum unteren Rand reichen, nicht pauschal bei 220px kappen.
          // Ohne das stoesst die letzte Zeile direkt an den unteren, abgerundeten
          // Panel-Rand — sieht abgeschnitten aus (#UI-Feedback: "Liste ist zu tief").
          // `flexGrow: 1` sorgt dafuer, dass bei wenigen Treffern echte
          // Leerflaeche im Content-Container entsteht (statt shrink-wrap auf
          // die paar Zeilen) — die faengt der Pressable am Ende des Contents
          // unten ab, damit Tippen dort die Tastatur schliesst (#UI-Feedback:
          // "Leerflaeche neben dem Suchfeld schliesst Tastatur nicht"; das
          // randfuellende Panel bedeckt bei offener Suche fast den ganzen
          // Bildschirm, ein Formular-weiter Blank-Tap-Handler erreicht es nicht).
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          onScroll={({ nativeEvent }) => {
            const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
            const distanceToBottom =
              contentSize.height - contentOffset.y - layoutMeasurement.height;
            if (distanceToBottom < LOAD_MORE_THRESHOLD_PX) loadMore();
          }}
          scrollEventThrottle={100}>
          {showErrorState ? (
            <View style={styles.errorState}>
              <Txt variant="body" tone="danger" center accessibilityRole="alert">
                Open Food Facts ist gerade nicht erreichbar.
              </Txt>
              <Button
                title="Erneut versuchen"
                variant="secondary"
                size="sm"
                onPress={() => void retry()}
              />
            </View>
          ) : showEmptyState ? (
            <View style={styles.emptyState}>
              <Button
                title="Open Food Facts durchsuchen"
                variant="secondary"
                size="sm"
                onPress={() => void searchOnline()}
              />
              <Press
                haptic="selection"
                onPress={() => {
                  dismissedQueryRef.current = currentValueRef.current;
                  setShowDropdown(false);
                  Keyboard.dismiss();
                  router.push({
                    pathname: '/add-product',
                    params: { prefillName: value.trim() },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${value.trim()} manuell anlegen`}
                style={styles.row}>
                <View style={styles.flex}>
                  <Txt variant="body" weight="700">
                    + &quot;{value.trim()}&quot; manuell anlegen
                  </Txt>
                  <Txt variant="body" tone="secondary">
                    Kein Treffer im lokalen Katalog gefunden
                  </Txt>
                </View>
              </Press>
            </View>
          ) : null}
          {suggestions.map((item) => (
            <Press
              key={item.productId || item.barcode || item.name}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => {
                dismissedQueryRef.current = item.name;
                setSelectedName(item.name);
                onSelectProduct(item);
                setShowDropdown(false);
                // Auswahl beendet die Sucheingabe — Tastatur soll mitgehen
                // (#UI-Feedback: "Artikel auswählen schließt die Tastatur
                // nicht"), sonst bleibt sie ohne erkennbaren Grund offen.
                Keyboard.dismiss();
              }}
              style={styles.row}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Txt variant="body">🥫</Txt>
                </View>
              )}

              <View style={styles.flex}>
                <Txt variant="body" weight="700" numberOfLines={1}>
                  {item.name}
                </Txt>
                <Txt variant="body" tone="secondary" numberOfLines={1}>
                  {item.brand ? `${item.brand} · ` : ''}
                  {item.quantity !== undefined ? `${item.quantity} ${item.unit ?? ''}` : ''}
                  {item.caloriesPer100g ? ` · ${item.caloriesPer100g} kcal/100g` : ''}
                </Txt>
                {item.barcode ? (
                  <Txt variant="caption" tone="secondary" numberOfLines={1}>
                    EAN {item.barcode}
                  </Txt>
                ) : null}
              </View>
            </Press>
          ))}
          {loadingMore && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          )}
          {}
          <Pressable
            testID="product-search-dropdown-dismiss-area"
            style={styles.flex}
            accessible={false}
            onPress={dismiss}
          />
        </ScrollView>
      )}
    </View>
  );
});
