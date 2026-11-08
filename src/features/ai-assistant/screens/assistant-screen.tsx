import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { controlSizes, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Card, IconButton, Pill, Press, Surface, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  useAddEntryMutation,
  useEnsureMealPlanMutation,
} from '@/features/meal-planner/use-meal-plans';
import { getWeekStart } from '@/features/meal-planner/week';
import { pollHouseholdUntilEntitlementActive } from '@/features/premium/household-entitlement-sync';
import { usePremium } from '@/features/premium/premium-provider';
import { syncRevenueCatAiEntitlement } from '@/features/premium/revenuecat-entitlement-sync';
import { useRecipeCoverUrl } from '@/features/recipes/data/household-recipe-images';
import { hasAIEntitlement, restorePurchases } from '@/lib/backend/revenuecat';
import { getDatabase } from '@/lib/db/local-client';
import {
  getAiCreditStatus,
  getOwnFoodRulesUpdatedAt,
  sendAssistantMessage,
} from '../data/assistant-api';
import {
  loadAiConsent,
  loadAssistantThreads,
  saveAiConsent,
  saveAssistantThreads,
} from '../data/assistant-storage';
import {
  AI_CONSENT_VERSION,
  type AiConsentRecord,
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
  consentPanel: {
    gap: theme.space.md,
    paddingVertical: theme.space.lg,
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

function toAiConsentRecord(): AiConsentRecord {
  return {
    version: AI_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
}

export function AssistantScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();
  const { hasAI, refresh: refreshPremium } = usePremium();
  const ensureMealPlan = useEnsureMealPlanMutation();
  const addMealPlanEntry = useAddEntryMutation();
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [consent, setConsent] = useState<AiConsentRecord | null>(null);
  const [message, setMessage] = useState('');
  const [creditStatus, setCreditStatus] = useState<Awaited<
    ReturnType<typeof getAiCreditStatus>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null);
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
    void Promise.all([loadAssistantThreads(userId), loadAiConsent(userId)])
      .then(([storedThreads, storedConsent]) => {
        if (!current) return;
        setThreads(storedThreads);
        setActiveThreadId(storedThreads[0]?.id ?? null);
        setConsent(storedConsent);
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
    await persistThreads(upsertThread(threads, nextThread));
    setError(null);
  }

  async function acceptConsent() {
    if (!userId) return;
    const nextConsent = toAiConsentRecord();
    await saveAiConsent(userId, nextConsent);
    setConsent(nextConsent);
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
    if (!userId || !activeHouseholdId || !consent || !hasAI || !text || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);
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
    setActiveThreadId(pendingThread.id);

    try {
      await persistThreads(pendingThreads);
      setMessage('');
      const reply = await sendAssistantMessage({
        householdId: activeHouseholdId,
        model: DEFAULT_AI_MODEL,
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
        messages: [...pendingThread.messages, assistantMessage].slice(-60),
        updatedAt: assistantMessage.createdAt,
      };
      await persistThreads(upsertThread(pendingThreads, completedThread));
      const nextStatus = await getAiCreditStatus(activeHouseholdId);
      setCreditStatus(nextStatus);
    } catch (sendError: unknown) {
      setError(
        sendError instanceof Error ? sendError.message : 'Die Antwort konnte nicht geladen werden.',
      );
    } finally {
      setIsSending(false);
    }
  }

  async function applyMealPlanProposal(
    proposal: Extract<AssistantProposal, { kind: 'meal_plan_proposal.v1' }>,
    key: string,
  ) {
    if (!userId || !activeHouseholdId || applyingProposalId) return;
    setApplyingProposalId(key);
    let added = 0;
    try {
      const currentFoodRulesUpdatedAt = await getOwnFoodRulesUpdatedAt();
      if (currentFoodRulesUpdatedAt !== proposal.foodRulesUpdatedAt) {
        Alert.alert(
          'Ernährungsregeln wurden geändert',
          'Erstelle bitte einen neuen Vorschlag, damit deine aktuellen Regeln berücksichtigt werden.',
        );
        return;
      }
      const db = await getDatabase();
      for (const meal of proposal.meals) {
        const currentRecipe = await db.getFirstAsync<{ household_id: string; updated_at: string }>(
          `select household_id, updated_at from recipes
           where id = ? and deleted_at is null limit 1`,
          [meal.recipeId],
        );
        if (
          !currentRecipe ||
          currentRecipe.household_id !== activeHouseholdId ||
          Date.parse(currentRecipe.updated_at) !== Date.parse(meal.recipeUpdatedAt)
        ) {
          Alert.alert(
            'Rezept wurde geändert',
            'Erstelle bitte einen neuen Vorschlag, damit die aktuelle Zutatenliste geprüft wird.',
          );
          return;
        }
        const plan = await ensureMealPlan.mutateAsync({
          household_id: activeHouseholdId,
          week_start_date: getWeekStart(meal.date),
          created_by: userId,
        });
        await addMealPlanEntry.mutateAsync({
          meal_plan_id: plan.id,
          household_id: activeHouseholdId,
          recipe_id: meal.recipeId,
          entry_date: meal.date,
          meal_slot: meal.mealSlot,
          servings_mode: 'portions',
          portions: meal.portions,
          people_count: null,
          created_by: userId,
        });
        added += 1;
      }
      Alert.alert(
        'Zum Wochenplan hinzugefügt',
        `${String(added)} Mahlzeiten wurden lokal vorgemerkt.`,
      );
    } catch {
      Alert.alert(
        'Vorschlag teilweise übernommen',
        added > 0
          ? `${String(added)} von ${String(proposal.meals.length)} Mahlzeiten wurden hinzugefügt. Prüfe den Wochenplan.`
          : 'Der Wochenplan konnte nicht aktualisiert werden.',
      );
    } finally {
      setApplyingProposalId(null);
    }
  }

  function renderProposal(proposal: AssistantProposal, key: string) {
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
    if (activeThreadId === threadId) setActiveThreadId(nextThreads[0]?.id ?? null);
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
          consent && hasAI && threads.length > 0 ? (
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
        ) : !consent ? (
          <View style={styles.consentPanel}>
            <Txt variant="title" weight="700">
              Datenverarbeitung freigeben
            </Txt>
            <Txt variant="body">
              Deine Nachrichten sowie relevante Rezepte, Vorräte und hinterlegte Allergien,
              Unverträglichkeiten und persönliche Lebensmittelregeln werden zur Antwort an einen
              externen AI-Anbieter gesendet. fam gleicht Vorschläge mit diesen Regeln ab.
              Verpackungsangaben und Kreuzkontamination kann fam nicht prüfen. Gespräche bleiben
              verschlüsselt auf diesem Gerät in deinem Account-Speicher.
            </Txt>
            <Button title="Zustimmen und fortfahren" onPress={() => void acceptConsent()} full />
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
                              }[tool]
                            }
                          />
                        ))}
                        <Pill label="Hinterlegte Regeln abgeglichen" tone="pantry" selected />
                      </View>
                    ) : null}
                    {item.role === 'assistant'
                      ? item.proposals?.map((proposal, index) =>
                          renderProposal(proposal, `${item.id}-${String(index)}`),
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
              <Txt variant="navigation" tone="danger">
                {error}
              </Txt>
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
