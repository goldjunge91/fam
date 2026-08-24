import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useTheme } from '@/hooks/use-theme';
import { formatEuro } from '@/lib/format-currency';

interface StoreSummaryCardProps {
  name: string;
  color: string;
  totalCount: number;
  checkedCount: number;
  totalEstimate: number;
  /** Wiedererkennungsfarben der Kategorien mit noch offenen Artikeln, s. `distinctCategoryColors`. */
  openCategoryColors: string[];
  onPress: () => void;
}

const MAX_CATEGORY_DOTS = 4;

/**
 * Zeile fuer die "Alle Listen"-Uebersicht: farbiger linker Streifen, Name,
 * Fortschritt, Kategorievorschau und geschaetzte Summe (Mockup "Einkauf
 * Uebersicht", Variante 2 "Kompakt mit Kategorievorschau"). `onPress`
 * wechselt in die Detailansicht des Marktes.
 *
 * Bewusst als dichte Zeile statt Karte: bei mehreren Maerkten dominierten
 * die vorherigen grosszuegigen Karten den Screen, ohne mehr Information zu
 * zeigen. Die Kategoriepunkte darunter geben zusaetzlich einen Hinweis, was
 * fachlich noch fehlt, ohne den Markt erst zu oeffnen.
 *
 * Der Fortschrittsbalken laeuft in Accent-Mauve, bei vollstaendig erledigten
 * Maerkten in Success-Gruen — die Marktfarbe bleibt als schmaler Streifen die
 * einzige Wiedererkennung.
 */
export function StoreSummaryCard({
  name,
  color,
  totalCount,
  checkedCount,
  totalEstimate,
  openCategoryColors,
  onPress,
}: StoreSummaryCardProps) {
  const theme = useTheme();
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;
  const isComplete = totalCount > 0 && checkedCount === totalCount;
  const visibleDots = openCategoryColors.slice(0, MAX_CATEGORY_DOTS);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${checkedCount} von ${totalCount} Artikeln, ${formatEuro(totalEstimate)} geschätzt`}
      className="store-summary-row">
      {/* Dynamische Markt-Farbe aus der Datenbank */}
      <View className="store-summary-stripe" style={{ backgroundColor: color }} />

      <View className="flex-1 gap-1">
        <View className="flex-row items-baseline justify-between gap-two">
          <ThemedText type="smallBold" numberOfLines={1} className="flex-1">
            {name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {checkedCount} / {totalCount}
          </ThemedText>
        </View>
        <ProgressBar
          height={3}
          value={progress}
          color={isComplete ? theme.success : theme.accent}
        />
        <View className="flex-row items-center gap-1 mt-[1px]">
          {totalCount === 0 ? (
            <ThemedText type="caption" themeColor="textSecondary">
              keine Artikel
            </ThemedText>
          ) : isComplete ? (
            <ThemedText type="caption" themeColor="success" className="font-semibold">
              alles erledigt
            </ThemedText>
          ) : (
            <>
              {visibleDots.map((dotColor) => (
                // Kategoriefarben sind schon dedupliziert (distinctCategoryColors) — eindeutig als Key
                <View
                  key={dotColor}
                  className="w-[7px] h-[7px] rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
              ))}
              <ThemedText type="caption" themeColor="textSecondary">
                offen
              </ThemedText>
            </>
          )}
        </View>
      </View>

      <View className="items-end gap-[2px]">
        <ThemedText type="smallBold">{formatEuro(totalEstimate)}</ThemedText>
        <ThemedText type="smallMuted">geschätzt</ThemedText>
      </View>
    </Pressable>
  );
}
