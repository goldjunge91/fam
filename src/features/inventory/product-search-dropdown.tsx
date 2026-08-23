import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { dedupeProductsByBarcode, searchOffDump } from '@/lib/off-dump/off-dump';
import { type OpenFoodFactsProduct, searchOpenFoodFacts } from '@/lib/open-food-facts';

/** Unter dieser Zahl lokaler Treffer lohnt sich der zusaetzliche OFF-Request noch. */
const LOCAL_RESULT_THRESHOLD = 5;

/** Seitengroesse fuer OFF-Nachladen beim Scrollen, siehe `loadMoreOffResults`. */
const OFF_PAGE_SIZE = 100;

/** Wie nah am unteren Rand (px) das Nachladen beim Scrollen ausloest. */
const LOAD_MORE_THRESHOLD_PX = 70;

/**
 * Abstand zum unteren Bildschirm-/Tastaturrand, den das Dropdown frei laesst.
 * War vorher 12px — bei laengeren, nachladenden Ergebnislisten (z.B. "Milch")
 * wird das echte Listenende praktisch nie erreicht, das Panel wird also fast
 * immer exakt hier abgeschnitten. 12px wirkte dadurch wie "bis zum Rand"
 * (#UI-Feedback: "immer noch bis zum Rand unten, das ist zu tief").
 */
const PANEL_BOTTOM_MARGIN = 24;

/** Nie kleiner als das, selbst wenn oberhalb kaum Platz gemessen wird. */
const PANEL_MIN_HEIGHT = 140;

/** Bis die erste Messung vorliegt (Layout noch nicht bekannt), z.B. beim allerersten Render. */
const PANEL_FALLBACK_HEIGHT = 220;

type LocalProductRow = {
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal_per_100: number | null;
  protein_g_per_100: number | null;
  carbs_g_per_100: number | null;
  fat_g_per_100: number | null;
  /** JSON-serialisiertes `text[]` (#223), siehe `off_category_tags` in `migrations.ts`. */
  off_category_tags?: string | null;
  off_last_modified_at?: string | null;
};

/** Robust gegen fehlendes/kaputtes JSON — ein Parse-Fehler darf die Suche nicht abbrechen. */
function parseCategoryTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    return [];
  }
}

function toOpenFoodFactsProduct(row: LocalProductRow): OpenFoodFactsProduct {
  return {
    barcode: row.barcode ?? '',
    name: row.name,
    brand: row.brand ?? undefined,
    caloriesPer100g: row.kcal_per_100 ?? undefined,
    proteinsPer100g: row.protein_g_per_100 ?? undefined,
    carbsPer100g: row.carbs_g_per_100 ?? undefined,
    fatPer100g: row.fat_g_per_100 ?? undefined,
    categoryTags: parseCategoryTags(row.off_category_tags),
    offLastModifiedAt: row.off_last_modified_at ?? undefined,
  };
}

/**
 * Lokale Suche gegen den `products`-Spiegel (#75) — SQLite hat keine
 * FTS/tsvector-Entsprechung wie der Server, ein einfaches `LIKE` reicht fuer
 * den gepflegten, deutlich kleineren lokalen Bestand. Bleibt bewusst ohne
 * Pagination: der selbst angelegte Bestand ist klein, 20 Treffer reichen hier
 * praktisch immer — anders als beim OFF-Dump unten.
 */
async function searchOwnProducts(query: string): Promise<OpenFoodFactsProduct[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalProductRow>(
    `select barcode, name, brand, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100,
            off_category_tags, off_last_modified_at
     from products
     where deleted_at is null and lower(name) like ?
     order by name
     limit 20`,
    [`%${query.trim().toLowerCase()}%`],
  );
  return rows.map(toOpenFoodFactsProduct);
}

/**
 * Lokale Suche insgesamt: erst der eigene, gepflegte `products`-Spiegel,
 * dann — falls das noch nicht reicht — die erste Seite des grossen
 * angehaengten OFF-Dumps. So liefert die Suche auch ohne Netz brauchbare
 * Treffer statt nur der Handvoll selbst angelegten Produkte. `dumpHasMore`
 * sagt dem Aufrufer, ob beim Scrollen weitere Dump-Seiten sich lohnen.
 */
async function searchLocalProducts(
  query: string,
): Promise<{ results: OpenFoodFactsProduct[]; dumpHasMore: boolean }> {
  const ownResults = await searchOwnProducts(query);
  if (ownResults.length >= LOCAL_RESULT_THRESHOLD) {
    return { results: ownResults, dumpHasMore: false };
  }

  const { products: dumpResults, hasMore } = await searchOffDump(query, {
    limit: OFF_PAGE_SIZE,
  });
  return {
    results: dedupeProductsByBarcode([...ownResults, ...dumpResults]),
    dumpHasMore: hasMore,
  };
}

interface ProductSearchDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectProduct: (product: OpenFoodFactsProduct) => void;
  inputStyle?: StyleProp<TextStyle>;
  trailing?: ReactNode;
  size?: 'default' | 'large';
}

export type ProductSearchDropdownHandle = {
  dismiss: () => void;
  /**
   * Markiert einen bevorstehenden `value`-Wechsel als bereits erledigte
   * Auswahl (#UI-Feedback: "Auswaehlen eines History-Artikels soll die
   * Suchliste nicht ausloesen") — fuer Aufrufer, die den Namen von AUSSEN
   * setzen (z.B. ein Häufig/Zuletzt-Vorschlag), statt eine Zeile in dieser
   * Komponente selbst anzutippen. Ohne das haelt der Such-Effekt unten den
   * Wertwechsel fuer neue Eingabe und oeffnet die Liste erneut. Vor dem
   * eigentlichen `setName(...)` des Aufrufers aufrufen.
   */
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
  const theme = useTheme();
  const [suggestions, setSuggestions] = useState<OpenFoodFactsProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searched, setSearched] = useState(false);
  // Paginierungs-Status fuer das Nachladen weiterer OFF-Seiten beim Scrollen
  // (#Performance-Feedback: "OpenFoodFacts findet 700+, angezeigt werden nur
  // ~30" — ohne das kappt die erste Seite die Suche hart).
  const [offPage, setOffPage] = useState(1);
  const [offHasMore, setOffHasMore] = useState(false);
  // Nachlade-Status fuer den lokalen OFF-Dump, unabhaengig vom Netz-OFF-Status
  // oben — beide Quellen koennen hunderte Treffer haben und werden nacheinander
  // ausgeschoepft (erst Dump, dann Netz), siehe `loadMoreOffResults`.
  const [dumpOffset, setDumpOffset] = useState(0);
  const [dumpHasMore, setDumpHasMore] = useState(false);
  const [loadingMoreOff, setLoadingMoreOff] = useState(false);
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
  // `value` beim Ausloesen der aktuellen Suche — schuetzt vor veralteten
  // Nachlade-Antworten, wenn der Nutzer inzwischen weitergetippt hat.
  const queryRef = useRef(value);
  queryRef.current = value;
  // `value` aendert sich auch, wenn `onSelectProduct` den Query-Text auf den
  // gewaehlten Produktnamen setzt (siehe recipe-create-screen.tsx). Ohne diese
  // Markierung faengt der Such-Effekt unten diese Aenderung ab und oeffnet das
  // Dropdown eine Suche spaeter erneut — Auswahl wirkte dann wie 2x noetig.
  // Initialisiert mit `value` (statt `null`), damit ein bereits befuellter
  // Anfangswert beim (Re-)Mount nicht als neue Eingabe zaehlt — sonst oeffnet
  // sich beim Zurueckblaettern im Rezept-Wizard (Schritt wechseln und zurueck
  // entfernt/erzeugt diesen Baum neu) die Trefferliste erneut fuer jede bereits
  // ausgewaehlte Zutat (#UI-Feedback: "oeffnet sich fuer alle Zutaten das
  // Modal der Suche").
  const justSelectedValueRef = useRef<string | null>(value);

  /**
   * Schliesst nur die Trefferliste, nicht die Tastatur — Gegenstueck ist
   * `Keyboard.dismiss()`, das gezielt nur die Tastatur schliesst. Die beiden
   * sind bewusst entkoppelt (#UI-Feedback): "Fertig" auf der Tastatur oder ein
   * Tap daneben/darueber soll nur die Tastatur wegnehmen, die Liste bleibt
   * sichtbar, bis tatsaechlich ein Artikel ausgewaehlt wird.
   */
  function dismiss() {
    setShowDropdown(false);
  }

  useImperativeHandle(ref, () => ({
    dismiss,
    markSelected: (name: string) => {
      justSelectedValueRef.current = name;
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
      const bottomLimit = keyboardTopY ?? windowHeight;
      const available = bottomLimit - (y + height) - PANEL_BOTTOM_MARGIN;
      setPanelMaxHeight(Math.max(available, PANEL_MIN_HEIGHT));
    });
  }, [showDropdown, windowHeight, keyboardTopY]);

  useEffect(() => {
    if (justSelectedValueRef.current !== null) {
      const wasSelection = justSelectedValueRef.current === value;
      justSelectedValueRef.current = null;
      if (wasSelection) return;
    }

    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setSearched(false);
      setOffHasMore(false);
      setOffPage(1);
      setDumpHasMore(false);
      setDumpOffset(0);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setOffHasMore(false);
      setOffPage(1);
      setDumpHasMore(false);
      setDumpOffset(0);

      const { results: localResults, dumpHasMore } = await searchLocalProducts(value);
      setDumpHasMore(dumpHasMore);
      const needsOffLookup =
        localResults.length < LOCAL_RESULT_THRESHOLD && onlineManager.isOnline();

      if (!needsOffLookup) {
        setSuggestions(localResults);
      } else {
        const { products: offResults, hasMore } = await searchOpenFoodFacts(value, {
          page: 1,
          pageSize: OFF_PAGE_SIZE,
        });
        const localBarcodes = new Set(localResults.map((p) => p.barcode).filter(Boolean));
        const dedupedOffResults = offResults.filter((p) => !localBarcodes.has(p.barcode));
        setSuggestions([...localResults, ...dedupedOffResults]);
        setOffHasMore(hasMore);
      }

      setSearched(true);
      setShowDropdown(true);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  /**
   * Laedt beim Scrollen ans Ende des Dropdowns nach — erst weitere Seiten des
   * lokalen OFF-Dumps (guenstig, kein Rate-Limit), erst wenn der ausgeschoepft
   * ist, weitere Seiten der Netz-Suche. Ohne das war bei Begriffen mit
   * hunderten Treffern (z. B. "Milch") nach der ersten Seite (20) Schluss,
   * obwohl sowohl Dump als auch OFF deutlich mehr liefern.
   */
  async function loadMoreOffResults() {
    if (loadingMoreOff || searching) return;
    const currentQuery = queryRef.current;

    if (dumpHasMore) {
      const nextOffset = dumpOffset + OFF_PAGE_SIZE;
      setLoadingMoreOff(true);
      const { products: dumpResults, hasMore } = await searchOffDump(currentQuery, {
        offset: nextOffset,
        limit: OFF_PAGE_SIZE,
      });
      if (queryRef.current === currentQuery) {
        setSuggestions((prev) => dedupeProductsByBarcode([...prev, ...dumpResults]));
        setDumpHasMore(hasMore);
        setDumpOffset(nextOffset);
      }
      setLoadingMoreOff(false);
      return;
    }

    if (!offHasMore) return;
    const nextPage = offPage + 1;
    setLoadingMoreOff(true);

    const { products: offResults, hasMore } = await searchOpenFoodFacts(currentQuery, {
      page: nextPage,
      pageSize: OFF_PAGE_SIZE,
    });

    if (queryRef.current === currentQuery) {
      setSuggestions((prev) => dedupeProductsByBarcode([...prev, ...offResults]));
      setOffHasMore(hasMore);
      setOffPage(nextPage);
    }
    setLoadingMoreOff(false);
  }

  const showEmptyState = searched && !searching && suggestions.length === 0;

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
        trailing={trailing}
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

      {searching && (
        <View className="psd-spinner">
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      )}

      {showDropdown && (suggestions.length > 0 || showEmptyState) && (
        <View className="relative">
          {/* Schliesst nur die Trefferliste (kein Auswahl-Ersatz) — der einzige
              explizite Weg, die Liste ohne Artikel-Auswahl zuzumachen
              (#UI-Feedback: "Suchliste lässt sich nicht schliessen", seit
              Tastatur/Liste bewusst entkoppelt sind). */}
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Trefferliste schließen"
            className="psd-panel-close">
            <ThemedText themeColor="textSecondary" className="text-[13px] font-bold">
              ✕
            </ThemedText>
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
              if (distanceToBottom < LOAD_MORE_THRESHOLD_PX) loadMoreOffResults();
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
                  <ThemedText
                    type={size === 'large' ? 'body' : 'smallBold'}
                    className={size === 'large' ? 'font-bold' : undefined}>
                    + &quot;{value.trim()}&quot; manuell anlegen
                  </ThemedText>
                  <ThemedText
                    type={size === 'large' ? 'body' : 'small'}
                    themeColor="textSecondary"
                    className={size === 'large' ? 'font-medium' : undefined}>
                    Kein Treffer bei Open Food Facts gefunden
                  </ThemedText>
                </View>
              </Pressable>
            ) : null}
            {suggestions.map((item) => (
              <Pressable
                key={item.barcode || item.name}
                onPress={() => {
                  justSelectedValueRef.current = item.name;
                  onSelectProduct(item);
                  setShowDropdown(false);
                  // Auswahl beendet die Sucheingabe — Tastatur soll mitgehen
                  // (#UI-Feedback: "Artikel auswählen schließt die Tastatur
                  // nicht"), sonst bleibt sie ohne erkennbaren Grund offen.
                  Keyboard.dismiss();
                }}
                className="psd-row">
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} className="psd-thumb" />
                ) : (
                  <View className="psd-thumb-fallback">
                    <ThemedText type={size === 'large' ? 'body' : 'bodySmall'}>🥫</ThemedText>
                  </View>
                )}

                <View className="flex-1">
                  <ThemedText
                    type={size === 'large' ? 'body' : 'smallBold'}
                    numberOfLines={1}
                    className={size === 'large' ? 'font-bold' : undefined}>
                    {item.name}
                  </ThemedText>
                  <ThemedText
                    type={size === 'large' ? 'body' : 'small'}
                    themeColor="textSecondary"
                    numberOfLines={1}
                    className={size === 'large' ? 'font-medium' : undefined}>
                    {item.brand ? `${item.brand} · ` : ''}
                    {item.quantity} {item.unit}
                    {item.caloriesPer100g ? ` · ${item.caloriesPer100g} kcal/100g` : ''}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
            {loadingMoreOff && (
              <View className="py-two items-center">
                <ActivityIndicator size="small" color={theme.accent} />
              </View>
            )}
            {/* Faengt Taps auf die restliche Leerflaeche unterhalb der Treffer
              ab (siehe `flexGrow: 1` oben) — ohne das ist bei offener, fast
              bildschirmfuellender Suche kein Blank-Tap-Ziel mehr erreichbar.
              Schliesst nur die Tastatur, nicht die Liste (#UI-Feedback: Liste
              bleibt offen, bis tatsaechlich ein Artikel ausgewaehlt wird). */}
            <Pressable className="flex-1" accessible={false} onPress={() => Keyboard.dismiss()} />
          </ScrollView>
        </View>
      )}
    </View>
  );
});
