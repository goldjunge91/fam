import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Txt } from '@/constants/ui';
import {
  useChefConversations,
  useChefRecipeHistoryList,
} from '@/features/chef-koch/data/use-chef-history';
import {
  type ChefConversationSummary,
  type ChefRecipeHistoryRow,
  canContinueChefConversation,
} from '@/features/chef-koch/domain/chef-history';
import {
  getChefConversationRoute,
  getChefRecipeHistoryRoute,
} from '@/features/chef-koch/navigation';
import { useActiveHousehold } from '@/features/household/active-household-provider';

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
    paddingHorizontal: theme.space.lg,
  },
  tab: {
    minHeight: theme.controlSizes.touchTarget,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: theme.borderWidth.strong,
    borderBottomColor: theme.border,
  },
  tabContainer: {
    flex: 1,
  },
  selectedTab: {
    borderBottomColor: theme.accent,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xxl,
  },
  row: {
    minHeight: theme.controlSizes.touchTarget,
    paddingVertical: theme.space.lg,
    gap: theme.space.xs,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  rowContainer: {
    alignSelf: 'stretch',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  rowTitle: {
    flex: 1,
    minWidth: 0,
  },
  state: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xxl,
    gap: theme.space.md,
    alignItems: 'center',
  },
}));

function formatHistoryDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Datum unbekannt';
}

function ConversationRow({ conversation }: { conversation: ChefConversationSummary }) {
  const continuationLabel = canContinueChefConversation(conversation)
    ? 'Fortsetzen möglich'
    : 'Nur ansehen';

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${conversation.first_user_text}. ${continuationLabel}`}
      onPress={() => router.push(getChefConversationRoute(conversation.id))}
      containerStyle={styles.rowContainer}
      style={styles.row}>
      <View style={styles.rowHeader}>
        <Txt variant="body" weight="700" numberOfLines={2} style={styles.rowTitle}>
          {conversation.first_user_text}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {continuationLabel}
        </Txt>
      </View>
      <Txt variant="caption" tone="secondary">
        {formatHistoryDate(conversation.last_activity_at)}
      </Txt>
    </Press>
  );
}

function RecipeRow({ recipe }: { recipe: ChefRecipeHistoryRow }) {
  const mealCount = recipe.recipe_payload.response.meals.length;
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}. ${mealCount} Rezeptvorschläge`}
      onPress={() => router.push(getChefRecipeHistoryRoute(recipe.id))}
      containerStyle={styles.rowContainer}
      style={styles.row}>
      <Txt variant="body" weight="700" numberOfLines={2}>
        {recipe.title}
      </Txt>
      <Txt variant="caption" tone="secondary">
        {`${mealCount} ${mealCount === 1 ? 'Vorschlag' : 'Vorschläge'} · ${formatHistoryDate(recipe.created_at)}`}
      </Txt>
    </Press>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.state}>
      <Txt variant="body" tone="secondary">
        {label}
      </Txt>
    </View>
  );
}

export function ChefHistoryScreen() {
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const [section, setSection] = useState<'conversations' | 'recipes'>('conversations');
  const conversations = useChefConversations(activeHouseholdId);
  const recipes = useChefRecipeHistoryList(activeHouseholdId);
  const activeQuery = section === 'conversations' ? conversations : recipes;

  return (
    <HubScreen
      header={{
        title: 'Chef-Koch-History',
        align: 'center',
        leading: <BackButton label="Zurück" href="/chef-koch" variant="header" />,
      }}>
      <View style={styles.root}>
        <View accessibilityRole="tablist" accessibilityLabel="History-Bereich" style={styles.tabs}>
          <Press
            accessibilityRole="tab"
            accessibilityLabel="Unterhaltungen"
            accessibilityState={{ selected: section === 'conversations' }}
            onPress={() => setSection('conversations')}
            containerStyle={styles.tabContainer}
            style={[styles.tab, section === 'conversations' && styles.selectedTab]}>
            <Txt variant="body" weight="700">
              Unterhaltungen
            </Txt>
          </Press>
          <Press
            accessibilityRole="tab"
            accessibilityLabel="Rezeptvorschläge"
            accessibilityState={{ selected: section === 'recipes' }}
            onPress={() => setSection('recipes')}
            containerStyle={styles.tabContainer}
            style={[styles.tab, section === 'recipes' && styles.selectedTab]}>
            <Txt variant="body" weight="700">
              Rezeptvorschläge
            </Txt>
          </Press>
        </View>

        {activeHouseholdId === null ? (
          <EmptyState label="Wähle zuerst einen Haushalt aus." />
        ) : activeQuery.isPending ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="History wird geladen"
            style={styles.state}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : activeQuery.isError ? (
          <View style={styles.state}>
            <Txt accessibilityRole="alert" variant="body" tone="danger">
              History konnte nicht geladen werden.
            </Txt>
            <Button
              title="Erneut versuchen"
              variant="secondary"
              onPress={() => activeQuery.refetch()}
            />
          </View>
        ) : section === 'conversations' ? (
          <FlashList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={conversations.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ConversationRow conversation={item} />}
            ListEmptyComponent={<EmptyState label="Noch keine Unterhaltungen." />}
            onEndReached={() => {
              if (conversations.hasNextPage && !conversations.isFetchingNextPage) {
                void conversations.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
          />
        ) : (
          <FlashList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={recipes.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <RecipeRow recipe={item} />}
            ListEmptyComponent={<EmptyState label="Noch keine Rezeptvorschläge." />}
            onEndReached={() => {
              if (recipes.hasNextPage && !recipes.isFetchingNextPage) {
                void recipes.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
          />
        )}
      </View>
    </HubScreen>
  );
}
