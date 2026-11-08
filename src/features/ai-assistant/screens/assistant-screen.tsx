import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { controlSizes, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Card, IconButton, Pill, Press, Surface, TextField, Txt } from '@/constants/ui';
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
  ApplyMealPlanProposalError,
  applyAssistantMealPlanProposal,
} from '../data/apply-meal-plan-proposal';
import { getAiCreditStatus, sendAssistantMessage } from '../data/assistant-api';
import { loadAssistantThreads, saveAssistantThreads } from '../data/assistant-storage';
import {
  type AssistantMessage,
  type AssistantProposal,
  type AssistantThread,
  createLocalId,
  DEFAULT_AI_MODEL,
} from '../types';

const STARTER_PROMPTS = [
  'Was kann ich heute kochen?',
  'Was sollten wir bald verbrauchen?',
  'Plane unsere Woche',
] as const;

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.md,
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
    gap: theme.space.xs,
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
  retryable: boolean;
};

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

export function AssistantScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();
  const { hasAI, refresh: refreshPremium } = usePremium();
  const addShoppingItem = useAddShoppingItem();
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
          'Kauf erkannt',
          'Dein KI-Abo wurde gefunden. Die Freigabe für den Haushalt wird noch synchronisiert. Bitte versuche es gleich erneut.',
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

  async function handleSend() {
    const text = message.trim();
    if (!userId || !activeHouseholdId || !hasAI || !text || isSending) {
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
    try {
      const timestamp = new Date().toISOString();
      const currentThread: AssistantThread = activeThread ?? {
        id: createLocalId('chat'),
        title: text.slice(0, 54),
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
      };
      const pendingThread: AssistantThread = {
        ...currentThread,
        title: currentThread.messages.length === 0 ? text.slice(0, 54) : currentThread.title,
        model: DEFAULT_AI_MODEL,
        messages: [...currentThread.messages, userMessage].slice(-60),
        updatedAt: timestamp,
      };
      const pendingThreads = upsertThread(threads, pendingThread);
      requestThreadId = pendingThread.id;
      setActiveThreadId(pendingThread.id);
      await persistThreads(pendingThreads);
      setMessage('');
      const reply = await sendAssistantMessage({
        householdId: activeHouseholdId,
        message: text,
        includeHouseholdContext: true,
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
        setFailedMessage({ threadId: requestThreadId, text, retryable });
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
        title: 'fam Assistant',
        subtitle: 'Deine Essensplanung',
        align: 'center',
        leading: <BackButton label="Zurück" variant="header" onPress={() => router.back()} />,
        trailing:
          hasAI && threads.length > 0 ? (
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
            <Button title="AI ansehen" onPress={() => router.push('/settings/plus-and-ai')} full />
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
                  <IconButton
                    icon="edit-3"
                    accessibilityLabel="Neues Gespräch"
                    onPress={() => {
                      setIsHistoryOpen(false);
                      void startNewThread();
                    }}
                    size={40}
                    iconSize={18}
                  />
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
                          <Pill
                            key={`${item.id}-${tool}`}
                            label={
                              {
                                search_recipes: 'Rezepte durchsucht',
                                get_inventory: 'Vorrat geprüft',
                                propose_meal_plan: 'Wochenvorschlag erstellt',
                                suggest_ingredient_swap: 'Zutat geprüft',
                                propose_shopping_list_item: 'Einkaufsartikel vorgeschlagen',
                              }[tool]
                            }
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
              <View style={styles.composerRow}>
                <IconButton
                  icon="plus"
                  accessibilityLabel="Rezept importieren"
                  onPress={() => router.push('/recipe/import')}
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
                  disabled={!message.trim() || isSending || creditStatus?.blocked}
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
