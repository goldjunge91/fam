import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Txt } from '@/constants/ui';
import type { LocalInventoryItem } from '@/features/inventory/use-inventory-items';
import type { RecipeSuggestionMeal } from '@/features/recipes/domain/recipe-suggestions';

const styles = StyleSheet.create((theme) => ({
  list: {
    borderTopWidth: theme.borderWidth.base,
    borderTopColor: theme.border,
  },
  meal: {
    gap: theme.space.md,
    paddingVertical: theme.space.lg,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  heading: {
    gap: theme.space.xs,
  },
  ingredients: {
    gap: theme.space.sm,
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  ingredientName: {
    flex: 1,
    minWidth: 0,
  },
}));

function sourceLabel(source: RecipeSuggestionMeal['source']): string {
  if (source === 'catalog') return 'Aus dem Katalog';
  if (source === 'template') return 'Aus einer Vorlage';
  return 'Neu formuliert';
}

function formatQuantity(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 3 });
}

export function RecipeSuggestionResults({
  meals,
  inventory,
  selectedInventoryItemIds = [],
  onCook,
}: {
  meals: readonly RecipeSuggestionMeal[];
  inventory: readonly Pick<LocalInventoryItem, 'id' | 'name'>[];
  selectedInventoryItemIds?: readonly string[];
  onCook: (meal: RecipeSuggestionMeal) => void;
}) {
  const names = new Map(inventory.map((item) => [item.id, item.name]));
  const selectedIds = new Set(selectedInventoryItemIds);

  return (
    <View style={styles.list}>
      {meals.map((meal, index) => (
        <View key={meal.recipe_id ?? `${meal.title}-${index}`} style={styles.meal}>
          <View style={styles.heading}>
            <Txt variant="caption" tone="success" weight="700">
              {sourceLabel(meal.source)}
            </Txt>
            <Txt variant="title">{meal.title}</Txt>
            <Txt variant="caption" tone="secondary">
              {meal.servings} Portionen
            </Txt>
            {selectedInventoryItemIds.length > 0 ? (
              <Txt variant="caption" tone="success">
                {`Verwendet ${meal.used_items.filter((item) => selectedIds.has(item.inventory_item_id)).length} von ${selectedInventoryItemIds.length} ausgewählten Lebensmitteln`}
              </Txt>
            ) : null}
          </View>
          <View style={styles.ingredients}>
            {meal.used_items.map((item) => (
              <View key={item.inventory_item_id} style={styles.ingredient}>
                <Txt variant="body" numberOfLines={1} style={styles.ingredientName}>
                  {names.get(item.inventory_item_id) ?? 'Lebensmittel'}
                </Txt>
                <Txt variant="body" tone="secondary">
                  {item.quantity} {item.unit}
                </Txt>
              </View>
            ))}
          </View>
          {meal.additional_ingredients.length > 0 ? (
            <Txt variant="caption" tone="warning">
              Schon auf der Einkaufsliste: {meal.additional_ingredients.join(', ')}
            </Txt>
          ) : null}
          {meal.shopping_needs && meal.shopping_needs.length > 0 ? (
            <Txt variant="caption" tone="warning">
              Noch einzukaufen:{' '}
              {meal.shopping_needs
                .map((need) => `${formatQuantity(need.quantity)} ${need.unit} ${need.name}`)
                .join(', ')}
            </Txt>
          ) : null}
          <Button
            title="Kochen"
            variant="accent"
            accentKey="ai-chef"
            onPress={() => onCook(meal)}
          />
        </View>
      ))}
    </View>
  );
}
