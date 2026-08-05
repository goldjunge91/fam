import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

/**
 * Kuehlschrank-Bestand, gruppiert nach Lagerort (#67).
 *
 * Die drei Lagerorte werden beim Anlegen eines Haushalts erzeugt (#39) und
 * stehen deshalb hier schon fest — auch wenn noch kein Haushalt existiert.
 */
const LAGERORTE = [
  { key: 'fridge', name: 'Kühlschrank' },
  { key: 'freezer', name: 'Gefrierfach' },
  { key: 'pantry', name: 'Vorratsschrank' },
] as const;

export function FridgeScreen() {
  return (
    <Screen title="Vorrat" subtitle="Für alle im Haushalt sichtbar">
      <Card>
        <EmptyState
          symbol="archivebox"
          title="Noch kein Haushalt"
          hint="Lege im Profil einen Haushalt an oder tritt einem bei. Danach teilt ihr Vorrat und Einkaufsliste in Echtzeit."
        />
      </Card>

      {LAGERORTE.map((ort) => (
        <Card key={ort.key} title={ort.name}>
          <ThemedText type="small" themeColor="textSecondary">
            Keine Artikel erfasst
          </ThemedText>
        </Card>
      ))}
    </Screen>
  );
}
