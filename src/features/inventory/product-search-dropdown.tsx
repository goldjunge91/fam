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

import { useTheme } from '@/components/theme/ThemeProvider';
import { TextField, Txt } from '@/constants/ui';
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

interface ProductSearchDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectProduct: (product: CatalogProduct) => void;
  inputStyle?: StyleProp<TextStyle>;
  trailing?: ReactNode;
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

  function dismiss() {
    setShowDropdown(false);
  }

  useImperativeHandle(ref, () => ({
    dismiss,
    markSelected: setSelectedName,
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
      const bottomLimit = keyboardTopY ?? windowHeight;
      const available = bottomLimit - (y + height) - PANEL_BOTTOM_MARGIN;
      setPanelMaxHeight(Math.max(available, PANEL_MIN_HEIGHT));
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
    searched,
    loadMore,
  } = useProductSearch(searchQuery, { preferredMarket, pageSize: PAGE_SIZE });

  useEffect(() => {
    if (searched) setShowDropdown(true);
  }, [searched]);

  const showEmptyState = searched && !searching && suggestions.length === 0;
  const trailingContent = searching ? (
    <View className="flex-row items-center gap-one">
      <ActivityIndicator size="small" color={colors.basil} />
      {trailing}
    </View>
  ) : (
    trailing
  );

  return (
    <View
      ref={wrapperRef}
      className="relative z-10"
      onTouchStart={(event) => event.stopPropagation()}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        style={inputStyle}
        trailing={trailingContent}
        size={size}
        // Return-Taste schliesst nur die Tastatur, die Trefferliste bleibt
        // offen (#UI-Feedback: Liste soll erst bei tatsaechlicher Auswahl
        // zugehen, nicht schon beim blossen Wegnehmen der Tastatur).
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
        onChangeText={(text) => {
          onChangeText(text);
          setShowDropdown(true);
        }}
      />

      {showDropdown && (suggestions.length > 0 || showEmptyState) && (
        <View className="relative">
          {}
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Trefferliste schließen"
            className="psd-panel-close">
            <Txt variant="caption" tone="secondary" weight="700">
              ✕
            </Txt>
          </Pressable>
          <ScrollView
            className="psd-panel"
            // elevation ist ein Android-only-Wert ohne Tailwind-Aequivalent
            // (boxShadow deckt nur den iOS/Web-Schatten ab). maxHeight kommt aus
            // der Live-Messung oben statt einer festen Klasse — die Liste soll
            // bis zum unteren Rand reichen, nicht pauschal bei 220px kappen.
            style={{ elevation: 4, maxHeight: panelMaxHeight ?? PANEL_FALLBACK_HEIGHT }}
            // Ohne das stoesst die letzte Zeile direkt an den unteren, abgerundeten
            // Panel-Rand — sieht abgeschnitten aus (#UI-Feedback: "Liste ist zu tief").
            contentContainerClassName="pb-two"
            // `flexGrow: 1` sorgt dafuer, dass bei wenigen Treffern echte
            // Leerflaeche im Content-Container entsteht (statt shrink-wrap auf
            // die paar Zeilen) — die faengt der Pressable am Ende des Contents
            // unten ab, damit Tippen dort die Tastatur schliesst (#UI-Feedback:
            // "Leerflaeche neben dem Suchfeld schliesst Tastatur nicht"; das
            // randfuellende Panel bedeckt bei offener Suche fast den ganzen
            // Bildschirm, ein Formular-weiter Blank-Tap-Handler erreicht es nicht).
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            onScroll={({ nativeEvent }) => {
              const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
              const distanceToBottom =
                contentSize.height - contentOffset.y - layoutMeasurement.height;
              if (distanceToBottom < LOAD_MORE_THRESHOLD_PX) loadMore();
            }}
            scrollEventThrottle={100}>
            {showEmptyState ? (
              <Pressable
                onPress={() => {
                  setShowDropdown(false);
                  Keyboard.dismiss();
                  router.push({
                    pathname: '/add-product',
                    params: { prefillName: value.trim() },
                  });
                }}
                className="psd-row">
                <View className="flex-1">
                  <Txt variant="body" weight="700">
                    + &quot;{value.trim()}&quot; manuell anlegen
                  </Txt>
                  <Txt variant="body" tone="secondary">
                    Kein Treffer bei Open Food Facts gefunden
                  </Txt>
                </View>
              </Pressable>
            ) : null}
            {suggestions.map((item) => (
              <Pressable
                key={item.productId || item.barcode || item.name}
                onPress={() => {
                  setSelectedName(item.name);
                  onSelectProduct(item);
                  setShowDropdown(false);
                  // Auswahl beendet die Sucheingabe — Tastatur soll mitgehen
                  // (#UI-Feedback: "Artikel auswählen schließt die Tastatur
                  // nicht"), sonst bleibt sie ohne erkennbaren Grund offen.
                  Keyboard.dismiss();
                }}
                className="psd-row">
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: 32, height: 32, borderRadius: 12 }}
                  />
                ) : (
                  <View className="psd-thumb-fallback">
                    <Txt variant="body">🥫</Txt>
                  </View>
                )}

                <View className="flex-1">
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
              </Pressable>
            ))}
            {loadingMore && (
              <View className="py-two items-center">
                <ActivityIndicator size="small" color={colors.basil} />
              </View>
            )}
            {}
            <Pressable className="flex-1" accessible={false} onPress={() => Keyboard.dismiss()} />
          </ScrollView>
        </View>
      )}
    </View>
  );
});
