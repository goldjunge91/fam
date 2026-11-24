import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Surface, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { getExpiryInfo } from '@/features/inventory/expiry';
import {
  type LocalInventoryItem,
  useInventoryItems,
} from '@/features/inventory/use-inventory-items';
import { usePremium } from '@/features/premium/premium-provider';
import {
  RecipeSuggestionGatewayError,
  type RecipeSuggestionGatewayRequest,
} from '@/features/recipes/data/recipe-suggestion-gateway';
import { useRecipeSuggestions } from '@/features/recipes/data/use-recipe-suggestions';
import type { RecipeSuggestionMeal } from '@/features/recipes/domain/recipe-suggestions';

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xxxl,
  },
  intro: {
    gap: theme.space.xs,
    paddingBottom: theme.space.lg,
  },
  list: {
    flex: 1,
  },
  row: {
    minHeight: theme.controlSizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.sm,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
  },
  checkbox: {
    width: theme.controlSizes.touchTarget,
    height: theme.controlSizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
  checkboxSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  footer: {
    gap: theme.space.lg,
    paddingTop: theme.space.lg,
  },
  action: {
    alignSelf: 'stretch',
  },
  status: {
    gap: theme.space.md,
    padding: theme.space.lg,
  },
  centered: {
    alignItems: 'center',
  },
  results: {
    gap: theme.space.md,
  },
  meal: {
    gap: theme.space.sm,
    padding: theme.space.lg,
  },
  mealSteps: {
    gap: theme.space.xs,
  },
}));

function selectableInventoryItem(item: LocalInventoryItem): boolean {
  return (
    item.name.trim().length > 0 &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0 &&
    item.unit.trim().length > 0 &&
    getExpiryInfo(item.expiry_date, new Date()).bucket !== 'expired'
  );
}

function errorCopy(error: Error | null, t: (key: string) => string): string {
  if (
    error instanceof RecipeSuggestionGatewayError &&
    (error.remoteCode === 'ai_subscription_required' ||
      error.remoteCode === 'ai_entitlement_missing')
  ) {
    return t('dashboard.chefKoch.noAi');
  }
  if (error instanceof RecipeSuggestionGatewayError && error.remoteCode === 'no_safe_recipe') {
    return t('dashboard.chefKoch.empty');
  }
  return t('dashboard.chefKoch.error');
}

function MealResult({
  meal,
  inventory,
  t,
}: {
  meal: RecipeSuggestionMeal;
  inventory: readonly LocalInventoryItem[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const names = meal.used_items
    .map((used) => inventory.find((item) => item.id === used.inventory_item_id)?.name)
    .filter((name): name is string => name !== undefined);

  return (
    <Surface tone="soft" style={styles.meal}>
      <Txt variant="body" weight="700">
        {meal.title}
      </Txt>
      {names.length > 0 ? (
        <Txt variant="caption" tone="secondary">
          {t('dashboard.chefKoch.used', { items: names.join(', ') })}
        </Txt>
      ) : null}
      <View style={styles.mealSteps}>
        <Txt variant="caption" tone="secondary" weight="700">
          {t('dashboard.chefKoch.steps')}
        </Txt>
        {meal.steps.map((step, index) => (
          <Txt key={`${meal.title}-${step}`} variant="body">
            {`${index + 1}. ${step}`}
          </Txt>
        ))}
      </View>
    </Surface>
  );
}

export function ChefKochScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const { hasAI } = usePremium();
  const { data: inventory = [], isLoading: inventoryLoading } = useInventoryItems(
    activeHouseholdId ?? undefined,
  );
  const suggestion = useRecipeSuggestions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectableItems = useMemo(() => inventory.filter(selectableInventoryItem), [inventory]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const request = useMemo<RecipeSuggestionGatewayRequest | null>(() => {
    if (activeHouseholdId === null) return null;
    return {
      householdId: activeHouseholdId,
      userText: 'Was soll ich heute kochen?',
      servings: 2,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
      shoppingDecision: 'no',
      selectedInventoryItemIds: selectedIds,
    };
  }, [activeHouseholdId, selectedIds]);

  function toggleItem(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  function requestSuggestions() {
    if (request === null || selectedIds.length === 0 || suggestion.isPending) return;
    suggestion.mutate(request);
  }

  if (!hasAI) {
    return (
      <HubScreen
        header={{
          title: t('dashboard.chefKoch.title'),
          align: 'center',
          leading: <BackButton label={t('common.actions.back')} href="/" variant="header" />,
        }}>
        <Surface tone="soft" style={styles.status}>
          <Txt variant="body" tone="danger" accessibilityRole="alert">
            {t('dashboard.chefKoch.noAi')}
          </Txt>
        </Surface>
      </HubScreen>
    );
  }

  if (activeHouseholdId === null) {
    return (
      <HubScreen
        header={{
          title: t('dashboard.chefKoch.title'),
          align: 'center',
          leading: <BackButton label={t('common.actions.back')} href="/" variant="header" />,
        }}>
        <Surface tone="soft" style={styles.status}>
          <Txt variant="body">{t('dashboard.chefKoch.noHousehold')}</Txt>
        </Surface>
      </HubScreen>
    );
  }

  const result = suggestion.data?.result ?? null;
  const emptyMessage = inventoryLoading
    ? null
    : selectableItems.length === 0
      ? t('dashboard.chefKoch.empty')
      : null;

  return (
    <HubScreen
      header={{
        title: t('dashboard.chefKoch.title'),
        align: 'center',
        leading: <BackButton label={t('common.actions.back')} href="/" variant="header" />,
      }}>
      <View style={styles.root}>
        <FlashList
          style={styles.list}
          contentContainerStyle={styles.content}
          data={selectableItems}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Txt variant="heading">{t('dashboard.chefKoch.entry')}</Txt>
              <Txt variant="body" tone="secondary">
                {t('dashboard.chefKoch.intro')}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {t('dashboard.chefKoch.selected', { count: selectedIds.length })}
              </Txt>
            </View>
          }
          ListEmptyComponent={
            inventoryLoading ? (
              <View style={[styles.status, styles.centered]}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <Surface tone="soft" style={styles.status}>
                <Txt variant="body">{emptyMessage}</Txt>
              </Surface>
            )
          }
          renderItem={({ item }) => {
            const selected = selectedSet.has(item.id);
            return (
              <Press
                accessibilityRole="checkbox"
                accessibilityLabel={`${item.name}, ${item.quantity} ${item.unit}`}
                accessibilityState={{ checked: selected }}
                haptic="selection"
                onPress={() => toggleItem(item.id)}
                style={styles.row}>
                <View style={styles.rowCopy}>
                  <Txt variant="body" weight="700">
                    {item.name}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    {`${item.quantity} ${item.unit}`}
                  </Txt>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? (
                    <Txt variant="body" tone="onAccent">
                      ✓
                    </Txt>
                  ) : null}
                </View>
              </Press>
            );
          }}
          ListFooterComponent={
            <View style={styles.footer}>
              <Button
                title={t('dashboard.chefKoch.submit')}
                variant="accent"
                accentKey="ai-chef"
                full
                loading={suggestion.isPending}
                disabled={selectedIds.length === 0 || suggestion.isPending}
                onPress={requestSuggestions}
                style={styles.action}
              />
              {suggestion.isError ? (
                <Surface tone="soft" style={styles.status}>
                  <Txt variant="body" tone="danger" accessibilityRole="alert">
                    {errorCopy(suggestion.error, t)}
                  </Txt>
                  <Button
                    title={t('dashboard.chefKoch.retry')}
                    variant="secondary"
                    disabled={selectedIds.length === 0}
                    onPress={requestSuggestions}
                  />
                </Surface>
              ) : null}
              {suggestion.isPending ? (
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={t('dashboard.chefKoch.loading')}
                  style={[styles.status, styles.centered]}>
                  <ActivityIndicator color={colors.accent} />
                  <Txt variant="body" tone="secondary">
                    {t('dashboard.chefKoch.loading')}
                  </Txt>
                </View>
              ) : null}
              {result ? (
                <View style={styles.results}>
                  <Txt variant="heading">{t('dashboard.chefKoch.resultTitle')}</Txt>
                  {result.meals.map((meal) => (
                    <MealResult
                      key={`${meal.title}-${meal.recipe_id ?? 'generated'}`}
                      meal={meal}
                      inventory={inventory}
                      t={t}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          }
        />
      </View>
    </HubScreen>
  );
}
