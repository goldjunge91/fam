import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  useChefConversation,
  useChefConversationTurns,
  useChefRecipeHistory,
} from '@/features/chef-koch/data/use-chef-history';
import {
  type ChefConversationTurnView,
  type ChefRecipeHistoryPayload,
  canContinueChefConversation,
} from '@/features/chef-koch/domain/chef-history';
import {
  getChefConversationRoute,
  getChefKochActionDestination,
  getChefRecipeHistoryRoute,
} from '@/features/chef-koch/navigation';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { usePremium } from '@/features/premium/premium-provider';
import type { RecipeSuggestionMeal } from '@/features/recipes/domain/recipe-suggestions';

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xxl,
  },
  detailContent: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xxl,
    gap: theme.space.xl,
  },
  header: {
    gap: theme.space.md,
    paddingVertical: theme.space.lg,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  turn: {
    gap: theme.space.md,
    paddingVertical: theme.space.lg,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  message: {
    gap: theme.space.xs,
  },
  meal: {
    gap: theme.space.lg,
    paddingBottom: theme.space.xl,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  section: {
    gap: theme.space.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  lineCopy: {
    flex: 1,
    minWidth: 0,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  stepNumber: {
    minWidth: 24,
  },
  state: {
    padding: theme.space.xl,
    gap: theme.space.md,
    alignItems: 'center',
  },
}));

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Datum unbekannt';
}

function TurnRow({ turn }: { turn: ChefConversationTurnView }) {
  const response = turn.response_payload;
  const shoppingDecision = turn.request_payload.shopping_decision;

  return (
    <View style={styles.turn}>
      <View style={styles.message}>
        <Txt variant="caption" tone="secondary" weight="700">
          Du
        </Txt>
        <Txt variant="body" selectable>
          {turn.user_text}
        </Txt>
        {shoppingDecision !== null ? (
          <Txt variant="caption" tone="secondary">
            {`Einkaufen: ${shoppingDecision === 'yes' ? 'Ja' : 'Nein'}`}
          </Txt>
        ) : null}
      </View>

      <View style={styles.message}>
        <Txt variant="caption" tone="accent" weight="700">
          Chef-Koch
        </Txt>
        {response.shopping_question !== null ? (
          <Txt variant="body" selectable>
            {response.shopping_question}
          </Txt>
        ) : (
          response.result?.meals.map((meal) => (
            <Txt key={`${meal.title}:${meal.recipe_id ?? 'new'}`} variant="body" weight="700">
              {meal.title}
            </Txt>
          ))
        )}
      </View>

      {turn.recipe_history_id !== null ? (
        <Button
          title="Rezeptvorschläge ansehen"
          variant="secondary"
          onPress={() => router.push(getChefRecipeHistoryRoute(turn.recipe_history_id as string))}
        />
      ) : null}
      <Txt variant="caption" tone="secondary">
        {formatDate(turn.created_at)}
      </Txt>
    </View>
  );
}

function ConversationDetail({ id }: { id: string }) {
  const { colors } = useTheme();
  const { session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const { hasAI } = usePremium();
  const accountId = session?.user.id ?? null;
  const conversation = useChefConversation(activeHouseholdId, id, accountId);
  const turns = useChefConversationTurns(activeHouseholdId, id);

  if (conversation.isPending || turns.isPending) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Unterhaltung wird geladen"
        style={styles.state}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (conversation.isError || turns.isError) {
    return (
      <View style={styles.state}>
        <Txt accessibilityRole="alert" variant="body" tone="danger">
          Unterhaltung konnte nicht geladen werden.
        </Txt>
      </View>
    );
  }
  if (conversation.data === null || conversation.data === undefined) {
    return (
      <View style={styles.state}>
        <Txt variant="body" tone="secondary">
          Unterhaltung nicht gefunden.
        </Txt>
      </View>
    );
  }

  const currentConversation = conversation.data;
  const canContinue =
    currentConversation.continuationRejected !== true &&
    canContinueChefConversation(currentConversation);
  return (
    <FlashList
      style={styles.root}
      contentContainerStyle={styles.listContent}
      data={turns.data ?? []}
      keyExtractor={(turn) => turn.id}
      renderItem={({ item }) => <TurnRow turn={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Txt variant="caption" tone="secondary">
            {formatDate(currentConversation.last_activity_at)}
          </Txt>
          <View style={styles.headerActions}>
            <Button
              title={canContinue ? 'Fortsetzen' : 'Nicht mehr fortsetzbar'}
              variant={canContinue ? 'accent' : 'secondary'}
              accentKey="ai-chef"
              disabled={!canContinue}
              onPress={() =>
                router.push(
                  hasAI
                    ? {
                        pathname: '/chef-koch',
                        params: { continuedFromConversationId: currentConversation.id },
                      }
                    : getChefKochActionDestination(false),
                )
              }
            />
            {currentConversation.continued_from_id !== null ? (
              <Button
                title="Vorherige Unterhaltung"
                variant="secondary"
                onPress={() =>
                  router.push(
                    getChefConversationRoute(currentConversation.continued_from_id as string),
                  )
                }
              />
            ) : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.state}>
          <Txt variant="body" tone="secondary">
            Keine sichtbaren Nachrichten.
          </Txt>
        </View>
      }
      onEndReached={() => {
        if (turns.hasNextPage && !turns.isFetchingNextPage) void turns.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
    />
  );
}

function sourceLabel(source: RecipeSuggestionMeal['source']): string {
  if (source === 'catalog') return 'Aus dem Katalog';
  if (source === 'template') return 'Aus einer Vorlage';
  return 'Neu formuliert';
}

function quantity(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 3 });
}

function RecipeMeal({
  meal,
  payload,
}: {
  meal: RecipeSuggestionMeal;
  payload: ChefRecipeHistoryPayload;
}) {
  const names = new Map(
    payload.used_item_snapshots.map((snapshot) => [snapshot.inventory_item_id, snapshot.name]),
  );
  const stepOccurrences = new Map<string, number>();
  const steps = meal.steps.map((step) => {
    const occurrence = (stepOccurrences.get(step) ?? 0) + 1;
    stepOccurrences.set(step, occurrence);
    return { key: `${step}:${occurrence}`, step };
  });
  return (
    <View style={styles.meal}>
      <View style={styles.message}>
        <Txt variant="caption" tone="accent" weight="700">
          {sourceLabel(meal.source)}
        </Txt>
        <Txt variant="heading" selectable>
          {meal.title}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {meal.servings} Portionen
        </Txt>
      </View>

      <View style={styles.section}>
        <Txt variant="body" weight="700">
          Verwendete Lebensmittel
        </Txt>
        {meal.used_items.map((item) => (
          <View key={item.inventory_item_id} style={styles.line}>
            <Txt variant="body" style={styles.lineCopy}>
              {names.get(item.inventory_item_id) ?? 'Lebensmittel'}
            </Txt>
            <Txt variant="body" tone="secondary">
              {quantity(item.quantity)} {item.unit}
            </Txt>
          </View>
        ))}
      </View>

      {meal.shopping_needs && meal.shopping_needs.length > 0 ? (
        <View style={styles.section}>
          <Txt variant="body" weight="700">
            Noch einzukaufen
          </Txt>
          {meal.shopping_needs.map((item) => (
            <View key={`${item.name}:${item.unit}`} style={styles.line}>
              <Txt variant="body" style={styles.lineCopy}>
                {item.name}
              </Txt>
              <Txt variant="body" tone="secondary">
                {quantity(item.quantity)} {item.unit}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      {meal.additional_ingredients.length > 0 ? (
        <View style={styles.section}>
          <Txt variant="body" weight="700">
            Weitere Zutaten
          </Txt>
          <Txt variant="body">{meal.additional_ingredients.join(', ')}</Txt>
        </View>
      ) : null}

      <View style={styles.section}>
        <Txt variant="body" weight="700">
          Zubereitung
        </Txt>
        {steps.map(({ key, step }, index) => (
          <View key={key} style={styles.step}>
            <Txt variant="caption" tone="secondary" weight="700" style={styles.stepNumber}>
              {index + 1}.
            </Txt>
            <Txt variant="body" selectable style={styles.lineCopy}>
              {step}
            </Txt>
          </View>
        ))}
      </View>

      {meal.notes.length > 0 ? (
        <View style={styles.section}>
          <Txt variant="body" weight="700">
            Hinweise
          </Txt>
          {meal.notes.map((note) => (
            <Txt key={note} variant="body" selectable>
              {note}
            </Txt>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RecipeDetail({ id }: { id: string }) {
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const recipe = useChefRecipeHistory(activeHouseholdId, id);

  if (recipe.isPending) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Rezeptvorschläge werden geladen"
        style={styles.state}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (recipe.isError) {
    return (
      <View style={styles.state}>
        <Txt accessibilityRole="alert" variant="body" tone="danger">
          Rezeptvorschläge konnten nicht geladen werden.
        </Txt>
      </View>
    );
  }
  if (recipe.data === null || recipe.data === undefined) {
    return (
      <View style={styles.state}>
        <Txt variant="body" tone="secondary">
          Rezeptvorschläge nicht gefunden.
        </Txt>
      </View>
    );
  }

  const currentRecipe = recipe.data;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Txt variant="title" selectable>
          {currentRecipe.title}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {formatDate(currentRecipe.created_at)}
        </Txt>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Zugehörige Unterhaltung öffnen"
          onPress={() => router.push(getChefConversationRoute(currentRecipe.conversation_id))}>
          <Txt variant="body" tone="accent" weight="700">
            Zugehörige Unterhaltung
          </Txt>
        </Press>
      </View>
      {currentRecipe.recipe_payload.response.meals.map((meal) => (
        <RecipeMeal
          key={`${meal.title}:${meal.recipe_id ?? 'new'}`}
          meal={meal}
          payload={currentRecipe.recipe_payload}
        />
      ))}
    </ScrollView>
  );
}

export function ChefHistoryDetailScreen({
  id,
  kind,
}: {
  id: string;
  kind: 'conversation' | 'recipe';
}) {
  return (
    <HubScreen
      header={{
        title: kind === 'conversation' ? 'Unterhaltung' : 'Rezeptvorschläge',
        align: 'center',
        leading: <BackButton label="Zurück" href="/chef-koch-history" variant="header" />,
      }}>
      {kind === 'conversation' ? <ConversationDetail id={id} /> : <RecipeDetail id={id} />}
    </HubScreen>
  );
}
