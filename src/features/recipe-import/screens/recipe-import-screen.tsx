import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { getAiCreditStatus } from '@/features/ai-assistant/data/assistant-api';
import { loadAiConsent, saveAiConsent } from '@/features/ai-assistant/data/assistant-storage';
import { AI_CONSENT_VERSION, createLocalId } from '@/features/ai-assistant/types';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { usePremium } from '@/features/premium/premium-provider';
import { importRecipeSource } from '../data/recipe-import-api';
import {
  findSavedRecipeImportSource,
  loadRecipeImportDrafts,
  normalizeRecipeSourceUrl,
  removeRecipeImportDraft,
  saveRecipeImportDraft,
} from '../data/recipe-import-storage';
import type { RecipeImportDraftRecord, RecipeImportSourceType } from '../types';

type QueueItem = {
  id: string;
  label: string;
  status: 'processing' | 'imported' | 'duplicate' | 'failed';
  draftId?: string;
  existingRecipeId?: string;
  error?: string;
  retryInput?: {
    sourceType: RecipeImportSourceType;
    sourceText?: string;
    sourceUrl?: string;
    media?: SelectedMedia[];
  };
};

type SelectedMedia = {
  uri: string;
  name: string;
  mimeType: string;
};

const SOURCE_OPTIONS: Array<{ value: RecipeImportSourceType; label: string }> = [
  { value: 'url', label: 'Link' },
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Foto' },
  { value: 'pdf', label: 'PDF' },
  { value: 'video', label: 'Video' },
];

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xxl,
  },
  content: {
    gap: theme.space.md,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xl,
  },
  sourceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  sourceOption: {
    minHeight: rs(44),
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundElement,
  },
  sourceOptionSelected: {
    backgroundColor: theme.accent,
  },
  input: {
    minHeight: rs(116),
    maxHeight: rs(240),
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.md,
    color: theme.text,
    backgroundColor: theme.backgroundElement,
    textAlignVertical: 'top',
  },
  shortInput: {
    minHeight: rs(54),
    maxHeight: rs(100),
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  actionButton: {
    minHeight: rs(48),
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundElement,
  },
  primaryButton: {
    minHeight: rs(50),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.accent,
  },
  disabled: {
    opacity: 0.5,
  },
  mediaList: {
    gap: theme.space.xs,
  },
  queueBlock: {
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
  },
  queueRow: {
    gap: theme.space.xs,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  draftRow: {
    gap: theme.space.xs,
    paddingVertical: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.space.md,
    marginTop: theme.space.xs,
  },
  smallButton: {
    minHeight: rs(40),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundElement,
  },
  sectionTitle: {
    marginTop: theme.space.md,
  },
  consentBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.lg,
  },
}));

function splitLinks(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function queueStatusText(item: QueueItem): string {
  switch (item.status) {
    case 'processing':
      return 'Wird ausgewertet';
    case 'imported':
      return 'Entwurf bereit';
    case 'duplicate':
      return 'Quelle wurde schon importiert';
    case 'failed':
      return item.error ?? 'Import fehlgeschlagen';
  }
}

function statusTone(item: QueueItem): 'secondary' | 'danger' {
  return item.status === 'failed' ? 'danger' : 'secondary';
}

export function RecipeImportScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();
  const { hasAI } = usePremium();
  const [drafts, setDrafts] = useState<RecipeImportDraftRecord[]>([]);
  const [consent, setConsent] = useState(false);
  const [sourceType, setSourceType] = useState<RecipeImportSourceType>('url');
  const [sourceValue, setSourceValue] = useState('');
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<Awaited<ReturnType<typeof getAiCreditStatus>> | null>(
    null,
  );

  useEffect(() => {
    if (!activeHouseholdId || !hasAI) {
      setCredits(null);
      return;
    }
    let current = true;
    void getAiCreditStatus(activeHouseholdId)
      .then((status) => {
        if (current) setCredits(status);
      })
      .catch(() => {
        if (current) setCredits(null);
      });
    return () => {
      current = false;
    };
  }, [activeHouseholdId, hasAI]);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    let current = true;
    setIsLoading(true);
    void Promise.all([loadRecipeImportDrafts(userId), loadAiConsent(userId)])
      .then(([storedDrafts, storedConsent]) => {
        if (!current) return;
        setDrafts(storedDrafts);
        setConsent(storedConsent?.version === AI_CONSENT_VERSION);
      })
      .catch((loadError: unknown) => {
        if (current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Importentwürfe konnten nicht geladen werden.',
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

  const updateQueueItem = useCallback((id: string, update: Partial<QueueItem>) => {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }, []);

  async function handleAcceptConsent() {
    if (!userId) return;
    await saveAiConsent(userId, {
      version: AI_CONSENT_VERSION,
      acceptedAt: new Date().toISOString(),
    });
    setConsent(true);
  }

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Erlaube den Zugriff auf Fotos, um Rezeptseiten auszuwählen.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });
    if (result.canceled) return;
    const selected = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName ?? `Rezeptseite ${String(index + 1)}`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    }));
    if (
      selected.some((asset) => !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType))
    ) {
      setError('Bitte wähle JPEG-, PNG- oder WebP-Bilder aus.');
      return;
    }
    setMedia(selected);
    setError(null);
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
      base64: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setMedia([
      {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf',
      },
    ]);
    setError(null);
  }

  async function importOne(
    label: string,
    input: {
      sourceType: RecipeImportSourceType;
      sourceText?: string;
      sourceUrl?: string;
      media?: SelectedMedia[];
    },
  ): Promise<void> {
    if (!userId || !activeHouseholdId) return;
    const queueId = createLocalId('import-queue');
    setQueue((current) => [
      ...current,
      { id: queueId, label, status: 'processing', retryInput: input },
    ]);

    try {
      let savedDuplicate = null;
      if (input.sourceUrl) {
        savedDuplicate = await findSavedRecipeImportSource(userId, input.sourceUrl);
      }
      const draftDuplicate = input.sourceUrl
        ? (await loadRecipeImportDrafts(userId)).find(
            (draft) =>
              draft.sourceUrl &&
              normalizeRecipeSourceUrl(draft.sourceUrl) ===
                normalizeRecipeSourceUrl(input.sourceUrl ?? ''),
          )
        : null;
      if (savedDuplicate || draftDuplicate) {
        updateQueueItem(queueId, {
          status: 'duplicate',
          ...(draftDuplicate ? { draftId: draftDuplicate.id } : {}),
          ...(savedDuplicate ? { existingRecipeId: savedDuplicate.recipeId } : {}),
        });
        return;
      }

      const result = await importRecipeSource({
        householdId: activeHouseholdId,
        sourceType: input.sourceType,
        ...(input.sourceText ? { sourceText: input.sourceText } : {}),
        ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
        ...(input.media ? { media: input.media } : {}),
      });
      const record: RecipeImportDraftRecord = {
        id: createLocalId('recipe-import'),
        sourceType: input.sourceType,
        sourceLabel: label,
        sourceUrl: input.sourceUrl ?? null,
        originalText: input.sourceType === 'text' ? (input.sourceText ?? null) : null,
        mediaUris: input.media?.map((asset) => asset.uri) ?? [],
        method: result.method,
        draft: result.draft,
        createdAt: new Date().toISOString(),
      };
      await saveRecipeImportDraft(userId, record);
      setDrafts((current) =>
        [record, ...current.filter((draft) => draft.id !== record.id)].slice(0, 30),
      );
      updateQueueItem(queueId, {
        status: 'imported',
        draftId: record.id,
      });
    } catch (importError: unknown) {
      updateQueueItem(queueId, {
        status: 'failed',
        error: importError instanceof Error ? importError.message : 'Import fehlgeschlagen.',
      });
    }
  }

  async function handleImport() {
    if (!userId || !activeHouseholdId || !consent || isImporting) return;
    setError(null);
    setIsImporting(true);
    try {
      if (sourceType === 'url') {
        const links = splitLinks(sourceValue);
        if (links.length === 0) throw new Error('Füge mindestens einen Rezeptlink ein.');
        if (links.length > 20) throw new Error('Importiere höchstens 20 Links auf einmal.');
        for (const link of links) {
          await importOne(link, { sourceType: 'url', sourceUrl: link });
        }
      } else if (sourceType === 'text') {
        const text = sourceValue.trim();
        if (!text) throw new Error('Füge zuerst den Rezepttext ein.');
        if (!hasAI) throw new Error('Für den Textimport brauchst du das AI-Abo dieses Haushalts.');
        await importOne('Eingefügter Rezepttext', { sourceType: 'text', sourceText: text });
      } else if (sourceType === 'video') {
        const link = sourceValue.trim();
        if (!link) throw new Error('Füge zuerst einen Videolink ein.');
        if (!hasAI) throw new Error('Für den Videoimport brauchst du das AI-Abo dieses Haushalts.');
        await importOne(link, { sourceType: 'video', sourceUrl: link });
      } else {
        if (media.length === 0) throw new Error('Wähle zuerst ein Foto oder ein PDF aus.');
        if (!hasAI)
          throw new Error('Für den Foto- und PDF-Import brauchst du das AI-Abo dieses Haushalts.');
        await importOne(
          media.length === 1
            ? (media[0]?.name ?? 'Rezeptseite')
            : `${String(media.length)} Rezeptseiten`,
          { sourceType, media },
        );
      }
    } catch (importError: unknown) {
      setError(importError instanceof Error ? importError.message : 'Import fehlgeschlagen.');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDeleteDraft(draftId: string) {
    if (!userId) return;
    await removeRecipeImportDraft(userId, draftId);
    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
  }

  function openDraft(draftId: string) {
    router.push({ pathname: '/recipe/create', params: { importDraftId: draftId } });
  }

  function openQueueItem(item: QueueItem) {
    if (item.draftId) openDraft(item.draftId);
    else if (item.existingRecipeId) {
      router.push({ pathname: '/recipe/[id]', params: { id: item.existingRecipeId } });
    }
  }

  const header = (
    <View style={styles.content}>
      <Txt variant="body" tone="secondary">
        Importiere Links, Text, Fotos, PDFs oder Videos. Jeder Treffer bleibt ein Entwurf, bis du
        ihn im Rezepteditor prüfst und speicherst.
      </Txt>
      <View style={styles.sourceOptions}>
        {SOURCE_OPTIONS.map((option) => (
          <Press
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: sourceType === option.value }}
            onPress={() => {
              setSourceType(option.value);
              setSourceValue('');
              setMedia([]);
              setError(null);
            }}
            style={[
              styles.sourceOption,
              sourceType === option.value ? styles.sourceOptionSelected : undefined,
            ]}>
            <Txt variant="caption" weight="700">
              {option.label}
            </Txt>
          </Press>
        ))}
      </View>
      {sourceType === 'text' || sourceType === 'url' || sourceType === 'video' ? (
        <TextInput
          value={sourceValue}
          onChangeText={setSourceValue}
          maxLength={sourceType === 'text' ? 50_000 : sourceType === 'url' ? 20_000 : 2_048}
          multiline={sourceType !== 'video'}
          placeholder={
            sourceType === 'url'
              ? 'Ein Rezeptlink pro Zeile'
              : sourceType === 'text'
                ? 'Rezepttext hier einfügen'
                : 'Videolink einfügen'
          }
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={
            sourceType === 'url'
              ? 'Rezeptlinks'
              : sourceType === 'text'
                ? 'Rezepttext'
                : 'Videolink'
          }
          style={[styles.input, sourceType === 'video' ? styles.shortInput : undefined]}
          textAlignVertical="top"
        />
      ) : (
        <>
          <View style={styles.actionRow}>
            {sourceType === 'image' ? (
              <Press
                accessibilityRole="button"
                onPress={() => void pickImages()}
                style={styles.actionButton}>
                <Txt variant="body" weight="700">
                  Fotos auswählen
                </Txt>
              </Press>
            ) : null}
            {sourceType === 'pdf' ? (
              <Press
                accessibilityRole="button"
                onPress={() => void pickPdf()}
                style={styles.actionButton}>
                <Txt variant="body" weight="700">
                  PDF auswählen
                </Txt>
              </Press>
            ) : null}
          </View>
          {media.length > 0 ? (
            <View style={styles.mediaList}>
              {media.map((item) => (
                <Txt key={item.uri} variant="caption">
                  {item.name}
                </Txt>
              ))}
            </View>
          ) : null}
          <Txt variant="caption" tone="secondary">
            Bis zu fünf Fotos oder ein PDF mit maximal 5,5 MB.
          </Txt>
        </>
      )}
      {!hasAI ? (
        <Txt variant="caption" tone="secondary">
          {sourceType === 'url'
            ? 'Weblinks mit strukturierten Rezeptdaten sind ohne AI-Abo möglich. Für fehlende Angaben wird das AI-Abo benötigt.'
            : 'Die KI-Auswertung benötigt das AI-Abo des aktiven Haushalts.'}
        </Txt>
      ) : null}
      {hasAI ? (
        <Txt variant="caption" tone="secondary">
          Import mit KI: 3 Credits. Weblinks mit vollständigen strukturierten Rezeptdaten sind
          kostenlos.
          {credits
            ? ' Verbraucht: ' +
              String(credits.creditsUsed) +
              '/' +
              String(credits.creditLimit) +
              ' diesen Monat.'
            : ''}
        </Txt>
      ) : null}
      {error ? (
        <Txt variant="caption" tone="danger">
          {error}
        </Txt>
      ) : null}
      {credits?.blocked ? (
        <Txt variant="caption" tone="danger">
          Das monatliche Credit-Limit ist erreicht. Vollständige strukturierte Weblinks bleiben
          kostenlos.
        </Txt>
      ) : null}
      <Press
        accessibilityRole="button"
        disabled={isImporting}
        onPress={() => void handleImport()}
        style={[styles.primaryButton, isImporting ? styles.disabled : undefined]}>
        {isImporting ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Txt variant="body" weight="700" style={{ color: colors.background }}>
            Import starten
          </Txt>
        )}
      </Press>
      {queue.length > 0 ? (
        <View style={styles.queueBlock}>
          <Txt variant="body" weight="700">
            Importverlauf
          </Txt>
          {queue.map((item) => (
            <View key={item.id} style={styles.queueRow}>
              <Txt variant="caption" numberOfLines={2}>
                {item.label}
              </Txt>
              <Txt variant="caption" tone={statusTone(item)}>
                {queueStatusText(item)}
              </Txt>
              {item.status === 'duplicate' || item.status === 'imported' ? (
                <Press
                  accessibilityRole="button"
                  onPress={() => openQueueItem(item)}
                  style={styles.smallButton}>
                  <Txt variant="caption" weight="700">
                    {item.status === 'duplicate' ? 'Öffnen' : 'Entwurf prüfen'}
                  </Txt>
                </Press>
              ) : null}
              {item.status === 'failed' && item.retryInput ? (
                <Press
                  accessibilityRole="button"
                  disabled={isImporting}
                  onPress={() => {
                    const retryInput = item.retryInput;
                    if (retryInput) void importOne(item.label, retryInput);
                  }}
                  style={styles.smallButton}>
                  <Txt variant="caption" weight="700">
                    Erneut versuchen
                  </Txt>
                </Press>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <Txt variant="title" weight="700" style={styles.sectionTitle}>
        Importentwürfe
      </Txt>
    </View>
  );

  return (
    <HubScreen
      header={{
        title: 'Rezept importieren',
        align: 'center',
        leading: <BackButton label="Zurück" variant="header" onPress={() => router.back()} />,
      }}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        {!userId ? (
          <View style={styles.centered}>
            <Txt variant="body" center>
              Bitte melde dich an, um Rezepte zu importieren.
            </Txt>
          </View>
        ) : isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : !consent ? (
          <View style={styles.consentBlock}>
            <Txt variant="title" weight="700">
              AI-Datenverarbeitung freigeben
            </Txt>
            <Txt variant="body">
              Für Text-, Foto-, PDF- und Videoimporte werden die ausgewählte Quelle und dein
              Rezepttext an einen externen AI-Anbieter gesendet. Weblinks werden zuerst auf
              strukturierte Rezeptdaten geprüft. Importentwürfe bleiben verschlüsselt in deinem
              Account-Speicher auf diesem Gerät.
            </Txt>
            <Press
              accessibilityRole="button"
              onPress={() => void handleAcceptConsent()}
              style={styles.primaryButton}>
              <Txt variant="body" weight="700" style={{ color: colors.background }}>
                Zustimmen und fortfahren
              </Txt>
            </Press>
          </View>
        ) : !activeHouseholdId ? (
          <View style={styles.centered}>
            <Txt variant="body" center>
              Wähle zuerst einen aktiven Haushalt.
            </Txt>
          </View>
        ) : (
          <FlashList
            data={drafts}
            keyExtractor={(draft) => draft.id}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <Txt variant="body" tone="secondary">
                Noch keine Importentwürfe gespeichert.
              </Txt>
            }
            renderItem={({ item }) => (
              <View style={styles.draftRow}>
                <Txt variant="body" weight="700" numberOfLines={2}>
                  {item.draft.title}
                </Txt>
                <Txt variant="caption" tone="secondary" numberOfLines={1}>
                  {item.sourceLabel} ·{' '}
                  {item.method === 'structured' ? 'Webseitendaten' : 'KI-Auswertung'}
                </Txt>
                {item.draft.warnings.length > 0 ||
                item.draft.ingredients.some((ingredient) => ingredient.confidence !== 'high') ? (
                  <Txt variant="caption" tone="secondary">
                    Angaben prüfen
                  </Txt>
                ) : null}
                <View style={styles.rowActions}>
                  <Press
                    accessibilityRole="button"
                    onPress={() => openDraft(item.id)}
                    style={styles.smallButton}>
                    <Txt variant="caption" weight="700">
                      Prüfen
                    </Txt>
                  </Press>
                  <Press
                    accessibilityRole="button"
                    onPress={() => void handleDeleteDraft(item.id)}
                    style={styles.smallButton}>
                    <Txt variant="caption">Entfernen</Txt>
                  </Press>
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
    </HubScreen>
  );
}
