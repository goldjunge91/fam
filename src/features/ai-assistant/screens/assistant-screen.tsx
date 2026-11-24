import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { controlSizes, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  Badge,
  Button,
  Card,
  IconButton,
  Pill,
  Press,
  Surface,
  TextField,
  Txt,
} from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { formatExpiryDate, formatExpiryStatus, getExpiryInfo } from '@/features/inventory/expiry';
import {
  type LocalInventoryItem,
  useInventoryItems,
} from '@/features/inventory/use-inventory-items';
import { pollHouseholdUntilEntitlementActive } from '@/features/premium/household-entitlement-sync';
import { usePremium } from '@/features/premium/premium-provider';
import { syncRevenueCatAiEntitlement } from '@/features/premium/revenuecat-entitlement-sync';
import { RecipePreviewCard } from '@/features/recipes/components/recipe-preview-card';
import { useRecipeCoverUrl } from '@/features/recipes/data/household-recipe-images';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { hasAIEntitlement, restorePurchases } from '@/lib/backend/revenuecat';
import { getDatabase } from '@/lib/db/local-client';
import { getUnitLabel } from '@/lib/units';
import {
  ApplyIngredientSwapProposalError,
  applyAssistantIngredientSwapProposal,
} from '../data/apply-ingredient-swap-proposal';
import {
  ApplyMealPlanProposalError,
  applyAssistantMealPlanProposal,
} from '../data/apply-meal-plan-proposal';
import { applyAssistantShoppingListProposal } from '../data/apply-shopping-list-proposal';
import { getAiCreditStatus, sendAssistantMessage } from '../data/assistant-api';
import { encodeAssistantAttachments } from '../data/assistant-attachments';
import { loadAssistantThreads, saveAssistantThreads } from '../data/assistant-storage';
import {
  type AssistantAttachment,
  type AssistantAttachmentInput,
  type AssistantMessage,
  type AssistantPageContext,
  type AssistantProposal,
  type AssistantRecipeReference,
  type AssistantThread,
  type AssistantToolName,
  createLocalId,
  DEFAULT_AI_MODEL,
} from '../types';

const STARTER_PROMPTS = ['cook', 'useSoon', 'planWeek'] as const;
type StarterPrompt = (typeof STARTER_PROMPTS)[number];
const EXPIRING_COOKING_PROMPT: StarterPrompt = 'cook';
const EXPIRING_FLOW_DELAY_MS = 300;

type ExpiringFlowStage = 'checking' | 'selecting' | 'idle';

const EMPTY_INVENTORY_ITEMS: LocalInventoryItem[] = [];

type AssistantToolIcon =
  | 'search'
  | 'archive'
  | 'shopping-cart'
  | 'calendar'
  | 'shuffle'
  | 'plus-circle';

const ASSISTANT_TOOL_TRACE = {
  search_recipes: { icon: 'search' },
  get_inventory: { icon: 'archive' },
  get_shopping_list: { icon: 'shopping-cart' },
  propose_meal_plan: { icon: 'calendar' },
  suggest_ingredient_swap: { icon: 'shuffle' },
  propose_shopping_list_item: { icon: 'plus-circle' },
  propose_shopping_list_items: { icon: 'plus-circle' },
} satisfies Record<AssistantToolName, { icon: AssistantToolIcon }>;

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
  },
  threadStrip: {
    flexGrow: 0,
    maxHeight: rs(220),
    marginBottom: theme.space.md,
  },
  threadStripContent: {
    gap: theme.space.xs,
    padding: theme.space.sm,
  },
  selectionButton: {
    flex: 1,
    minHeight: controlSizes.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
  },
  threadHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  threadHistory: {
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
  threadHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  creditHeader: {
    alignItems: 'center',
    marginBottom: theme.space.md,
  },
  creditNote: {
    textAlign: 'center',
  },
  expiringFlow: {
    gap: theme.space.sm,
    marginBottom: theme.space.md,
  },
  expiringPicker: {
    gap: theme.space.sm,
  },
  expiringPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  expiringPickerActions: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  expiringPickerList: {
    gap: theme.space.xs,
  },
  expiringItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingVertical: theme.space.xs,
  },
  expiringItemBox: {
    width: rs(24),
    height: rs(24),
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiringItemBoxSelected: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  expiringItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  expiringItemDate: {
    marginTop: theme.space.xs,
  },
  expiringSelectionButton: {
    alignSelf: 'stretch',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    gap: theme.space.lg,
    paddingBottom: theme.space.md,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.sm,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
  },
  userMessageStack: {
    maxWidth: '88%',
    alignItems: 'flex-end',
  },
  assistantMessageStack: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: theme.space.xs,
  },
  assistantAvatar: {
    width: rs(40),
    height: rs(40),
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.space.xs,
  },
  messageSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
  recipeReferences: {
    width: '100%',
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
  assistantWorking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.sm,
  },
  assistantWorkingText: {
    flex: 1,
  },
  toolTraceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.xs,
    marginTop: theme.space.xs,
  },
  messageBubble: {
    maxWidth: '100%',
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    backgroundColor: theme.backgroundElement,
  },
  userMessageBubble: {
    backgroundColor: theme.backgroundSoft,
  },
  composer: {
    paddingTop: theme.space.md,
    marginBottom: theme.space.xxxl,
    gap: theme.space.xs,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.xs,
  },
  contextLabel: {
    flex: 1,
  },
  attachmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.xs,
  },
  attachmentName: {
    maxWidth: '90%',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.sm,
  },
  composerField: {
    flex: 1,
    minWidth: 0,
  },
  composerInput: {
    flex: 1,
    minHeight: rs(56),
    maxHeight: rs(144),
  },
  assistantError: {
    gap: theme.space.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xxl,
  },
  starterPrompts: {
    alignSelf: 'stretch',
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
  },
  proposalCard: {
    width: '100%',
    gap: theme.space.sm,
    marginTop: theme.space.sm,
  },
  proposalActions: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginTop: theme.space.xs,
  },
  proposalAction: {
    flex: 1,
  },
  proposalMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  proposalMealImage: {
    width: rs(76),
    height: rs(68),
    borderRadius: theme.radius.md,
  },
  proposalMealPlaceholder: {
    width: rs(76),
    height: rs(68),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
  proposalMealCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
  },
}));

type MealPlanProposalItem = Extract<
  AssistantProposal,
  { kind: 'meal_plan_proposal.v1' }
>['meals'][number];

type FailedAssistantMessage = {
  threadId: string;
  text: string;
  attachments?: AssistantAttachment[];
  focusedInventoryLotIds?: string[];
  retryable: boolean;
};

type AssistantRouteParams = {
  pageContextKind?: string | string[];
  pageContextRecipeId?: string | string[];
  pageContextWeekStart?: string | string[];
};

function firstSearchParam(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

function parseAssistantPageContext(params: AssistantRouteParams): AssistantPageContext | null {
  const kind = firstSearchParam(params.pageContextKind);
  if (kind === 'recipe') {
    const recipeId = firstSearchParam(params.pageContextRecipeId);
    return recipeId ? { kind, recipeId } : null;
  }
  if (kind === 'meal_plan') {
    const weekStartDate = firstSearchParam(params.pageContextWeekStart);
    return weekStartDate ? { kind, weekStartDate } : null;
  }
  return null;
}

function useAssistantRouteParamsFromRouter(): AssistantRouteParams {
  return useLocalSearchParams<AssistantRouteParams>();
}

function getEmptyAssistantRouteParams(): AssistantRouteParams {
  return {};
}

const useAssistantRouteParams =
  typeof useLocalSearchParams === 'function'
    ? useAssistantRouteParamsFromRouter
    : getEmptyAssistantRouteParams;

function isAssistantImageMimeType(
  value: string | null | undefined,
): value is Extract<AssistantAttachmentInput['mimeType'], `image/${string}`> {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function getStarterPromptLabel(t: TFunction, prompt: StarterPrompt): string {
  switch (prompt) {
    case 'cook':
      return t('aiAssistant.starter.cook');
    case 'useSoon':
      return t('aiAssistant.starter.useSoon');
    case 'planWeek':
      return t('aiAssistant.starter.planWeek');
  }
}

function getExpiringFlowMessage(t: TFunction, stage: Exclude<ExpiringFlowStage, 'idle'>): string {
  return stage === 'checking' ? t('aiAssistant.flow.checking') : t('aiAssistant.flow.selecting');
}

function getAssistantToolTraceLabel(t: TFunction, tool: AssistantToolName): string {
  switch (tool) {
    case 'search_recipes':
      return t('aiAssistant.toolTrace.searchRecipes');
    case 'get_inventory':
      return t('aiAssistant.toolTrace.inventory');
    case 'get_shopping_list':
      return t('aiAssistant.toolTrace.shoppingList');
    case 'propose_meal_plan':
      return t('aiAssistant.toolTrace.mealPlan');
    case 'suggest_ingredient_swap':
      return t('aiAssistant.toolTrace.ingredientSwap');
    case 'propose_shopping_list_item':
    case 'propose_shopping_list_items':
      return t('aiAssistant.toolTrace.shoppingItem');
  }
}

function getMealSlotLabel(t: TFunction, mealSlot: MealPlanProposalItem['mealSlot']): string {
  switch (mealSlot) {
    case 'breakfast':
      return t('aiAssistant.mealPlan.breakfast');
    case 'lunch':
      return t('aiAssistant.mealPlan.lunch');
    case 'dinner':
      return t('aiAssistant.mealPlan.dinner');
  }
}

function pageContextLabel(t: TFunction, context: AssistantPageContext): string {
  return context.kind === 'recipe'
    ? t('aiAssistant.context.recipe')
    : t('aiAssistant.context.week', { weekStartDate: context.weekStartDate });
}

function getProposalUnitLabel(t: TFunction, rawUnit: string, quantity: number): string {
  if (quantity === 1) return getUnitLabel(rawUnit, t);

  switch (rawUnit) {
    case 'package':
      return t('aiAssistant.units.packagePlural');
    case 'portion':
      return t('aiAssistant.units.portionPlural');
    default:
      return getUnitLabel(rawUnit, t);
  }
}

function mealPlanApplyErrorMessage(t: TFunction, code: string): string {
  switch (code) {
    case 'food_rules_changed':
      return t('aiAssistant.mealPlan.errorFoodRules');
    case 'food_rule_coverage_changed':
    case 'recipe_evidence_changed':
      return t('aiAssistant.mealPlan.errorCoverage');
    case 'recipe_changed':
      return t('aiAssistant.mealPlan.errorRecipe');
    case 'meal_slot_conflict':
      return t('aiAssistant.mealPlan.errorConflict');
    default:
      return t('aiAssistant.mealPlan.errorInvalid');
  }
}

function ingredientSwapApplyErrorMessage(t: TFunction, code: string): string {
  switch (code) {
    case 'food_rules_changed':
      return t('aiAssistant.ingredientSwap.errorFoodRules');
    case 'food_rule_coverage_changed':
      return t('aiAssistant.ingredientSwap.errorCoverage');
    case 'recipe_changed':
    case 'recipe_evidence_changed':
      return t('aiAssistant.ingredientSwap.errorRecipe');
    default:
      return t('aiAssistant.ingredientSwap.errorInvalid');
  }
}

function localizeAssistantError(
  t: TFunction,
  error: unknown,
  fallback: 'load' | 'send' | 'retry',
): string {
  if (error instanceof Error) {
    switch (error.message) {
      case 'Für den Assistant brauchst du das AI-Abo dieses Haushalts.':
        return t('aiAssistant.errors.aiSubscriptionRequired');
      case 'Das monatliche AI-Credit-Limit ist erreicht.':
        return t('aiAssistant.errors.creditLimitExceeded');
      case 'Die Lebensmittelregeln aller Mitessenden konnten nicht vollständig geprüft werden. Deshalb erstellt der Assistant gerade keinen Essensvorschlag.':
        return t('aiAssistant.errors.foodRuleSnapshotUnavailable');
      case 'Mitessende oder Lebensmittelregeln haben sich während der Anfrage geändert. Bitte sende sie erneut.':
        return t('aiAssistant.errors.foodRuleSnapshotChanged');
      case 'Dieses AI-Modell ist derzeit nicht verfügbar.':
        return t('aiAssistant.errors.modelNotAllowed');
      case 'Die KI konnte gerade keine passende Antwort erstellen.':
        return t('aiAssistant.errors.providerInvalidJson');
      case 'Die KI hat gerade eine ungültige Antwort geliefert. Bitte versuche es erneut.':
        return t('aiAssistant.errors.invalidReply');
      case 'Der ausgewählte KI-Anbieter ist serverseitig nicht konfiguriert. Bitte wähle ein anderes Modell.':
        return t('aiAssistant.errors.providerNotConfigured');
      case 'Die KI ist gerade nicht erreichbar. Bitte versuche es später erneut.':
        return t('aiAssistant.errors.providerUnavailable');
      case 'Die KI ist gerade stark ausgelastet. Bitte versuche es später erneut.':
        return t('aiAssistant.errors.providerRateLimited');
      case 'Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut.':
        return t('aiAssistant.errors.providerRequestFailed');
      case 'Der Assistant ist gerade nicht erreichbar. Bitte prüfe deine Verbindung und versuche es erneut.':
        return t('aiAssistant.errors.assistantUnavailable');
      case 'Die Antwort des Assistant hatte ein ungültiges Format.':
        return t('aiAssistant.errors.invalidAssistantResponse');
      case 'Füge höchstens fünf Anhänge hinzu.':
        return t('aiAssistant.attachments.limit');
      case 'Der ausgewählte Anhang ist nicht mehr verfügbar.':
        return t('aiAssistant.attachments.fileUnavailable');
      case 'Anhänge dürfen zusammen höchstens 8 MB groß sein.':
        return t('aiAssistant.attachments.sizeLimit');
      default:
        return error.message;
    }
  }

  switch (fallback) {
    case 'load':
      return t('aiAssistant.screen.loadFallback');
    case 'send':
      return t('aiAssistant.screen.sendFallback');
    case 'retry':
      return t('aiAssistant.screen.retryFallback');
  }
}

function isRetryableAssistantError(error: unknown): boolean {
  return error instanceof Error && 'retryable' in error && error.retryable === true;
}

function AssistantProposalMealRow({ meal }: { meal: MealPlanProposalItem }) {
  const { t, i18n } = useTranslation();
  const { data: coverImagePath } = useQuery({
    queryKey: ['assistant-recipe-cover-path', meal.recipeId],
    queryFn: async () => {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ cover_image_path: string | null }>(
        'select cover_image_path from recipes where id = ? and deleted_at is null limit 1',
        [meal.recipeId],
      );
      return row?.cover_image_path ?? null;
    },
  });
  const { data: imageUrl } = useRecipeCoverUrl(coverImagePath);
  const locale = i18n.language.startsWith('en') ? 'en-US' : 'de-DE';
  const day = new Date(`${meal.date}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'short',
  });
  const mealSlot = getMealSlotLabel(t, meal.mealSlot);

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={t('aiAssistant.mealPlan.mealAccessibility', {
        name: meal.recipeTitle,
        day,
        count: meal.portions,
      })}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: meal.recipeId } })}
      style={styles.proposalMealButton}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} contentFit="cover" style={styles.proposalMealImage} />
      ) : (
        <Surface tone="soft" style={styles.proposalMealPlaceholder}>
          <Txt variant="glyph" tone="accent" weight="700">
            ✦
          </Txt>
        </Surface>
      )}
      <View style={styles.proposalMealCopy}>
        <Txt variant="body" weight="700" numberOfLines={2}>
          {meal.recipeTitle}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {t('aiAssistant.mealPlan.mealDetails', {
            day,
            mealSlot,
            count: meal.portions,
          })}
        </Txt>
        <Txt variant="caption" tone="secondary" numberOfLines={2}>
          {meal.rationale}
        </Txt>
      </View>
      <Txt variant="glyphSmall" tone="secondary">
        ›
      </Txt>
    </Press>
  );
}

function upsertThread(
  threads: readonly AssistantThread[],
  nextThread: AssistantThread,
): AssistantThread[] {
  return [nextThread, ...threads.filter((thread) => thread.id !== nextThread.id)]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 20);
}

function formatShoppingItemQuantity(
  t: TFunction,
  proposal: Extract<AssistantProposal, { kind: 'shopping_list_item_proposal.v1' }>,
): string {
  return t('aiAssistant.shoppingList.quantity', {
    quantity: proposal.quantity,
    unit: getProposalUnitLabel(t, proposal.unit, proposal.quantity),
  });
}

function formatShoppingProposalItem(
  t: TFunction,
  item: Extract<AssistantProposal, { kind: 'shopping_list_proposal.v1' }>['items'][number],
): string {
  return t('aiAssistant.shoppingList.item', {
    quantity: item.quantity,
    unit: getProposalUnitLabel(t, item.unit, item.quantity),
    name: item.name,
  });
}

export function AssistantScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { pageContextKind, pageContextRecipeId, pageContextWeekStart } = useAssistantRouteParams();
  const initialPageContext = useMemo(
    () => parseAssistantPageContext({ pageContextKind, pageContextRecipeId, pageContextWeekStart }),
    [pageContextKind, pageContextRecipeId, pageContextWeekStart],
  );
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();
  const { data: inventoryItems } = useInventoryItems(activeHouseholdId ?? undefined);
  const availableInventoryItems = inventoryItems ?? EMPTY_INVENTORY_ITEMS;
  const { hasAI, refresh: refreshPremium } = usePremium();
  const addShoppingItem = useAddShoppingItem();
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pageContext, setPageContext] = useState<AssistantPageContext | null>(initialPageContext);
  const [attachments, setAttachments] = useState<AssistantAttachmentInput[]>([]);
  const [message, setMessage] = useState('');
  const [creditStatus, setCreditStatus] = useState<Awaited<
    ReturnType<typeof getAiCreditStatus>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedExpiringLotIds, setSelectedExpiringLotIds] = useState<string[]>([]);
  const [expiringFlowStage, setExpiringFlowStage] = useState<ExpiringFlowStage>('idle');
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [failedMessage, setFailedMessage] = useState<FailedAssistantMessage | null>(null);
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null);
  const applyingProposalRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

  const expiringItems = useMemo(() => {
    const today = new Date();
    return availableInventoryItems.filter((item) => {
      const bucket = getExpiryInfo(item.expiry_date, today).bucket;
      return bucket === 'expired' || bucket === 'critical' || bucket === 'soon';
    });
  }, [availableInventoryItems]);
  const expiringItemIds = useMemo(() => expiringItems.map((item) => item.id), [expiringItems]);
  useEffect(() => {
    if (expiringItemIds.length > 1) {
      setSelectedExpiringLotIds(expiringItemIds);
    } else {
      setSelectedExpiringLotIds([]);
    }
  }, [expiringItemIds]);

  useEffect(() => {
    if (expiringFlowStage !== 'checking') return;
    const timeoutId = setTimeout(() => setExpiringFlowStage('selecting'), EXPIRING_FLOW_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [expiringFlowStage]);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let current = true;
    setIsLoading(true);
    void loadAssistantThreads(userId)
      .then((storedThreads) => {
        if (!current) return;
        setThreads(storedThreads);
        setActiveThreadId(storedThreads[0]?.id ?? null);
      })
      .catch((loadError: unknown) => {
        if (current) {
          setError(localizeAssistantError(t, loadError, 'load'));
        }
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });

    return () => {
      current = false;
    };
  }, [userId, t]);

  useEffect(() => {
    if (!activeHouseholdId || !hasAI) {
      setCreditStatus(null);
      return;
    }
    let current = true;
    void getAiCreditStatus(activeHouseholdId)
      .then((status) => {
        if (current) setCreditStatus(status);
      })
      .catch(() => {
        if (current) setCreditStatus(null);
      });
    return () => {
      current = false;
    };
  }, [activeHouseholdId, hasAI]);

  const persistThreads = useCallback(
    async (nextThreads: AssistantThread[]) => {
      if (!userId) return;
      setThreads(nextThreads);
      await saveAssistantThreads(userId, nextThreads);
    },
    [userId],
  );

  async function startNewThread() {
    const timestamp = new Date().toISOString();
    const nextThread: AssistantThread = {
      id: createLocalId('chat'),
      title: t('aiAssistant.history.new'),
      model: DEFAULT_AI_MODEL,
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setActiveThreadId(nextThread.id);
    setExpiringFlowStage('idle');
    setFailedMessage(null);
    await persistThreads(upsertThread(threads, nextThread));
    setError(null);
  }

  async function handleRestoreAiPurchases() {
    if (isRestoringPurchases) return;
    setIsRestoringPurchases(true);
    try {
      const result = await restorePurchases();
      if (!result.ok) {
        Alert.alert(
          t('aiAssistant.restore.failedTitle'),
          result.error instanceof Error
            ? result.error.message
            : t('aiAssistant.restore.genericFailure'),
        );
        return;
      }

      await refreshPremium();
      if (!hasAIEntitlement(result.customerInfo)) {
        Alert.alert(
          t('aiAssistant.restore.noEntitlementTitle'),
          t('aiAssistant.restore.noEntitlementMessage'),
        );
        return;
      }

      const synced = await syncRevenueCatAiEntitlement(activeHouseholdId, result.customerInfo);
      const householdActive = userId
        ? await pollHouseholdUntilEntitlementActive({
            tier: 'ai',
            userId,
            activeHouseholdId,
          })
        : false;
      await refreshPremium();

      if (!synced || !householdActive) {
        Alert.alert(
          t('aiAssistant.restore.householdInactiveTitle'),
          t('aiAssistant.restore.householdInactiveMessage'),
          [
            { text: t('aiAssistant.restore.later'), style: 'cancel' },
            {
              text: t('aiAssistant.restore.retry'),
              onPress: () => void handleRestoreAiPurchases(),
            },
          ],
        );
        return;
      }

      Alert.alert(t('aiAssistant.restore.successTitle'), t('aiAssistant.restore.successMessage'));
    } catch (restoreError) {
      Alert.alert(
        t('aiAssistant.restore.failedTitle'),
        restoreError instanceof Error
          ? restoreError.message
          : t('aiAssistant.restore.genericFailure'),
      );
    } finally {
      setIsRestoringPurchases(false);
    }
  }

  async function pickAssistantImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('aiAssistant.attachments.permission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 5 - attachments.length),
      quality: 0.8,
    });
    if (result.canceled) return;
    const selected: AssistantAttachmentInput[] = result.assets.flatMap((asset, index) => {
      const mimeType = asset.mimeType;
      if (!isAssistantImageMimeType(mimeType)) return [];
      return [
        {
          uri: asset.uri,
          name: asset.fileName ?? `${t('aiAssistant.screen.attachmentImage')} ${String(index + 1)}`,
          mimeType,
        },
      ];
    });
    if (selected.length === 0) {
      setError(t('aiAssistant.attachments.invalidType'));
      return;
    }
    setAttachments((current) => [...current, ...selected].slice(0, 5));
    setError(null);
  }

  async function pickAssistantPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
      base64: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const pdfAttachment: AssistantAttachmentInput = {
      uri: asset.uri,
      name: asset.name,
      mimeType: 'application/pdf',
    };
    setAttachments((current) => [...current, pdfAttachment].slice(0, 5));
    setError(null);
  }

  function openAttachmentPicker() {
    setExpiringFlowStage('idle');
    if (attachments.length >= 5) {
      setError(t('aiAssistant.attachments.limit'));
      return;
    }
    Alert.alert(
      t('aiAssistant.attachments.pickerTitle'),
      t('aiAssistant.attachments.pickerMessage'),
      [
        { text: t('aiAssistant.attachments.cancel'), style: 'cancel' },
        {
          text: t('aiAssistant.attachments.chooseImage'),
          onPress: () => void pickAssistantImages(),
        },
        { text: t('aiAssistant.attachments.choosePdf'), onPress: () => void pickAssistantPdf() },
      ],
    );
  }
  function openRecipeReference(recipe: AssistantRecipeReference) {
    if (recipe.source === 'catalog' && recipe.slug) {
      router.push({ pathname: '/recipe/catalog/[slug]', params: { slug: recipe.slug } });
      return;
    }
    router.push({ pathname: '/recipe/[id]', params: { id: recipe.recipeId } });
  }

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? message).trim();
    if (
      !userId ||
      !activeHouseholdId ||
      !hasAI ||
      (!text && attachments.length === 0) ||
      isSending ||
      expiringFlowStage === 'checking'
    ) {
      return;
    }
    if (failedMessage?.threadId === activeThreadId && failedMessage.text === text) {
      await retryFailedMessage();
      return;
    }

    const requestFocusedInventoryLotIds =
      expiringFlowStage === 'selecting' &&
      text === getStarterPromptLabel(t, EXPIRING_COOKING_PROMPT) &&
      attachments.length === 0 &&
      expiringItems.length > 1
        ? selectedExpiringLotIds
        : undefined;

    setIsSending(true);
    setExpiringFlowStage('idle');
    setError(null);
    setFailedMessage(null);
    let requestThreadId: string | null = null;
    let encodedAttachments: AssistantAttachment[] = [];
    try {
      encodedAttachments = await encodeAssistantAttachments(attachments);
      const timestamp = new Date().toISOString();
      const currentThread: AssistantThread = activeThread ?? {
        id: createLocalId('chat'),
        title: text ? text.slice(0, 54) : t('aiAssistant.history.attachment'),
        model: DEFAULT_AI_MODEL,
        messages: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const userMessage: AssistantMessage = {
        id: createLocalId('message'),
        role: 'user',
        text,
        createdAt: timestamp,
        ...(encodedAttachments.length > 0
          ? {
              attachments: encodedAttachments.map(({ filename, mimeType }) => ({
                filename,
                mimeType,
              })),
            }
          : {}),
        ...(pageContext ? { pageContext } : {}),
      };
      const pendingThread: AssistantThread = {
        ...currentThread,
        title:
          currentThread.messages.length === 0
            ? text
              ? text.slice(0, 54)
              : t('aiAssistant.history.attachment')
            : currentThread.title,
        model: DEFAULT_AI_MODEL,
        messages: [...currentThread.messages, userMessage].slice(-60),
        updatedAt: timestamp,
      };
      const pendingThreads = upsertThread(threads, pendingThread);
      requestThreadId = pendingThread.id;
      setActiveThreadId(pendingThread.id);
      await persistThreads(pendingThreads);
      setMessage('');
      setAttachments([]);
      const reply = await sendAssistantMessage({
        householdId: activeHouseholdId,
        message: text,
        includeHouseholdContext: true,
        ...(requestFocusedInventoryLotIds !== undefined
          ? { focusedInventoryLotIds: requestFocusedInventoryLotIds }
          : {}),
        ...(pageContext ? { pageContext } : {}),
        ...(encodedAttachments.length > 0 ? { attachments: encodedAttachments } : {}),
        history: currentThread.messages.map(({ role, text: content }) => ({ role, text: content })),
      });
      const assistantMessage: AssistantMessage = {
        id: createLocalId('message'),
        role: 'assistant',
        text: reply.result.text,
        createdAt: new Date().toISOString(),
        suggestions: reply.result.suggestions,
        recipeReferences: reply.result.recipeReferences,
        proposals: reply.result.proposals,
        toolTrace: reply.result.toolTrace,
      };
      const completedThread: AssistantThread = {
        ...pendingThread,
        model: reply.model,
        messages: [...pendingThread.messages, assistantMessage].slice(-60),
        updatedAt: assistantMessage.createdAt,
      };
      await persistThreads(upsertThread(pendingThreads, completedThread));
      try {
        setCreditStatus(await getAiCreditStatus(activeHouseholdId));
      } catch {
        // A status refresh failure must not turn a successful assistant reply into a send failure.
      }
    } catch (sendError: unknown) {
      setError(localizeAssistantError(t, sendError, 'send'));
      if (requestThreadId) {
        const retryable = isRetryableAssistantError(sendError);
        setFailedMessage({
          threadId: requestThreadId,
          text,
          ...(encodedAttachments.length > 0 ? { attachments: encodedAttachments } : {}),
          ...(requestFocusedInventoryLotIds !== undefined
            ? { focusedInventoryLotIds: requestFocusedInventoryLotIds }
            : {}),
          retryable,
        });
        if (!retryable) setMessage(text);
      }
    } finally {
      setIsSending(false);
    }
  }

  async function retryFailedMessage() {
    const failed = failedMessage;
    if (!failed || !userId || !activeHouseholdId || isSending) return;
    const failedThread = threads.find((thread) => thread.id === failed.threadId);
    const lastMessage = failedThread?.messages.at(-1);
    if (!failedThread || lastMessage?.role !== 'user' || lastMessage.text !== failed.text) {
      setFailedMessage(null);
      setError(t('aiAssistant.screen.retryMissing'));
      setMessage(failed.text);
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const reply = await sendAssistantMessage({
        householdId: activeHouseholdId,
        message: failed.text,
        includeHouseholdContext: true,
        ...(failed.focusedInventoryLotIds !== undefined
          ? { focusedInventoryLotIds: failed.focusedInventoryLotIds }
          : {}),
        ...(pageContext ? { pageContext } : {}),
        ...(failed.attachments?.length ? { attachments: failed.attachments } : {}),
        history: failedThread.messages
          .slice(0, -1)
          .map(({ role, text: content }) => ({ role, text: content })),
      });
      const assistantMessage: AssistantMessage = {
        id: createLocalId('message'),
        role: 'assistant',
        text: reply.result.text,
        createdAt: new Date().toISOString(),
        suggestions: reply.result.suggestions,
        recipeReferences: reply.result.recipeReferences,
        proposals: reply.result.proposals,
        toolTrace: reply.result.toolTrace,
      };
      const completedThread: AssistantThread = {
        ...failedThread,
        model: reply.model,
        messages: [...failedThread.messages, assistantMessage].slice(-60),
        updatedAt: assistantMessage.createdAt,
      };
      await persistThreads(upsertThread(threads, completedThread));
      setFailedMessage(null);
      setMessage('');
      try {
        setCreditStatus(await getAiCreditStatus(activeHouseholdId));
      } catch {
        // Keep the last known credit status; the assistant reply was already saved.
      }
    } catch (retryError: unknown) {
      const retryable = isRetryableAssistantError(retryError);
      setError(localizeAssistantError(t, retryError, 'retry'));
      setFailedMessage({ ...failed, retryable });
      if (!retryable) setMessage(failed.text);
    } finally {
      setIsSending(false);
    }
  }

  async function applyMealPlanProposal(
    proposal: Extract<AssistantProposal, { kind: 'meal_plan_proposal.v1' }>,
    key: string,
  ) {
    if (!userId || !activeHouseholdId || applyingProposalRef.current) return;
    applyingProposalRef.current = key;
    setApplyingProposalId(key);
    try {
      const result = await applyAssistantMealPlanProposal({
        householdId: activeHouseholdId,
        userId,
        proposal,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['meal-plan'] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plan-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plan-entries-range'] }),
        queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
      ]);
      Alert.alert(
        t('aiAssistant.mealPlan.addedTitle'),
        result.addedCount === 0
          ? t('aiAssistant.mealPlan.alreadyAdded')
          : t('aiAssistant.mealPlan.added', { count: result.addedCount }),
      );
    } catch (applyError: unknown) {
      const message =
        applyError instanceof ApplyMealPlanProposalError
          ? mealPlanApplyErrorMessage(t, applyError.code)
          : t('aiAssistant.mealPlan.errorGeneric');
      Alert.alert(t('aiAssistant.mealPlan.errorTitle'), message);
    } finally {
      applyingProposalRef.current = null;
      setApplyingProposalId(null);
    }
  }

  async function applyShoppingItemProposal(
    proposal: Extract<AssistantProposal, { kind: 'shopping_list_item_proposal.v1' }>,
    messageId: string,
    proposalIndex: number,
    key: string,
  ) {
    if (!activeThread || !userId || !activeHouseholdId || applyingProposalRef.current) return;
    applyingProposalRef.current = key;
    setApplyingProposalId(key);
    let itemWasAdded = false;
    try {
      await addShoppingItem.mutateAsync({
        household_id: activeHouseholdId,
        name: proposal.name,
        quantity: proposal.quantity,
        unit: proposal.unit,
        product_id: null,
        category_id: null,
        category_source: null,
      });
      itemWasAdded = true;
      const appliedAt = new Date().toISOString();
      const updatedThread: AssistantThread = {
        ...activeThread,
        messages: activeThread.messages.map((item) =>
          item.id === messageId
            ? {
                ...item,
                appliedProposalIndexes: [
                  ...new Set([...(item.appliedProposalIndexes ?? []), proposalIndex]),
                ],
              }
            : item,
        ),
        updatedAt: appliedAt,
      };
      await persistThreads(upsertThread(threads, updatedThread));
      Alert.alert(
        t('aiAssistant.shoppingList.updatedTitle'),
        t('aiAssistant.shoppingList.itemAdded', { name: proposal.name }),
      );
    } catch {
      if (itemWasAdded) {
        Alert.alert(
          t('aiAssistant.shoppingList.itemSavedTitle'),
          t('aiAssistant.shoppingList.itemSavedButHistoryFailed'),
        );
      } else {
        Alert.alert(
          t('aiAssistant.shoppingList.itemErrorTitle'),
          t('aiAssistant.shoppingList.itemError'),
        );
      }
    } finally {
      applyingProposalRef.current = null;
      setApplyingProposalId(null);
    }
  }

  async function applyShoppingListProposal(
    proposal: Extract<AssistantProposal, { kind: 'shopping_list_proposal.v1' }>,
    messageId: string,
    proposalIndex: number,
    key: string,
  ) {
    if (!activeThread || !userId || !activeHouseholdId || applyingProposalRef.current) return;
    applyingProposalRef.current = key;
    setApplyingProposalId(key);
    let result: Awaited<ReturnType<typeof applyAssistantShoppingListProposal>>;
    try {
      result = await applyAssistantShoppingListProposal({
        userId,
        householdId: activeHouseholdId,
        proposalKey: key,
        proposal,
      });
    } catch {
      Alert.alert(
        t('aiAssistant.shoppingList.itemErrorTitle'),
        t('aiAssistant.shoppingList.listError'),
      );
      applyingProposalRef.current = null;
      setApplyingProposalId(null);
      return;
    }

    const appliedAt = new Date().toISOString();
    const updatedThread: AssistantThread = {
      ...activeThread,
      messages: activeThread.messages.map((item) =>
        item.id === messageId
          ? {
              ...item,
              appliedProposalIndexes: [
                ...new Set([...(item.appliedProposalIndexes ?? []), proposalIndex]),
              ],
            }
          : item,
      ),
      updatedAt: appliedAt,
    };
    let historySaved = true;
    try {
      // persistThreads updates the UI state before writing to encrypted storage.
      // A failed history write must not make a committed shopping-list mutation retryable.
      await persistThreads(upsertThread(threads, updatedThread));
    } catch {
      historySaved = false;
    }
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shopping_list_items', activeHouseholdId] }),
        queryClient.invalidateQueries({ queryKey: ['meal-plan-shopping-needs'] }),
        queryClient.invalidateQueries({ queryKey: ['recipe-shopping-needs'] }),
        queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
      ]);
    } catch {
      // The local mutation and its idempotency receipt are already committed.
    }
    const resultMessage = result.alreadyApplied
      ? t('aiAssistant.shoppingList.alreadyApplied')
      : t('aiAssistant.shoppingList.countAdded', { count: result.addedCount });
    Alert.alert(
      t('aiAssistant.shoppingList.updatedTitle'),
      historySaved
        ? resultMessage
        : `${resultMessage}${t('aiAssistant.shoppingList.historyFailedSuffix')}`,
    );
    applyingProposalRef.current = null;
    setApplyingProposalId(null);
  }
  async function applyIngredientSwapProposal(
    proposal: Extract<AssistantProposal, { kind: 'ingredient_swap_proposal.v1' }>,
    messageId: string,
    proposalIndex: number,
    key: string,
  ) {
    if (!activeThread || !userId || !activeHouseholdId || applyingProposalRef.current) return;
    applyingProposalRef.current = key;
    setApplyingProposalId(key);
    try {
      const result = await applyAssistantIngredientSwapProposal({
        householdId: activeHouseholdId,
        proposal,
      });
      const appliedAt = new Date().toISOString();
      const updatedThread: AssistantThread = {
        ...activeThread,
        messages: activeThread.messages.map((item) =>
          item.id === messageId
            ? {
                ...item,
                appliedProposalIndexes: [
                  ...new Set([...(item.appliedProposalIndexes ?? []), proposalIndex]),
                ],
              }
            : item,
        ),
        updatedAt: appliedAt,
      };
      await persistThreads(upsertThread(threads, updatedThread));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recipe-detail', proposal.recipeId] }),
        queryClient.invalidateQueries({ queryKey: ['recipes', activeHouseholdId] }),
        queryClient.invalidateQueries({ queryKey: ['sync-status'] }),
      ]);
      Alert.alert(
        t('aiAssistant.ingredientSwap.updatedTitle'),
        result.changed
          ? t('aiAssistant.ingredientSwap.changed')
          : t('aiAssistant.ingredientSwap.unchanged'),
      );
    } catch (applyError: unknown) {
      const message =
        applyError instanceof ApplyIngredientSwapProposalError
          ? ingredientSwapApplyErrorMessage(t, applyError.code)
          : t('aiAssistant.ingredientSwap.errorGeneric');
      Alert.alert(t('aiAssistant.ingredientSwap.errorTitle'), message);
    } finally {
      applyingProposalRef.current = null;
      setApplyingProposalId(null);
    }
  }

  function renderProposal(
    proposal: AssistantProposal,
    message: AssistantMessage,
    proposalIndex: number,
    key: string,
  ) {
    if (proposal.kind === 'meal_plan_proposal.v1') {
      return (
        <Card key={key} style={styles.proposalCard}>
          <Txt variant="body" weight="700">
            {t('aiAssistant.mealPlan.title', { count: proposal.meals.length })}
          </Txt>
          {proposal.meals.map((meal) => (
            <AssistantProposalMealRow key={`${meal.date}-${meal.mealSlot}`} meal={meal} />
          ))}
          <Pill
            tone="pantry"
            selected={proposal.foodRulesUpdatedAt !== null}
            label={
              proposal.foodRulesUpdatedAt !== null
                ? t('aiAssistant.mealPlan.rulesVerified')
                : t('aiAssistant.mealPlan.rulesMissing')
            }
          />
          <Txt variant="caption" tone="secondary">
            {proposal.safetyNote}
          </Txt>
          <View style={styles.proposalActions}>
            <Button
              accessibilityLabel={t('aiAssistant.mealPlan.reviewAccessibility')}
              disabled={applyingProposalId !== null}
              onPress={() => {
                const meals = proposal.meals
                  .map((meal) =>
                    t('aiAssistant.mealPlan.confirmMeal', {
                      date: meal.date,
                      title: meal.recipeTitle,
                      count: meal.portions,
                    }),
                  )
                  .join('\n');
                Alert.alert(
                  t('aiAssistant.mealPlan.confirmTitle'),
                  `${meals}\n\n${proposal.safetyNote}`,
                  [
                    { text: t('aiAssistant.mealPlan.confirmBack'), style: 'cancel' },
                    {
                      text: t('aiAssistant.mealPlan.applyAccessibility'),
                      onPress: () => void applyMealPlanProposal(proposal, key),
                    },
                  ],
                );
              }}
              variant="secondary"
              size="sm"
              flat
              title={t('aiAssistant.mealPlan.review')}
              style={styles.proposalAction}
            />
            <Button
              accessibilityLabel={t('aiAssistant.mealPlan.applyAccessibility')}
              disabled={applyingProposalId !== null}
              onPress={() => void applyMealPlanProposal(proposal, key)}
              variant="primary"
              size="sm"
              loading={applyingProposalId === key}
              title={t('aiAssistant.mealPlan.apply')}
              style={styles.proposalAction}
            />
          </View>
        </Card>
      );
    }

    if (proposal.kind === 'shopping_list_item_proposal.v1') {
      const isApplied = message.appliedProposalIndexes?.includes(proposalIndex) ?? false;
      const quantityLabel = formatShoppingItemQuantity(t, proposal);
      const warning =
        proposal.foodRuleStatus === 'unknown'
          ? t('aiAssistant.shoppingList.unknownWarning')
          : t('aiAssistant.shoppingList.noRulesWarning');

      return (
        <Card key={key} style={styles.proposalCard}>
          <Txt variant="body" weight="700">
            {t('aiAssistant.shoppingList.title')}
          </Txt>
          <Txt variant="body">
            {quantityLabel} · {proposal.name}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {warning}
          </Txt>
          <Button
            accessibilityLabel={t('aiAssistant.shoppingList.applyAccessibility', {
              name: proposal.name,
            })}
            disabled={isApplied || applyingProposalId !== null}
            onPress={() =>
              Alert.alert(
                t('aiAssistant.shoppingList.confirmTitle'),
                `${quantityLabel} · ${proposal.name}\n\n${warning}`,
                [
                  { text: t('aiAssistant.shoppingList.cancel'), style: 'cancel' },
                  {
                    text: t('aiAssistant.shoppingList.apply'),
                    onPress: () =>
                      void applyShoppingItemProposal(proposal, message.id, proposalIndex, key),
                  },
                ],
              )
            }
            variant="primary"
            size="sm"
            loading={applyingProposalId === key}
            title={
              isApplied ? t('aiAssistant.shoppingList.added') : t('aiAssistant.shoppingList.apply')
            }
            style={styles.proposalAction}
          />
        </Card>
      );
    }

    if (proposal.kind === 'shopping_list_proposal.v1') {
      const isApplied = message.appliedProposalIndexes?.includes(proposalIndex) ?? false;
      const warning = proposal.items.some((item) => item.foodRuleStatus === 'unknown')
        ? t('aiAssistant.shoppingList.unknownWarning')
        : t('aiAssistant.shoppingList.noRulesWarning');
      return (
        <Card key={key} style={styles.proposalCard}>
          <Txt variant="body" weight="700">
            {t('aiAssistant.shoppingList.title')}
          </Txt>
          {proposal.items.map((item) => (
            <Txt key={`${item.name}-${item.unit}`} variant="body">
              {formatShoppingProposalItem(t, item)}
            </Txt>
          ))}
          <Txt variant="caption" tone="secondary">
            {warning}
          </Txt>
          <Button
            accessibilityLabel={t('aiAssistant.shoppingList.applyAllAccessibility')}
            disabled={isApplied || applyingProposalId !== null}
            onPress={() =>
              Alert.alert(
                t('aiAssistant.shoppingList.confirmTitle'),
                `${proposal.summary}\n\n${warning}`,
                [
                  { text: t('aiAssistant.shoppingList.cancel'), style: 'cancel' },
                  {
                    text: t('aiAssistant.shoppingList.apply'),
                    onPress: () =>
                      void applyShoppingListProposal(proposal, message.id, proposalIndex, key),
                  },
                ],
              )
            }
            variant="primary"
            size="sm"
            loading={applyingProposalId === key}
            title={
              isApplied ? t('aiAssistant.shoppingList.added') : t('aiAssistant.shoppingList.apply')
            }
            style={styles.proposalAction}
          />
        </Card>
      );
    }

    return (
      <Card key={key} style={styles.proposalCard}>
        <Txt variant="body" weight="700">
          {t('aiAssistant.ingredientSwap.title')}
        </Txt>
        <Txt variant="body">
          {t('aiAssistant.ingredientSwap.item', {
            recipeTitle: proposal.recipeTitle,
            ingredientName: proposal.ingredientName,
            replacement: proposal.replacement,
          })}
        </Txt>
        <Txt variant="body" tone="secondary">
          {proposal.rationale}
        </Txt>
        <Pill
          tone="pantry"
          selected={proposal.foodRulesUpdatedAt !== null}
          label={
            proposal.foodRulesUpdatedAt !== null
              ? t('aiAssistant.ingredientSwap.rulesVerified')
              : t('aiAssistant.ingredientSwap.rulesMissing')
          }
        />
        <Txt variant="caption" tone="secondary">
          {proposal.safetyNote}
        </Txt>
        <View style={styles.proposalActions}>
          <Button
            title={t('aiAssistant.ingredientSwap.forThisTime')}
            accessibilityLabel={t('aiAssistant.ingredientSwap.forThisTimeAccessibility')}
            disabled={applyingProposalId !== null}
            onPress={() =>
              router.push({
                pathname: '/recipe/cook',
                params: {
                  id: proposal.recipeId,
                  swapIngredient: proposal.ingredientName,
                  swapReplacement: proposal.replacement,
                },
              })
            }
            variant="secondary"
            size="sm"
            flat
            style={styles.proposalAction}
          />
          <Button
            title={t('aiAssistant.ingredientSwap.save')}
            accessibilityLabel={t('aiAssistant.ingredientSwap.saveAccessibility')}
            disabled={applyingProposalId !== null}
            onPress={() =>
              Alert.alert(
                t('aiAssistant.ingredientSwap.confirmTitle'),
                t('aiAssistant.ingredientSwap.confirmMessage', {
                  ingredientName: proposal.ingredientName,
                  replacement: proposal.replacement,
                }),
                [
                  { text: t('aiAssistant.shoppingList.cancel'), style: 'cancel' },
                  {
                    text: t('aiAssistant.ingredientSwap.save'),
                    onPress: () =>
                      void applyIngredientSwapProposal(proposal, message.id, proposalIndex, key),
                  },
                ],
              )
            }
            variant="primary"
            size="sm"
            loading={applyingProposalId === key}
            style={styles.proposalAction}
          />
        </View>
        <Button
          title={t('aiAssistant.ingredientSwap.viewRecipe')}
          onPress={() =>
            router.push({ pathname: '/recipe/[id]', params: { id: proposal.recipeId } })
          }
          variant="secondary"
          full
        />
      </Card>
    );
  }

  async function handleDeleteThread(threadId: string) {
    const nextThreads = threads.filter((thread) => thread.id !== threadId);
    await persistThreads(nextThreads);
    if (activeThreadId === threadId) {
      setActiveThreadId(nextThreads[0]?.id ?? null);
      setExpiringFlowStage('idle');
      setFailedMessage(null);
      setError(null);
    }
  }

  function confirmDeleteThread(thread: AssistantThread) {
    Alert.alert(t('aiAssistant.history.deleteTitle'), t('aiAssistant.history.deleteMessage'), [
      { text: t('aiAssistant.history.cancel'), style: 'cancel' },
      {
        text: t('aiAssistant.history.delete'),
        style: 'destructive',
        onPress: () => void handleDeleteThread(thread.id),
      },
    ]);
  }

  function handleStarterPrompt(prompt: StarterPrompt) {
    const promptText = getStarterPromptLabel(t, prompt);
    if (
      prompt === EXPIRING_COOKING_PROMPT &&
      expiringItems.length > 1 &&
      attachments.length === 0
    ) {
      setMessage(promptText);
      setSelectedExpiringLotIds(expiringItems.map((item) => item.id));
      setExpiringFlowStage('checking');
      setError(null);
      setFailedMessage(null);
      return;
    }
    setExpiringFlowStage('idle');
    setMessage(promptText);
  }

  function toggleExpiringLotId(lotId: string) {
    setSelectedExpiringLotIds((current) =>
      current.includes(lotId) ? current.filter((id) => id !== lotId) : [...current, lotId],
    );
  }

  function renderExpiringFlow() {
    if (expiringFlowStage === 'idle') return null;
    const message = getExpiringFlowMessage(t, expiringFlowStage);
    return (
      <View style={styles.expiringFlow}>
        <View style={styles.messageRow}>
          <Surface tone="soft" style={styles.assistantAvatar}>
            <Txt variant="glyph" tone="accent" weight="700">
              ✦
            </Txt>
          </Surface>
          <View style={styles.assistantMessageStack}>
            <View style={styles.messageBubble}>
              <Txt variant="body" tone="primary">
                {message}
              </Txt>
            </View>
          </View>
        </View>
        {expiringFlowStage === 'selecting' ? renderExpiringInventoryPicker() : null}
      </View>
    );
  }

  function renderExpiringInventoryPicker() {
    if (expiringItems.length <= 1) return null;
    return (
      <Card style={styles.expiringPicker}>
        <View style={styles.expiringPickerHeader}>
          <View style={styles.expiringItemCopy}>
            <Txt variant="label" weight="700">
              {t('aiAssistant.flow.expiringTitle')}
            </Txt>
            <Txt variant="caption" tone="secondary">
              {t('aiAssistant.flow.expiringHint')}
            </Txt>
          </View>
          <Txt variant="caption" tone="secondary">
            {t('aiAssistant.flow.selectedCount', {
              selected: selectedExpiringLotIds.length,
              total: expiringItems.length,
            })}
          </Txt>
        </View>
        <View style={styles.expiringPickerActions}>
          <Button
            title={t('aiAssistant.flow.selectAll')}
            disabled={isSending}
            onPress={() => setSelectedExpiringLotIds(expiringItems.map((item) => item.id))}
            variant="secondary"
            size="sm"
            flat
          />
          <Button
            title={t('aiAssistant.flow.clearSelection')}
            disabled={isSending || selectedExpiringLotIds.length === 0}
            onPress={() => setSelectedExpiringLotIds([])}
            variant="secondary"
            size="sm"
            flat
          />
        </View>
        <View style={styles.expiringPickerList}>
          {expiringItems.map((item) => {
            const selected = selectedExpiringLotIds.includes(item.id);
            const today = new Date();
            const expiry = getExpiryInfo(item.expiry_date, today);
            const expiryDateLocale = i18n.language.startsWith('en') ? 'en-US' : 'de-DE';
            return (
              <Press
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: isSending }}
                accessibilityLabel={item.name}
                disabled={isSending}
                onPress={() => toggleExpiringLotId(item.id)}
                style={styles.expiringItem}>
                <View style={[styles.expiringItemBox, selected && styles.expiringItemBoxSelected]}>
                  {selected ? (
                    <Txt tone="onAccent" weight="700">
                      ✓
                    </Txt>
                  ) : null}
                </View>
                <View style={styles.expiringItemCopy}>
                  <Txt variant="body" weight="600" numberOfLines={1}>
                    {item.name}
                  </Txt>
                  <Txt
                    variant="caption"
                    tone={expiry.bucket === 'expired' ? 'danger' : 'secondary'}
                    style={styles.expiringItemDate}>
                    {formatExpiryDate(item.expiry_date, expiryDateLocale)} ·{' '}
                    {formatExpiryStatus(item.expiry_date, today, t)}
                  </Txt>
                </View>
              </Press>
            );
          })}
        </View>
      </Card>
    );
  }

  const hasReadyContext = Boolean(userId && activeHouseholdId);

  return (
    <HubScreen
      header={{
        title: 'fam',
        titleVariant: 'brand',
        align: 'center',
        leading: <BackButton label={t('aiAssistant.screen.back')} href="/(app)" variant="header" />,
        trailing: hasAI ? (
          <View style={styles.headerActions}>
            <IconButton
              icon="edit-3"
              accessibilityLabel={t('aiAssistant.screen.newChat')}
              onPress={() => {
                setIsHistoryOpen(false);
                void startNewThread();
              }}
              color={colors.accent}
              bg={colors.backgroundSoft}
              size={40}
              iconSize={18}
            />
            {threads.length > 0 ? (
              <IconButton
                icon="menu"
                accessibilityLabel={
                  isHistoryOpen
                    ? t('aiAssistant.screen.historyClose')
                    : t('aiAssistant.screen.historyOpen')
                }
                onPress={() => setIsHistoryOpen((open) => !open)}
                color={colors.accent}
                bg={colors.backgroundSoft}
                size={40}
                iconSize={18}
              />
            ) : null}
          </View>
        ) : null,
      }}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : !userId ? (
          <View style={styles.centered}>
            <Txt variant="body">{t('aiAssistant.screen.signIn')}</Txt>
          </View>
        ) : !hasAI ? (
          <View style={styles.centered}>
            <Txt variant="title" weight="700">
              {t('aiAssistant.paywall.title')}
            </Txt>
            <Txt variant="body" center>
              {t('aiAssistant.paywall.description')}
            </Txt>
            <Button
              title={t('aiAssistant.paywall.view')}
              onPress={() => router.push('/settings/plus-and-ai?tier=ai')}
              full
            />
            <Button
              title={
                isRestoringPurchases
                  ? t('aiAssistant.paywall.restoring')
                  : t('aiAssistant.paywall.restore')
              }
              disabled={isRestoringPurchases}
              onPress={() => void handleRestoreAiPurchases()}
              loading={isRestoringPurchases}
              variant="secondary"
              full
            />
          </View>
        ) : !hasReadyContext ? (
          <View style={styles.centered}>
            <Txt variant="body" center>
              {t('aiAssistant.screen.noHousehold')}
            </Txt>
          </View>
        ) : (
          <>
            {isHistoryOpen && threads.length > 0 ? (
              <Card style={styles.threadHistory}>
                <View style={styles.threadHistoryHeader}>
                  <Txt variant="label" weight="700">
                    {t('aiAssistant.history.title')}
                  </Txt>
                </View>
                <ScrollView
                  style={styles.threadStrip}
                  contentContainerStyle={styles.threadStripContent}
                  showsVerticalScrollIndicator={false}>
                  {threads.map((thread) => (
                    <View key={thread.id} style={styles.threadHistoryRow}>
                      <Press
                        accessibilityRole="button"
                        accessibilityState={{ selected: thread.id === activeThreadId }}
                        selected={thread.id === activeThreadId}
                        onPress={() => {
                          setActiveThreadId(thread.id);
                          setExpiringFlowStage('idle');
                          setFailedMessage(null);
                          setError(null);
                          setIsHistoryOpen(false);
                        }}
                        onLongPress={() => confirmDeleteThread(thread)}
                        style={styles.selectionButton}>
                        <Txt variant="navigation" numberOfLines={1}>
                          {thread.title || t('aiAssistant.history.conversation')}
                        </Txt>
                      </Press>
                      <IconButton
                        icon="trash-2"
                        accessibilityLabel={t('aiAssistant.history.deleteAccessibility', {
                          title: thread.title || t('aiAssistant.history.conversation'),
                        })}
                        onPress={() => confirmDeleteThread(thread)}
                        color={colors.danger}
                        bg={colors.backgroundSoft}
                        size={40}
                        iconSize={18}
                      />
                    </View>
                  ))}
                </ScrollView>
              </Card>
            ) : null}
            {creditStatus ? (
              <View style={styles.creditHeader}>
                <Txt variant="caption" tone="secondary" style={styles.creditNote}>
                  {t('aiAssistant.credit.remaining', { count: creditStatus.creditsRemaining })}
                </Txt>
              </View>
            ) : null}
            <FlashList
              testID="assistant-message-list"
              data={activeThread?.messages ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageRow,
                    item.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow,
                  ]}>
                  {item.role === 'assistant' ? (
                    <Surface tone="soft" style={styles.assistantAvatar}>
                      <Txt variant="glyph" tone="accent" weight="700">
                        ✦
                      </Txt>
                    </Surface>
                  ) : null}
                  <View
                    style={
                      item.role === 'user' ? styles.userMessageStack : styles.assistantMessageStack
                    }>
                    {item.role === 'user' && item.attachments?.length ? (
                      <View style={styles.attachmentRow}>
                        {item.attachments.map((attachment) => (
                          <Txt
                            key={`${item.id}-${attachment.filename}`}
                            variant="caption"
                            tone="secondary"
                            numberOfLines={1}
                            style={styles.attachmentName}>
                            {attachment.mimeType === 'application/pdf'
                              ? t('aiAssistant.screen.attachmentPdf')
                              : t('aiAssistant.screen.attachmentImage')}{' '}
                            · {attachment.filename}
                          </Txt>
                        ))}
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.messageBubble,
                        item.role === 'user' ? styles.userMessageBubble : undefined,
                      ]}>
                      <Txt variant="body" tone="primary">
                        {item.text}
                      </Txt>
                    </View>
                    {item.role === 'assistant' && item.toolTrace?.length ? (
                      <View style={styles.toolTraceRow}>
                        {item.toolTrace.map((tool) => (
                          <Badge
                            key={`${item.id}-${tool}`}
                            label={getAssistantToolTraceLabel(t, tool)}
                            icon={ASSISTANT_TOOL_TRACE[tool].icon}
                            tone="grocery"
                            solid
                          />
                        ))}
                      </View>
                    ) : null}
                    {item.role === 'assistant' && item.recipeReferences?.length ? (
                      <View style={styles.recipeReferences}>
                        {item.recipeReferences.map((recipe) => (
                          <RecipePreviewCard
                            key={`${item.id}-${recipe.source}-${recipe.recipeId}`}
                            title={recipe.title}
                            coverImagePath={recipe.coverImagePath}
                            coverSource={recipe.source}
                            onPress={() => openRecipeReference(recipe)}
                          />
                        ))}
                      </View>
                    ) : null}
                    {item.role === 'assistant'
                      ? item.proposals?.map((proposal, index) =>
                          renderProposal(proposal, item, index, `${item.id}-${String(index)}`),
                        )
                      : null}
                    {item.role === 'assistant' && item.suggestions?.length ? (
                      <View style={styles.messageSuggestions}>
                        {item.suggestions.map((suggestion) => (
                          <Button
                            key={suggestion}
                            title={suggestion}
                            disabled={isSending}
                            onPress={() => void handleSend(suggestion)}
                            variant="secondary"
                            size="sm"
                            flat
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              )}
              ListHeaderComponent={renderExpiringFlow()}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Txt variant="heading" weight="700" center>
                    {t('aiAssistant.screen.emptyTitle')}
                  </Txt>
                  <View style={styles.starterPrompts}>
                    <Button
                      title={t('aiAssistant.screen.cookFromStock')}
                      onPress={() => router.push('/chef-koch')}
                      variant="secondary"
                      full
                      flat
                    />
                    {STARTER_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        title={getStarterPromptLabel(t, prompt)}
                        onPress={() => handleStarterPrompt(prompt)}
                        variant="secondary"
                        full
                        flat
                      />
                    ))}
                  </View>
                </View>
              }
              contentContainerStyle={styles.messageListContent}
              style={styles.messageList}
              keyboardShouldPersistTaps="handled"
            />
            {isSending ? (
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={t('aiAssistant.screen.workingAccessibility')}
                accessibilityState={{ busy: true }}
                style={styles.assistantWorking}>
                <ActivityIndicator color={colors.accent} />
                <Txt variant="navigation" tone="secondary" style={styles.assistantWorkingText}>
                  {t('aiAssistant.screen.working')}
                </Txt>
              </View>
            ) : null}
            {error ? (
              <View style={styles.assistantError}>
                <Txt variant="navigation" tone="danger">
                  {error}
                </Txt>
                {failedMessage?.threadId === activeThreadId && failedMessage.retryable ? (
                  <Button
                    accessibilityLabel={t('aiAssistant.screen.retry')}
                    disabled={isSending}
                    loading={isSending}
                    onPress={() => void retryFailedMessage()}
                    title={t('aiAssistant.screen.retry')}
                    variant="secondary"
                    size="sm"
                    full
                    flat
                  />
                ) : null}
              </View>
            ) : null}
            {creditStatus?.warningReached ? (
              <Txt variant="navigation" tone="secondary">
                {t('aiAssistant.credit.warning')}
              </Txt>
            ) : null}
            {creditStatus?.blocked ? (
              <Txt variant="navigation" tone="danger">
                {t('aiAssistant.credit.blocked')}
              </Txt>
            ) : null}
            <View style={styles.composer}>
              {pageContext ? (
                <View style={styles.contextRow}>
                  <Txt variant="caption" tone="secondary" style={styles.contextLabel}>
                    {pageContextLabel(t, pageContext)}
                  </Txt>
                  <IconButton
                    icon="x"
                    accessibilityLabel={t('aiAssistant.screen.removeContext')}
                    onPress={() => setPageContext(null)}
                    size={32}
                    iconSize={16}
                  />
                </View>
              ) : null}
              {attachments.length > 0 ? (
                <View style={styles.attachmentRow}>
                  {attachments.map((attachment, index) => (
                    <View key={`${attachment.uri}-${String(index)}`} style={styles.contextRow}>
                      <Txt
                        variant="caption"
                        tone="secondary"
                        numberOfLines={1}
                        style={styles.attachmentName}>
                        {attachment.name}
                      </Txt>
                      <IconButton
                        icon="x"
                        accessibilityLabel={t('aiAssistant.screen.removeAttachment', {
                          name: attachment.name,
                        })}
                        onPress={() =>
                          setAttachments((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        size={32}
                        iconSize={16}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.composerRow}>
                <IconButton
                  icon="paperclip"
                  accessibilityLabel={t('aiAssistant.attachments.pickerTitle')}
                  onPress={openAttachmentPicker}
                  disabled={attachments.length >= 5 || isSending}
                />
                <View style={styles.composerField}>
                  <TextField
                    value={message}
                    onChangeText={setMessage}
                    editable={!isSending && !creditStatus?.blocked}
                    size="large"
                    multiline
                    placeholder={t('aiAssistant.screen.placeholder')}
                    accessibilityLabel={t('aiAssistant.screen.messageInput')}
                    style={styles.composerInput}
                    onSubmitEditing={() => void handleSend()}
                  />
                </View>
                <IconButton
                  icon="send"
                  accessibilityLabel={t('aiAssistant.screen.sendMessage')}
                  disabled={
                    (!message.trim() && attachments.length === 0) ||
                    isSending ||
                    creditStatus?.blocked ||
                    expiringFlowStage === 'checking'
                  }
                  onPress={() => void handleSend()}
                  color={colors.onAccent}
                  bg={colors.accent}
                  size={56}
                  iconSize={22}
                />
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </HubScreen>
  );
}
