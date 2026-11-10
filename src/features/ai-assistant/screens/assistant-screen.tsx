import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { pollHouseholdUntilEntitlementActive } from '@/features/premium/household-entitlement-sync';
import { usePremium } from '@/features/premium/premium-provider';
import { syncRevenueCatAiEntitlement } from '@/features/premium/revenuecat-entitlement-sync';
import { useRecipeCoverUrl } from '@/features/recipes/data/household-recipe-images';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { hasAIEntitlement, restorePurchases } from '@/lib/backend/revenuecat';
import { getDatabase } from '@/lib/db/local-client';
import { UNIT_OPTIONS } from '@/lib/units';
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
  type AssistantThread,
  type AssistantToolName,
  createLocalId,
  DEFAULT_AI_MODEL,
} from '../types';

const STARTER_PROMPTS = [
  'Was kann ich heute kochen?',
  'Was sollten wir bald verbrauchen?',
  'Plane unsere Woche',
] as const;

type AssistantToolIcon =
  | 'search'
  | 'archive'
  | 'shopping-cart'
  | 'calendar'
  | 'shuffle'
  | 'plus-circle';

const ASSISTANT_TOOL_TRACE = {
  search_recipes: { label: 'Rezepte durchsucht', icon: 'search' },
  get_inventory: { label: 'Vorrat geprüft', icon: 'archive' },
  get_shopping_list: { label: 'Einkaufsliste geprüft', icon: 'shopping-cart' },
  propose_meal_plan: { label: 'Wochenvorschlag erstellt', icon: 'calendar' },
  suggest_ingredient_swap: { label: 'Zutat geprüft', icon: 'shuffle' },
  propose_shopping_list_item: { label: 'Einkaufsartikel vorgeschlagen', icon: 'plus-circle' },
  propose_shopping_list_items: { label: 'Einkaufsartikel vorgeschlagen', icon: 'plus-circle' },
} satisfies Record<AssistantToolName, { label: string; icon: AssistantToolIcon }>;

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

function pageContextLabel(context: AssistantPageContext): string {
  return context.kind === 'recipe'
    ? 'Rezept als Seitenkontext'
    : `Woche ab ${context.weekStartDate}`;
}

function isRetryableAssistantError(error: unknown): boolean {
  return error instanceof Error && 'retryable' in error && error.retryable === true;
}

function AssistantProposalMealRow({ meal }: { meal: MealPlanProposalItem }) {
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
  const day = new Date(`${meal.date}T12:00:00`).toLocaleDateString('de-DE', {
    weekday: 'short',
  });
  const mealSlot =
    meal.mealSlot === 'breakfast'
      ? 'Frühstück'
      : meal.mealSlot === 'lunch'
        ? 'Mittagessen'
        : 'Abendessen';

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${meal.recipeTitle}, ${day}, ${String(meal.portions)} Portionen`}
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
          {day} · {mealSlot} · {String(meal.portions)} Portionen
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
  proposal: Extract<AssistantProposal, { kind: 'shopping_list_item_proposal.v1' }>,
): string {
  const unit =
    UNIT_OPTIONS.find((option) => option.value === proposal.unit)?.label ?? proposal.unit;
  const pluralUnit =
    proposal.quantity === 1
      ? unit
      : unit === 'Packung'
        ? 'Packungen'
        : unit === 'Portion'
          ? 'Portionen'
          : unit;
  return `${String(proposal.quantity)} ${pluralUnit}`;
}

function formatShoppingProposalItem(
  item: Extract<AssistantProposal, { kind: 'shopping_list_proposal.v1' }>['items'][number],
): string {
  const unit = UNIT_OPTIONS.find((option) => option.value === item.unit)?.label ?? item.unit;
  return `${String(item.quantity)} ${item.quantity === 1 ? unit : unit === 'Packung' ? 'Packungen' : unit} · ${item.name}`;
}

export function AssistantScreen() {
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
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [failedMessage, setFailedMessage] = useState<FailedAssistantMessage | null>(null);
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null);
  const applyingProposalRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

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
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Der Assistant konnte nicht geladen werden.',
          );
        }
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });

    return () => {
      current = false;
    };
  }, [userId]);

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
      title: 'Neues Gespräch',
      model: DEFAULT_AI_MODEL,
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setActiveThreadId(nextThread.id);
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
          'Wiederherstellen fehlgeschlagen',
          result.error instanceof Error
            ? result.error.message
            : 'Deine Käufe konnten nicht wiederhergestellt werden.',
        );
        return;
      }

      await refreshPremium();
      if (!hasAIEntitlement(result.customerInfo)) {
        Alert.alert(
          'Kein aktives KI-Abo gefunden',
          'Mit deiner Apple-ID wurde kein aktives fam-KI-Abo gefunden.',
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
          'Haushaltsfreigabe noch nicht aktiv',
          'Dein KI-Abo wurde gefunden, aber die Freigabe für den Haushalt ist noch nicht aktiv. Du kannst es jetzt erneut versuchen.',
          [
            { text: 'Später', style: 'cancel' },
            { text: 'Erneut versuchen', onPress: () => void handleRestoreAiPurchases() },
          ],
        );
        return;
      }

      Alert.alert('Erfolgreich', 'Dein KI-Abo wurde wiederhergestellt.');
    } catch (restoreError) {
      Alert.alert(
        'Wiederherstellen fehlgeschlagen',
        restoreError instanceof Error
          ? restoreError.message
          : 'Deine Käufe konnten nicht wiederhergestellt werden.',
      );
    } finally {
      setIsRestoringPurchases(false);
    }
  }

  async function pickAssistantImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Erlaube den Zugriff auf Fotos, um einen Anhang auszuwählen.');
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
          name: asset.fileName ?? `Bild ${String(index + 1)}`,
          mimeType,
        },
      ];
    });
    if (selected.length === 0) {
      setError('Bitte wähle JPEG-, PNG- oder WebP-Bilder aus.');
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
    if (attachments.length >= 5) {
      setError('Füge höchstens fünf Anhänge hinzu.');
      return;
    }
    Alert.alert('Anhang hinzufügen', 'Wähle ein Bild oder PDF aus.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Bild auswählen', onPress: () => void pickAssistantImages() },
      { text: 'PDF auswählen', onPress: () => void pickAssistantPdf() },
    ]);
  }
  async function handleSend() {
    const text = message.trim();
    if (
      !userId ||
      !activeHouseholdId ||
      !hasAI ||
      (!text && attachments.length === 0) ||
      isSending
    ) {
      return;
    }
    if (failedMessage?.threadId === activeThreadId && failedMessage.text === text) {
      await retryFailedMessage();
      return;
    }

    setIsSending(true);
    setError(null);
    setFailedMessage(null);
    let requestThreadId: string | null = null;
    let encodedAttachments: AssistantAttachment[] = [];
    try {
      encodedAttachments = await encodeAssistantAttachments(attachments);
      const timestamp = new Date().toISOString();
      const currentThread: AssistantThread = activeThread ?? {
        id: createLocalId('chat'),
        title: text ? text.slice(0, 54) : 'Anhang',
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
              : 'Anhang'
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
      setError(
        sendError instanceof Error ? sendError.message : 'Die Antwort konnte nicht geladen werden.',
      );
      if (requestThreadId) {
        const retryable = isRetryableAssistantError(sendError);
        setFailedMessage({
          threadId: requestThreadId,
          text,
          ...(encodedAttachments.length > 0 ? { attachments: encodedAttachments } : {}),
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
      setError('Die Nachricht konnte nicht erneut geladen werden. Bitte sende sie noch einmal.');
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
      setError(
        retryError instanceof Error
          ? retryError.message
          : 'Die Antwort konnte nicht geladen werden. Bitte versuche es erneut.',
      );
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
        'Zum Wochenplan hinzugefügt',
        result.addedCount === 0
          ? 'Diese Mahlzeiten stehen bereits im Wochenplan.'
          : `${String(result.addedCount)} Mahlzeiten wurden lokal vorgemerkt.`,
      );
    } catch (applyError: unknown) {
      const message =
        applyError instanceof ApplyMealPlanProposalError
          ? applyError.code === 'food_rules_changed'
            ? 'Deine Ernährungsregeln haben sich geändert. Erstelle bitte einen neuen Vorschlag.'
            : applyError.code === 'food_rule_coverage_changed' ||
                applyError.code === 'recipe_evidence_changed'
              ? 'Die geprüften Zutaten-Zuordnungen haben sich geändert. Erstelle bitte einen neuen Vorschlag.'
              : applyError.code === 'recipe_changed'
                ? 'Ein Rezept ist nicht mehr aktuell verfügbar. Erstelle bitte einen neuen Vorschlag.'
                : applyError.code === 'meal_slot_conflict'
                  ? 'Mindestens ein Platz im Wochenplan ist inzwischen belegt. Prüfe den Plan und erstelle bei Bedarf einen neuen Vorschlag.'
                  : 'Der Vorschlag ist unvollständig oder veraltet. Erstelle bitte einen neuen Vorschlag.'
          : 'Der Wochenplan konnte nicht aktualisiert werden. Es wurde nichts übernommen.';
      Alert.alert('Vorschlag nicht übernommen', message);
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
      Alert.alert('Einkaufsliste aktualisiert', `${proposal.name} wurde lokal vorgemerkt.`);
    } catch {
      if (itemWasAdded) {
        Alert.alert(
          'Artikel vorgemerkt',
          'Der Artikel wurde lokal vorgemerkt, aber der Gesprächsstatus konnte nicht gespeichert werden. Prüfe die Einkaufsliste, bevor du den Vorschlag erneut übernimmst.',
        );
      } else {
        Alert.alert(
          'Artikel nicht übernommen',
          'Der Artikel konnte nicht vorgemerkt werden. Bitte versuche es erneut.',
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
        'Artikel nicht übernommen',
        'Die Artikel konnten nicht vorgemerkt werden. Bitte versuche es erneut.',
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
      ? 'Dieser Vorschlag war bereits in der Einkaufsliste vorgemerkt.'
      : `${String(result.addedCount)} Artikel wurden lokal vorgemerkt.`;
    Alert.alert(
      'Einkaufsliste aktualisiert',
      historySaved
        ? resultMessage
        : `${resultMessage} Der Gesprächsstatus konnte nicht gespeichert werden. Ein erneutes Übernehmen fügt nichts doppelt hinzu.`,
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
        'Rezept aktualisiert',
        result.changed
          ? 'Der Zutatenwechsel wurde dauerhaft als Rezept-Alternative gespeichert.'
          : 'Dieser Zutatenwechsel ist bereits am Rezept gespeichert.',
      );
    } catch (applyError: unknown) {
      const message =
        applyError instanceof ApplyIngredientSwapProposalError
          ? applyError.code === 'food_rules_changed'
            ? 'Deine Ernährungsregeln haben sich geändert. Erstelle bitte einen neuen Vorschlag.'
            : applyError.code === 'food_rule_coverage_changed'
              ? 'Die geprüfte Zutaten-Zuordnung hat sich geändert. Erstelle bitte einen neuen Vorschlag.'
              : applyError.code === 'recipe_changed' ||
                  applyError.code === 'recipe_evidence_changed'
                ? 'Das Rezept wurde geändert. Erstelle bitte einen neuen Vorschlag.'
                : 'Der Zutatenwechsel ist unvollständig oder veraltet.'
          : 'Der Zutatenwechsel konnte nicht gespeichert werden. Es wurde nichts übernommen.';
      Alert.alert('Vorschlag nicht übernommen', message);
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
            Vorschlag für {String(proposal.meals.length)} Mahlzeiten
          </Txt>
          {proposal.meals.map((meal) => (
            <AssistantProposalMealRow key={`${meal.date}-${meal.mealSlot}`} meal={meal} />
          ))}
          <Pill
            tone="pantry"
            selected={proposal.foodRulesUpdatedAt !== null}
            label={
              proposal.foodRulesUpdatedAt !== null
                ? 'Hinterlegte Regeln abgeglichen'
                : 'Keine Regeln übermittelt'
            }
          />
          <Txt variant="caption" tone="secondary">
            {proposal.safetyNote}
          </Txt>
          <View style={styles.proposalActions}>
            <Button
              accessibilityLabel="Vorschlag prüfen"
              disabled={applyingProposalId !== null}
              onPress={() => {
                const meals = proposal.meals
                  .map(
                    (meal) =>
                      `${meal.date} · ${meal.recipeTitle} · ${String(meal.portions)} Portionen`,
                  )
                  .join('\n');
                Alert.alert('Vorschlag prüfen', `${meals}\n\n${proposal.safetyNote}`, [
                  { text: 'Zurück', style: 'cancel' },
                  {
                    text: 'In Wochenplan übernehmen',
                    onPress: () => void applyMealPlanProposal(proposal, key),
                  },
                ]);
              }}
              variant="secondary"
              size="sm"
              flat
              title="Vorschlag prüfen"
              style={styles.proposalAction}
            />
            <Button
              accessibilityLabel="In Wochenplan übernehmen"
              disabled={applyingProposalId !== null}
              onPress={() => void applyMealPlanProposal(proposal, key)}
              variant="primary"
              size="sm"
              loading={applyingProposalId === key}
              title="Übernehmen"
              style={styles.proposalAction}
            />
          </View>
        </Card>
      );
    }

    if (proposal.kind === 'shopping_list_item_proposal.v1') {
      const isApplied = message.appliedProposalIndexes?.includes(proposalIndex) ?? false;
      const quantityLabel = formatShoppingItemQuantity(proposal);
      const warning =
        proposal.foodRuleStatus === 'unknown'
          ? 'Der Freitextartikel ist keiner geprüften Lebensmittelzuordnung zugeordnet. Bitte prüfe Produktetikett und persönliche Regeln.'
          : 'Für diesen Haushalt sind keine persönlichen Lebensmittelregeln hinterlegt.';

      return (
        <Card key={key} style={styles.proposalCard}>
          <Txt variant="body" weight="700">
            Zur Einkaufsliste
          </Txt>
          <Txt variant="body">
            {quantityLabel} · {proposal.name}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {warning}
          </Txt>
          <Button
            accessibilityLabel={`Einkaufsartikel übernehmen: ${proposal.name}`}
            disabled={isApplied || applyingProposalId !== null}
            onPress={() =>
              Alert.alert(
                'Artikel übernehmen?',
                `${quantityLabel} · ${proposal.name}\n\n${warning}`,
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'Übernehmen',
                    onPress: () =>
                      void applyShoppingItemProposal(proposal, message.id, proposalIndex, key),
                  },
                ],
              )
            }
            variant="primary"
            size="sm"
            loading={applyingProposalId === key}
            title={isApplied ? 'Hinzugefügt' : 'Übernehmen'}
            style={styles.proposalAction}
          />
        </Card>
      );
    }

    if (proposal.kind === 'shopping_list_proposal.v1') {
      const isApplied = message.appliedProposalIndexes?.includes(proposalIndex) ?? false;
      const warning = proposal.items.some((item) => item.foodRuleStatus === 'unknown')
        ? 'Mindestens ein Freitextartikel ist keiner geprüften Lebensmittelzuordnung zugeordnet. Bitte prüfe Produktetikett und persönliche Regeln.'
        : 'Für diesen Haushalt sind keine persönlichen Lebensmittelregeln hinterlegt.';
      return (
        <Card key={key} style={styles.proposalCard}>
          <Txt variant="body" weight="700">
            Zur Einkaufsliste
          </Txt>
          {proposal.items.map((item) => (
            <Txt key={`${item.name}-${item.unit}`} variant="body">
              {formatShoppingProposalItem(item)}
            </Txt>
          ))}
          <Txt variant="caption" tone="secondary">
            {warning}
          </Txt>
          <Button
            accessibilityLabel="Einkaufsartikel übernehmen"
            disabled={isApplied || applyingProposalId !== null}
            onPress={() =>
              Alert.alert('Artikel übernehmen?', `${proposal.summary}\n\n${warning}`, [
                { text: 'Abbrechen', style: 'cancel' },
                {
                  text: 'Übernehmen',
                  onPress: () =>
                    void applyShoppingListProposal(proposal, message.id, proposalIndex, key),
                },
              ])
            }
            variant="primary"
            size="sm"
            loading={applyingProposalId === key}
            title={isApplied ? 'Hinzugefügt' : 'Übernehmen'}
            style={styles.proposalAction}
          />
        </Card>
      );
    }

    return (
      <Card key={key} style={styles.proposalCard}>
        <Txt variant="body" weight="700">
          Zutat angepasst
        </Txt>
        <Txt variant="body">
          {proposal.recipeTitle}: {proposal.ingredientName} → {proposal.replacement}
        </Txt>
        <Txt variant="body" tone="secondary">
          {proposal.rationale}
        </Txt>
        <Pill
          tone="pantry"
          selected={proposal.foodRulesUpdatedAt !== null}
          label={
            proposal.foodRulesUpdatedAt !== null
              ? 'Hinterlegte Regeln abgeglichen'
              : 'Keine Regeln übermittelt'
          }
        />
        <Txt variant="caption" tone="secondary">
          {proposal.safetyNote}
        </Txt>
        <View style={styles.proposalActions}>
          <Button
            title="Für dieses Mal"
            accessibilityLabel="Zutat nur für diesen Kochvorgang ersetzen"
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
            title="Speichern"
            accessibilityLabel="Zutatenwechsel dauerhaft im Rezept speichern"
            disabled={applyingProposalId !== null}
            onPress={() =>
              Alert.alert(
                'Zutatenwechsel speichern?',
                `${proposal.ingredientName} wird im Rezept dauerhaft durch ${proposal.replacement} ergänzt.`,
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'Speichern',
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
          title="Rezept ansehen"
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
      setFailedMessage(null);
      setError(null);
    }
  }

  function confirmDeleteThread(thread: AssistantThread) {
    Alert.alert(
      'Gespräch löschen?',
      'Der lokal gespeicherte Verlauf wird aus diesem Account entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => void handleDeleteThread(thread.id),
        },
      ],
    );
  }

  const hasReadyContext = Boolean(userId && activeHouseholdId);

  return (
    <HubScreen
      header={{
        title: 'fam',
        titleVariant: 'brand',
        align: 'center',
        leading: <BackButton label="Zurück" href="/(app)" variant="header" />,
        trailing: hasAI ? (
          <View style={styles.headerActions}>
            <IconButton
              icon="edit-3"
              accessibilityLabel="Neuen Chat starten"
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
                  isHistoryOpen ? 'Gesprächsverlauf schließen' : 'Gesprächsverlauf öffnen'
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
            <Txt variant="body">Bitte melde dich an, um den Assistant zu verwenden.</Txt>
          </View>
        ) : !hasAI ? (
          <View style={styles.centered}>
            <Txt variant="title" weight="700">
              AI-Abo erforderlich
            </Txt>
            <Txt variant="body" center>
              Der Assistant nutzt das AI-Abo des aktiven Haushalts und dessen monatliches
              Credit-Limit.
            </Txt>
            <Button
              title="AI ansehen"
              onPress={() => router.push('/settings/plus-and-ai?tier=ai')}
              full
            />
            <Button
              title={
                isRestoringPurchases ? 'Käufe werden wiederhergestellt…' : 'Käufe wiederherstellen'
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
              Wähle zuerst einen aktiven Haushalt.
            </Txt>
          </View>
        ) : (
          <>
            {isHistoryOpen && threads.length > 0 ? (
              <Card style={styles.threadHistory}>
                <View style={styles.threadHistoryHeader}>
                  <Txt variant="label" weight="700">
                    Gesprächsverlauf
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
                          setFailedMessage(null);
                          setError(null);
                          setIsHistoryOpen(false);
                        }}
                        onLongPress={() => confirmDeleteThread(thread)}
                        style={styles.selectionButton}>
                        <Txt variant="navigation" numberOfLines={1}>
                          {thread.title || 'Gespräch'}
                        </Txt>
                      </Press>
                      <IconButton
                        icon="trash-2"
                        accessibilityLabel={`Gespräch ${thread.title || 'Gespräch'} löschen`}
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
                  {creditStatus.creditsRemaining} Credits übrig
                </Txt>
              </View>
            ) : null}
            <FlashList
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
                            {attachment.mimeType === 'application/pdf' ? 'PDF' : 'Bild'} ·{' '}
                            {attachment.filename}
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
                            label={ASSISTANT_TOOL_TRACE[tool].label}
                            icon={ASSISTANT_TOOL_TRACE[tool].icon}
                            tone="grocery"
                            solid
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
                            onPress={() => setMessage(suggestion)}
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
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Txt variant="heading" weight="700" center>
                    Was möchtest du heute kochen?
                  </Txt>
                  <View style={styles.starterPrompts}>
                    {STARTER_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        title={prompt}
                        onPress={() => setMessage(prompt)}
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
            {error ? (
              <View style={styles.assistantError}>
                <Txt variant="navigation" tone="danger">
                  {error}
                </Txt>
                {failedMessage?.threadId === activeThreadId && failedMessage.retryable ? (
                  <Button
                    accessibilityLabel="Erneut versuchen"
                    disabled={isSending}
                    loading={isSending}
                    onPress={() => void retryFailedMessage()}
                    title="Erneut versuchen"
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
                Du hast den Großteil deiner Monats-Credits verbraucht.
              </Txt>
            ) : null}
            {creditStatus?.blocked ? (
              <Txt variant="navigation" tone="danger">
                Das monatliche Credit-Limit ist erreicht.
              </Txt>
            ) : null}
            <View style={styles.composer}>
              {pageContext ? (
                <View style={styles.contextRow}>
                  <Txt variant="caption" tone="secondary" style={styles.contextLabel}>
                    {pageContextLabel(pageContext)}
                  </Txt>
                  <IconButton
                    icon="x"
                    accessibilityLabel="Seitenkontext entfernen"
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
                        accessibilityLabel={`${attachment.name} entfernen`}
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
                  accessibilityLabel="Anhang hinzufügen"
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
                    placeholder="Frag fam etwas …"
                    accessibilityLabel="Nachricht an den Assistant"
                    style={styles.composerInput}
                    onSubmitEditing={() => void handleSend()}
                  />
                </View>
                <IconButton
                  icon="send"
                  accessibilityLabel="Nachricht senden"
                  disabled={
                    (!message.trim() && attachments.length === 0) ||
                    isSending ||
                    creditStatus?.blocked
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
