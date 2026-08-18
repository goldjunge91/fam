import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { ProgressBar } from '@/components/ui/progress-bar';
import { formatEuro } from '@/lib/format-currency';

interface StoreSummaryCardProps {
  name: string;
  color: string;
  totalCount: number;
  checkedCount: number;
  totalEstimate: number;
  onPress: () => void;
}

/**
 * Karte fuer die "Alle Listen"-Uebersicht: farbiger linker Streifen, Name,
 * Fortschritt und geschaetzte Summe (#150, Figma "02.01 · Einkauf —
 * Märkte"). `onPress` wechselt in die Detailansicht des Marktes.
 */
export function StoreSummaryCard({
  name,
  color,
  totalCount,
  checkedCount,
  totalEstimate,
  onPress,
}: StoreSummaryCardProps) {
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${checkedCount} von ${totalCount} Artikeln, ${formatEuro(totalEstimate)} geschätzt`}
      className="store-summary-card">
      {/* Dynamische Markt-Farbe aus der Datenbank */}
      <View className="store-summary-stripe" style={{ backgroundColor: color }} />

      <View className="flex-1 gap-1">
        <ThemedText type="smallBold">{name}</ThemedText>
        <ThemedText type="smallMuted">
          {checkedCount} von {totalCount} Artikeln erledigt
        </ThemedText>
        <View className="mt-[5px]">
          <ProgressBar value={progress} color={color} />
        </View>
      </View>

      <View className="items-end gap-[2px]">
        <ThemedText type="smallBold">{formatEuro(totalEstimate)}</ThemedText>
        <ThemedText type="smallMuted">geschätzt</ThemedText>
      </View>

      <ThemedText type="subtitle" themeColor="textSecondary">
        ›
      </ThemedText>
    </Pressable>
  );
}
