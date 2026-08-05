import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

/** Rezeptsammlung, im Haushalt geteilt (Phase 2). */
export function RecipesScreen() {
  return (
    <Screen title="Rezepte" subtitle="Im Haushalt geteilt">
      <Card>
        <EmptyState
          symbol="book"
          title="Noch keine Rezepte"
          hint="Eigene Rezepte berechnen ihre Nährwerte automatisch aus den Zutaten und lassen sich auf jede Portionszahl skalieren."
        />
      </Card>
    </Screen>
  );
}
