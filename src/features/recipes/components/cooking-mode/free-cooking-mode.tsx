import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { flattenRecipeItems } from '../../domain/ingredient-mentions';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { StepMentionText } from '../step-mention-text';
import { CookingModeShell } from './cooking-mode-shell';

const styles = StyleSheet.create((theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: rs(24),
    paddingBottom: rs(24),
    gap: rs(14),
  },
  title: {
    paddingTop: rs(6),
  },
  instructions: {
    paddingTop: theme.space.lg,
  },
  steps: {
    gap: theme.space.lg,
  },
  stepRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  stepText: {
    flex: 1,
  },
  unlockContainer: {
    marginTop: 'auto',
  },
  unlock: {
    minHeight: rs(48),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  groups: {
    borderRadius: theme.radius.lg,
    padding: rs(13),
    gap: rs(18),
  },
  groupHeader: {
    minHeight: rs(40),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(10),
    borderBottomWidth: 0.5,
  },
  groupTitle: {
    flex: 1,
  },
  ingredientRow: {
    minHeight: rs(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
  },
  ingredientDivider: {
    borderBottomWidth: 0.5,
  },
  ingredientName: {
    flex: 1,
  },
}));

export function FreeCookingMode({ data }: { data: RecipeDetail }) {
  const { colors } = useTheme();
  const { recipe, steps } = data;
  const mentionIngredients = flattenRecipeItems(data.items, data.productsById);

  return (
    <CookingModeShell title="Kochmodus" backLabel="Kochmodus schließen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Txt variant="heading" style={styles.title}>
          {recipe.title}
        </Txt>

        <IngredientGroups data={data} />

        {recipe.instructions ? (
          <Txt variant="caption" tone="secondary" style={styles.instructions}>
            {recipe.instructions}
          </Txt>
        ) : null}

        {steps.length > 0 ? (
          <View style={styles.steps}>
            {steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                <Txt variant="caption" tone="primary" weight="700">
                  {step.position + 1}.
                </Txt>
                <StepMentionText
                  text={step.text}
                  ingredients={mentionIngredients}
                  variant="caption"
                  style={styles.stepText}
                  weight="500"
                />
              </View>
            ))}
          </View>
        ) : null}

        <Press
          onPress={() =>
            router.push({ pathname: '/settings/plus-and-ai', params: { tier: 'plus' } })
          }
          role="button"
          containerStyle={styles.unlockContainer}
          style={[styles.unlock, { backgroundColor: colors.basil }]}>
          <Txt variant="caption" tone="inverse" weight="700" center>
            Geführten Kochmodus freischalten
          </Txt>
        </Press>
      </ScrollView>
    </CookingModeShell>
  );
}

function round(value: number): number {
  return Math.round(value);
}

function IngredientGroups({ data }: { data: RecipeDetail }) {
  const { colors } = useTheme();
  const groupsWithServingWeight = data.components.filter(
    (component) => component.serving_grams !== null,
  );
  // Katalogrezepte haben teilweise keine zubereiteten Gruppen-Gewichte.
  // In diesem Fall sind trotzdem alle vorhandenen Komponenten echte Gruppen.
  const groups = groupsWithServingWeight.length > 0 ? groupsWithServingWeight : data.components;
  const componentNames = new Map(
    data.components.map((component) => [component.id, component.name]),
  );

  if (groups.length === 0) {
    return null;
  }

  return (
    <View style={[styles.groups, { backgroundColor: colors.surface }]}>
      {groups.map((component) => {
        const items = data.items.filter((item) => item.component_id === component.id);

        return (
          <View key={component.id}>
            <View style={[styles.groupHeader, { borderBottomColor: colors.border }]}>
              <Txt variant="heading" style={styles.groupTitle}>
                {component.name}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {round(component.serving_grams ?? 0)} g zubereitet
              </Txt>
            </View>
            {items.map((item, index) => {
              const product = item.product_id ? data.productsById.get(item.product_id) : undefined;
              const name =
                product?.name ??
                item.ingredient_name ??
                (item.sub_component_id ? componentNames.get(item.sub_component_id) : undefined) ??
                'Zutat';
              const quantity = item.quantity !== null ? item.quantity : item.grams;
              const unit = item.quantity !== null ? item.unit : 'g';

              return (
                <View
                  key={item.id}
                  style={[
                    styles.ingredientRow,
                    index < items.length - 1
                      ? [styles.ingredientDivider, { borderBottomColor: colors.border }]
                      : undefined,
                  ]}>
                  <Txt variant="body" weight="500" style={styles.ingredientName} numberOfLines={1}>
                    {name}
                  </Txt>
                  <Txt variant="body" tone="secondary" weight="500">
                    {round(quantity)} {unit}
                  </Txt>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
