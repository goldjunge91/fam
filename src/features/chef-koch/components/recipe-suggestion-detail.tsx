import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Press, Txt } from '@/constants/ui';
import type { LocalInventoryItem } from '@/features/inventory/use-inventory-items';
import type { RecipeSuggestionMeal } from '@/features/recipes/domain/recipe-suggestions';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { resolveCategoryForItem } from '@/features/shopping-list/preferences/api';

function formatQuantity(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 3 });
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.xl,
  },
  heading: {
    gap: theme.space.xs,
  },
  ingredients: {
    borderTopWidth: theme.borderWidth.base,
    borderTopColor: theme.border,
  },
  ingredient: {
    minHeight: theme.controlSizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  ingredientName: {
    flex: 1,
    minWidth: 0,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.md,
    paddingVertical: theme.space.md,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSoft,
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: theme.space.xs,
  },
  shopping: {
    gap: theme.space.md,
  },
  shoppingNeeds: {
    borderTopWidth: theme.borderWidth.base,
    borderTopColor: theme.border,
  },
  shoppingNeed: {
    minHeight: theme.controlSizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  shoppingNeedName: {
    flex: 1,
    minWidth: 0,
  },
}));

export function RecipeSuggestionDetail({
  meal,
  inventory,
  householdId,
  onBack,
}: {
  meal: RecipeSuggestionMeal;
  inventory: readonly Pick<LocalInventoryItem, 'id' | 'name'>[];
  householdId: string;
  onBack: () => void;
}) {
  const shoppingNeeds = meal.shopping_needs ?? [];
  const names = new Map(inventory.map((item) => [item.id, item.name]));
  const stepOccurrences = new Map<string, number>();
  const steps = meal.steps.map((step) => {
    const occurrence = (stepOccurrences.get(step) ?? 0) + 1;
    stepOccurrences.set(step, occurrence);
    return { key: `${step}:${occurrence}`, step };
  });

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <Txt variant="caption" tone="accent" weight="700">
          Zubereitung
        </Txt>
        <Txt variant="heading">{meal.title}</Txt>
        <Txt variant="body" tone="secondary">
          {meal.servings} Portionen
        </Txt>
      </View>

      <View style={styles.ingredients}>
        {meal.used_items.map((item) => (
          <View key={item.inventory_item_id} style={styles.ingredient}>
            <Txt variant="body" style={styles.ingredientName}>
              {names.get(item.inventory_item_id) ?? 'Lebensmittel'}
            </Txt>
            <Txt variant="body" tone="secondary">
              {item.quantity} {item.unit}
            </Txt>
          </View>
        ))}
      </View>

      {shoppingNeeds.length > 0 ? (
        <RecipeSuggestionShoppingNeeds
          needs={shoppingNeeds}
          householdId={householdId}
          recipeTitle={meal.title}
        />
      ) : null}

      <View>
        {steps.map(({ key, step }, index) => (
          <View key={key} style={styles.step}>
            <View style={styles.stepNumber}>
              <Txt variant="caption" weight="700">
                {index + 1}
              </Txt>
            </View>
            <Txt variant="body" style={styles.stepCopy}>
              {step}
            </Txt>
          </View>
        ))}
      </View>

      <Txt variant="caption" tone="secondary">
        Diese Ansicht verändert den Bestand nicht.
      </Txt>
      <Button title="Zurück zu Vorschlägen" variant="secondary" onPress={onBack} />
    </View>
  );
}

function RecipeSuggestionShoppingNeeds({
  needs,
  householdId,
  recipeTitle,
}: {
  needs: NonNullable<RecipeSuggestionMeal['shopping_needs']>;
  householdId: string;
  recipeTitle: string;
}) {
  const [selected, setSelected] = useState(() => new Set(needs.map(shoppingNeedKey)));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);
  const addShoppingItem = useAddShoppingItem();

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setStatus(null);
  }

  async function addSelected() {
    const selectedNeeds = needs.filter((need) => selected.has(shoppingNeedKey(need)));
    if (selectedNeeds.length === 0) return;

    setIsSubmitting(true);
    setStatus(null);
    try {
      for (const need of selectedNeeds) {
        const classification = await resolveCategoryForItem({
          householdId,
          name: need.name,
          source: 'free_text',
        });
        await addShoppingItem.mutateAsync({
          household_id: householdId,
          name: need.name,
          quantity: need.quantity,
          unit: need.unit,
          category_id: classification.categoryId,
          category_source: classification.source,
          category_classifier_version: classification.classifierVersion,
          recipe_names: [recipeTitle],
        });
        setSelected((current) => {
          const next = new Set(current);
          next.delete(shoppingNeedKey(need));
          return next;
        });
      }
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.shopping}>
      <View style={styles.heading}>
        <Txt variant="heading">Fehlende Zutaten</Txt>
        <Txt variant="caption" tone="secondary">
          Wähle aus, was auf die Einkaufsliste soll.
        </Txt>
      </View>
      <View style={styles.shoppingNeeds}>
        {needs.map((need) => {
          const key = shoppingNeedKey(need);
          const checked = selected.has(key);
          return (
            <Press
              key={key}
              accessibilityRole="checkbox"
              accessibilityLabel={`${need.name}, ${formatQuantity(need.quantity)} ${need.unit}`}
              accessibilityState={{ checked }}
              haptic="selection"
              disabled={isSubmitting}
              onPress={() => toggle(key)}
              style={styles.shoppingNeed}>
              <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
                {checked ? <Txt tone="onAccent">✓</Txt> : null}
              </View>
              <Txt variant="body" numberOfLines={1} style={styles.shoppingNeedName}>
                {need.name}
              </Txt>
              <Txt variant="body" tone="secondary">
                {formatQuantity(need.quantity)} {need.unit}
              </Txt>
            </Press>
          );
        })}
      </View>
      <Button
        title={isSubmitting ? 'Wird hinzugefügt …' : 'Auswahl zur Einkaufsliste'}
        variant="accent"
        accentKey="ai-chef"
        disabled={isSubmitting || selected.size === 0}
        onPress={() => void addSelected()}
      />
      {status === 'saved' ? (
        <Txt variant="caption" tone="success">
          Die Einkaufsliste wurde aktualisiert.
        </Txt>
      ) : null}
      {status === 'error' ? (
        <Txt variant="caption" tone="danger" accessibilityRole="alert">
          Zutaten konnten nicht zur Einkaufsliste hinzugefügt werden. Versuche es erneut.
        </Txt>
      ) : null}
    </View>
  );
}

function shoppingNeedKey(need: { name: string; unit: string }): string {
  return `${need.name.trim().toLocaleLowerCase('de-DE')}\u0000${need.unit.trim().toLocaleLowerCase('de-DE')}`;
}
