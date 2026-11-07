import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Surface, TextField, Txt } from '@/constants/ui';
import { useAiCreditStatus } from '@/features/ai-credits/api';
import { useSession } from '@/features/auth/session-provider';
import { RecipeSuggestionDetail } from '@/features/chef-koch/components/recipe-suggestion-detail';
import { RecipeSuggestionResults } from '@/features/chef-koch/components/recipe-suggestion-results';
import {
  type ChefConversationWithContinuationState,
  chefConversationQueryKey,
  rememberChefConversationContinuationRejection,
} from '@/features/chef-koch/data/use-chef-history';
import { CHEF_HISTORY_ROUTE, getChefKochActionDestination } from '@/features/chef-koch/navigation';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { compareByExpiry, EXPIRY_WINDOW_DAYS, getExpiryInfo } from '@/features/inventory/expiry';
import type { LocalInventoryItem } from '@/features/inventory/use-inventory-items';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';
import { usePremium } from '@/features/premium/premium-provider';
import {
  hasIndeterminateRecipeSuggestionOutcome,
  RecipeSuggestionGatewayError,
} from '@/features/recipes/data/recipe-suggestion-gateway';
import { useRecipeSuggestions } from '@/features/recipes/data/use-recipe-suggestions';
import type { RecipeSuggestionMeal } from '@/features/recipes/domain/recipe-suggestions';

const DEFAULT_REQUEST = 'Was soll ich heute kochen?';

type CookingIntent = 'rescue' | 'choose';

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  selectionList: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xxl,
    gap: theme.space.xl,
  },
  intro: {
    gap: theme.space.xs,
  },
  selectionContent: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xxl,
  },
  welcomeContent: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.xxl,
    paddingBottom: theme.space.xxl,
    gap: theme.space.xxl,
  },
  welcomeIntro: {
    gap: theme.space.sm,
  },
  intentOptions: {
    borderTopWidth: theme.borderWidth.base,
    borderTopColor: theme.border,
  },
  intentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.lg,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  intentOptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borderWidth.strong,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: theme.accent,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
  },
  selectionBack: {
    alignSelf: 'flex-start',
  },
  selectionIntro: {
    gap: theme.space.xs,
    paddingBottom: theme.space.lg,
  },
  selectionCount: {
    marginTop: theme.space.sm,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.controlSizes.touchTarget,
    gap: theme.space.md,
    paddingVertical: theme.space.sm,
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  foodCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
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
  emptyInventory: {
    marginTop: theme.space.lg,
  },
  resultsHeader: {
    gap: theme.space.md,
  },
  resultActions: {
    alignItems: 'flex-start',
  },
  status: {
    gap: theme.space.md,
    padding: theme.space.lg,
  },
  centeredStatus: {
    alignItems: 'center',
  },
  questionActions: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  questionButton: {
    flex: 1,
  },
  historyAction: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.sm,
    alignItems: 'flex-end',
  },
  composer: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.lg,
    borderTopWidth: theme.borderWidth.base,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
}));

function isValidDateOnly(value: string | null): boolean {
  if (value === null) return true;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isSelectableFood(item: LocalInventoryItem, today: Date): boolean {
  return (
    item.name.trim().length > 0 &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0 &&
    item.unit.trim().length > 0 &&
    isValidDateOnly(item.expiry_date) &&
    getExpiryInfo(item.expiry_date, today).bucket !== 'expired'
  );
}

function isUsableForRecipe(item: LocalInventoryItem, today: Date): boolean {
  if (!isSelectableFood(item, today)) return false;
  const daysLeft = getExpiryInfo(item.expiry_date, today).daysLeft;
  return daysLeft !== null && daysLeft <= 7;
}

function expiresWithinSelectionWindow(item: LocalInventoryItem, today: Date): boolean {
  if (!isUsableForRecipe(item, today)) return false;
  const daysLeft = getExpiryInfo(item.expiry_date, today).daysLeft;
  return daysLeft !== null && daysLeft <= EXPIRY_WINDOW_DAYS.runsOutSoon;
}

function FoodSelectionRow({
  item,
  selected,
  today,
  onToggle,
}: {
  item: LocalInventoryItem;
  selected: boolean;
  today: Date;
  onToggle: () => void;
}) {
  const expiry = getExpiryInfo(item.expiry_date, today);
  const selectable = isSelectableFood(item, today);
  const expiryLabel = isValidDateOnly(item.expiry_date) ? expiry.label : 'Datum prüfen';
  const label = `${item.name}, ${item.quantity.toLocaleString('de-DE')} ${item.unit}, ${expiryLabel}`;

  return (
    <Press
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled: !selectable }}
      disabled={!selectable}
      haptic="selection"
      onPress={onToggle}
      style={styles.foodRow}>
      <View style={styles.foodCopy}>
        <Txt variant="body" weight="700" numberOfLines={1}>
          {item.name}
        </Txt>
        <Txt variant="caption" tone={!selectable ? 'danger' : 'secondary'}>
          {`${item.quantity.toLocaleString('de-DE')} ${item.unit} · ${expiryLabel}`}
        </Txt>
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? (
          <Txt variant="caption" tone="onAccent">
            ✓
          </Txt>
        ) : null}
      </View>
    </Press>
  );
}

function errorMessage(error: Error | null): string {
  if (!(error instanceof RecipeSuggestionGatewayError)) {
    return 'Vorschläge konnten nicht geladen werden.';
  }
  if (error.remoteCode === 'no_safe_recipe') {
    return 'Für diesen Bestand wurde kein sicherer Vorschlag gefunden.';
  }
  if (error.remoteCode === 'rate_limited') {
    return 'Zu viele Anfragen. Bitte versuche es gleich noch einmal.';
  }
  if (
    error.remoteCode === 'chef_conversation_continuation_expired' ||
    error.remoteCode === 'chef_conversation_source_immutable'
  ) {
    return 'Diese Unterhaltung kann nicht mehr fortgesetzt werden.';
  }
  if (error.remoteCode === 'ai_credit_limit_exceeded') {
    return 'Keine KI-Credits mehr verfügbar. Neue Credits gibt es ab dem nächsten UTC-Monatsanfang.';
  }
  if (
    error.remoteCode === 'ai_subscription_required' ||
    error.remoteCode === 'ai_entitlement_missing'
  ) {
    return 'Für Chef-Koch ist ein aktives Fam KI-Abo erforderlich.';
  }
  if (error.code === 'gateway_unavailable') {
    return 'Chef-Koch ist gerade nicht erreichbar.';
  }
  return 'Vorschläge konnten nicht geladen werden.';
}

function isServerContinuationRejection(error: Error | null): boolean {
  return (
    error instanceof RecipeSuggestionGatewayError &&
    (error.remoteCode === 'chef_conversation_continuation_expired' ||
      error.remoteCode === 'chef_conversation_source_immutable')
  );
}

export function ChefKochScreen({
  continuedFromConversationId,
}: {
  continuedFromConversationId?: string;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const { hasAI } = usePremium();
  const aiCreditQuery = useAiCreditStatus(hasAI ? activeHouseholdId : null);
  const creditBlocked = aiCreditQuery.data?.blocked === true;
  const { data: inventory = [], isLoading: inventoryLoading } = useInventoryItems(
    activeHouseholdId ?? undefined,
  );
  const suggestion = useRecipeSuggestions();
  const mutate = suggestion.mutate;
  const initializedHousehold = useRef<string | null>(null);
  const today = useRef(new Date()).current;
  const [userText, setUserText] = useState(DEFAULT_REQUEST);
  const [shoppingDecision, setShoppingDecision] = useState<'yes' | 'no' | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<RecipeSuggestionMeal | null>(null);
  const [selectedInventoryItemIds, setSelectedInventoryItemIds] = useState<string[]>([]);
  const [cookingIntent, setCookingIntent] = useState<CookingIntent | null>(null);
  const [showingSelection, setShowingSelection] = useState(false);
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const unresolvedClientRequestId = useRef<string | null>(null);
  const accountId = session?.user.id ?? null;

  const orderedInventory = useMemo(
    () =>
      [...inventory].sort((left, right) =>
        compareByExpiry(
          getExpiryInfo(left.expiry_date, today),
          getExpiryInfo(right.expiry_date, today),
        ),
      ),
    [inventory, today],
  );
  const selectionInventory = useMemo(
    () => orderedInventory.filter((item) => expiresWithinSelectionWindow(item, today)),
    [orderedInventory, today],
  );
  const selectionInventoryIds = useMemo(
    () => new Set(selectionInventory.map((item) => item.id)),
    [selectionInventory],
  );
  const recipeEligibleInventoryIds = useMemo(
    () =>
      new Set(inventory.filter((item) => isUsableForRecipe(item, today)).map((item) => item.id)),
    [inventory, today],
  );
  const activeSelectedInventoryItemIds = selectedInventoryItemIds.filter((id) =>
    selectionInventoryIds.has(id),
  );
  const selectedCount = activeSelectedInventoryItemIds.length;

  const continueToFoodSelection = () => {
    if (cookingIntent === null) return;
    setSelectedInventoryItemIds(
      cookingIntent === 'rescue' ? selectionInventory.map((item) => item.id) : [],
    );
    setShowingSelection(true);
  };

  const askChef = useCallback(
    (decision: 'yes' | 'no' | null = shoppingDecision) => {
      if (creditBlocked || activeHouseholdId === null || userText.trim().length === 0) return;
      const clientRequestId = unresolvedClientRequestId.current ?? Crypto.randomUUID();
      unresolvedClientRequestId.current = clientRequestId;
      setSelectedMeal(null);
      setShowingSuggestions(true);
      mutate({
        householdId: activeHouseholdId,
        userText: userText.trim(),
        servings: 2,
        maxMinutes: null,
        dietaryPattern: null,
        shoppingDecision: decision,
        selectedInventoryItemIds: activeSelectedInventoryItemIds,
        clientRequestId,
        ...(conversationId === null
          ? continuedFromConversationId === undefined
            ? {}
            : { continuedFromConversationId }
          : { conversationId }),
      });
    },
    [
      activeHouseholdId,
      activeSelectedInventoryItemIds,
      continuedFromConversationId,
      conversationId,
      creditBlocked,
      mutate,
      shoppingDecision,
      userText,
    ],
  );

  useEffect(() => {
    if (
      !hasAI ||
      activeHouseholdId === null ||
      inventoryLoading ||
      initializedHousehold.current === activeHouseholdId
    ) {
      return;
    }
    initializedHousehold.current = activeHouseholdId;
    setSelectedInventoryItemIds([]);
    setCookingIntent(null);
    setShowingSelection(false);
    setShoppingDecision(null);
    setSelectedMeal(null);
    setShowingSuggestions(false);
    setConversationId(null);
    unresolvedClientRequestId.current = null;
  }, [activeHouseholdId, hasAI, inventoryLoading]);

  useEffect(() => {
    if (suggestion.data === undefined || suggestion.data === null) return;
    setConversationId(suggestion.data.conversationId);
    unresolvedClientRequestId.current = null;
  }, [suggestion.data]);

  useEffect(() => {
    if (suggestion.error !== null && !hasIndeterminateRecipeSuggestionOutcome(suggestion.error)) {
      unresolvedClientRequestId.current = null;
    }
  }, [suggestion.error]);

  const rejectedConversationId = conversationId ?? continuedFromConversationId;

  useEffect(() => {
    if (
      accountId === null ||
      activeHouseholdId === null ||
      rejectedConversationId === undefined ||
      !isServerContinuationRejection(suggestion.error)
    ) {
      return;
    }

    void rememberChefConversationContinuationRejection(
      accountId,
      activeHouseholdId,
      rejectedConversationId,
    )
      .then(() => {
        queryClient.setQueryData<ChefConversationWithContinuationState | null>(
          chefConversationQueryKey(activeHouseholdId, rejectedConversationId, accountId),
          (conversation) =>
            conversation === null || conversation === undefined
              ? conversation
              : { ...conversation, continuationRejected: true },
        );
      })
      .catch(() => undefined);
  }, [accountId, activeHouseholdId, queryClient, rejectedConversationId, suggestion.error]);

  const continuationRejected = isServerContinuationRejection(suggestion.error);

  const result = suggestion.isPending || suggestion.isError ? null : suggestion.data?.result;
  const shoppingQuestion =
    suggestion.isPending || suggestion.isError ? null : suggestion.data?.shoppingQuestion;

  return (
    <HubScreen
      header={{
        title: 'Chef-Koch',
        align: 'center',
        leading: <BackButton label="Zurück" href="/" variant="header" />,
      }}>
      <View style={styles.root}>
        <View style={styles.historyAction}>
          <Button
            title="History ansehen"
            variant="secondary"
            size="sm"
            disabled={activeHouseholdId === null}
            onPress={() => router.push(CHEF_HISTORY_ROUTE)}
          />
        </View>
        {!hasAI ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <Surface tone="soft" style={styles.status}>
              <Txt variant="title">Mit Fam KI aus dem Vorrat kochen</Txt>
              <Txt variant="body" tone="secondary">
                Chef-Koch findet passende Mahlzeiten aus eurem Haushaltsbestand.
              </Txt>
              <Button
                title="Fam KI ansehen"
                variant="accent"
                accentKey="ai-chef"
                onPress={() => router.push(getChefKochActionDestination(false))}
              />
            </Surface>
          </ScrollView>
        ) : activeHouseholdId === null ? (
          <Surface tone="soft" style={styles.status}>
            <Txt variant="body">Wähle zuerst einen Haushalt aus.</Txt>
          </Surface>
        ) : selectedMeal ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <RecipeSuggestionDetail
              meal={selectedMeal}
              inventory={inventory}
              householdId={activeHouseholdId}
              onBack={() => setSelectedMeal(null)}
            />
          </ScrollView>
        ) : !showingSelection && !showingSuggestions ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.welcomeContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.welcomeIntro}>
              <Txt variant="title">Hallo!</Txt>
              <Txt variant="heading">Was möchtest du heute tun?</Txt>
            </View>

            <View
              style={styles.intentOptions}
              accessibilityRole="radiogroup"
              accessibilityLabel="Was möchtest du heute tun?">
              {[
                {
                  value: 'rescue' as const,
                  title: 'Lebensmittel retten',
                  description: 'Bald ablaufende Lebensmittel werden vorausgewählt.',
                },
                {
                  value: 'choose' as const,
                  title: 'Selbst auswählen',
                  description: 'Du bestimmst, welche Vorräte zuerst verwendet werden.',
                },
              ].map(({ value, title, description }) => {
                const selected = cookingIntent === value;
                return (
                  <Press
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={`${title}. ${description}`}
                    accessibilityState={{ selected }}
                    haptic="selection"
                    onPress={() => setCookingIntent(value)}
                    style={styles.intentOption}>
                    <View style={styles.intentOptionCopy}>
                      <Txt variant="body" weight="700">
                        {title}
                      </Txt>
                      <Txt variant="caption" tone="secondary">
                        {description}
                      </Txt>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Press>
                );
              })}
            </View>
          </ScrollView>
        ) : showingSelection && !showingSuggestions ? (
          <FlashList
            style={styles.selectionList}
            contentContainerStyle={styles.selectionContent}
            data={selectionInventory}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.selectionIntro}>
                <Press
                  accessibilityRole="button"
                  accessibilityLabel="Zur Zielauswahl zurück"
                  haptic="light"
                  onPress={() => setShowingSelection(false)}
                  style={styles.selectionBack}>
                  <Txt variant="caption" tone="secondary">
                    Zurück
                  </Txt>
                </Press>
                <Txt variant="heading">Wähle Lebensmittel aus</Txt>
                <Txt variant="caption" tone="secondary" style={styles.selectionCount}>
                  {`${selectedCount} ausgewählt`}
                </Txt>
              </View>
            }
            ListEmptyComponent={
              inventoryLoading ? (
                <View style={[styles.status, styles.centeredStatus]}>
                  <ActivityIndicator color={colors.accent} />
                  <Txt variant="body" tone="secondary">
                    Vorrat wird geladen.
                  </Txt>
                </View>
              ) : (
                <Surface tone="soft" style={[styles.status, styles.emptyInventory]}>
                  {inventory.length === 0 ? (
                    <Txt variant="body">Füge zuerst Lebensmittel zu eurem Vorrat hinzu.</Txt>
                  ) : recipeEligibleInventoryIds.size === 0 ? (
                    <Txt variant="body">
                      Es gibt keine verfügbaren Lebensmittel mit MHD bis zu 7 Tagen.
                    </Txt>
                  ) : (
                    <>
                      <Txt variant="body">In den nächsten 3 Tagen läuft nichts ab.</Txt>
                      <Txt variant="caption" tone="secondary">
                        Du kannst trotzdem nach Rezepten mit Vorräten suchen, deren MHD in den
                        nächsten 7 Tagen liegt.
                      </Txt>
                    </>
                  )}
                </Surface>
              )
            }
            renderItem={({ item }) => (
              <FoodSelectionRow
                item={item}
                today={today}
                selected={selectedInventoryItemIds.includes(item.id)}
                onToggle={() => {
                  setSelectedInventoryItemIds((current) =>
                    current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  );
                }}
              />
            )}
          />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.resultsHeader}>
              <View style={styles.intro}>
                <Txt variant="heading">Vorschläge aus eurem Vorrat</Txt>
                <Txt variant="body" tone="secondary">
                  Verfügbarkeit, Mengen und Lebensmittelregeln werden vor jedem Vorschlag geprüft.
                </Txt>
              </View>
              <View style={styles.resultActions}>
                <Button
                  title="Auswahl ändern"
                  variant="secondary"
                  onPress={() => {
                    setShowingSuggestions(false);
                    setShoppingDecision(null);
                  }}
                />
              </View>
            </View>

            {suggestion.isPending ? (
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Vorschläge werden geladen"
                style={[styles.status, styles.centeredStatus]}>
                <ActivityIndicator color={colors.accent} />
                <Txt variant="body" tone="secondary">
                  Passende Mahlzeiten werden gesucht.
                </Txt>
              </View>
            ) : null}

            {suggestion.isError ? (
              <Surface tone="soft" style={styles.status}>
                <Txt variant="body" tone="danger" accessibilityRole="alert">
                  {errorMessage(suggestion.error)}
                </Txt>
                {continuationRejected ? null : (
                  <Button
                    title="Erneut versuchen"
                    variant="secondary"
                    disabled={creditBlocked}
                    onPress={() => askChef(shoppingDecision)}
                  />
                )}
              </Surface>
            ) : null}

            {shoppingQuestion ? (
              <Surface tone="soft" style={styles.status}>
                <Txt variant="body" weight="700">
                  {shoppingQuestion}
                </Txt>
                <View style={styles.questionActions}>
                  <Button
                    title="Nein"
                    variant="secondary"
                    style={styles.questionButton}
                    disabled={creditBlocked}
                    onPress={() => {
                      setShoppingDecision('no');
                      askChef('no');
                    }}
                  />
                  <Button
                    title="Ja, heute"
                    variant="accent"
                    accentKey="ai-chef"
                    style={styles.questionButton}
                    disabled={creditBlocked}
                    onPress={() => {
                      setShoppingDecision('yes');
                      askChef('yes');
                    }}
                  />
                </View>
              </Surface>
            ) : null}

            {result ? (
              <RecipeSuggestionResults
                meals={result.meals}
                inventory={inventory}
                selectedInventoryItemIds={activeSelectedInventoryItemIds}
                onCook={setSelectedMeal}
              />
            ) : null}
          </ScrollView>
        )}

        {hasAI &&
        activeHouseholdId !== null &&
        selectedMeal === null &&
        !showingSuggestions &&
        !showingSelection ? (
          <View style={styles.composer}>
            <Button
              title="Weiter"
              variant="accent"
              accentKey="ai-chef"
              disabled={cookingIntent === null}
              onPress={continueToFoodSelection}
            />
          </View>
        ) : null}

        {hasAI &&
        activeHouseholdId !== null &&
        selectedMeal === null &&
        !continuationRejected &&
        (showingSelection || showingSuggestions) ? (
          <View style={styles.composer}>
            <TextField
              value={userText}
              onChangeText={setUserText}
              placeholder="Worauf hast du Lust?"
              accessibilityLabel="Wunsch an Chef-Koch"
              returnKeyType="send"
              onSubmitEditing={() => askChef()}
              trailing={
                <Button
                  title={showingSuggestions ? 'Neu suchen' : 'Rezepte finden'}
                  size="sm"
                  flat
                  variant="accent"
                  accentKey="ai-chef"
                  disabled={
                    creditBlocked ||
                    suggestion.isPending ||
                    userText.trim().length === 0 ||
                    recipeEligibleInventoryIds.size === 0
                  }
                  onPress={() => askChef()}
                />
              }
            />
          </View>
        ) : null}
      </View>
    </HubScreen>
  );
}
