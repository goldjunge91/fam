import { Feather } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Divider, Press, TextField, Txt } from '@/constants/ui';
import { getAiCreditStatus } from '@/features/ai-assistant/data/assistant-api';
import { createLocalId } from '@/features/ai-assistant/types';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { usePremium } from '@/features/premium/premium-provider';
import { extractVideoRecipeFrames } from '../data/extract-video-recipe-frames';
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

type ImportView = 'home' | 'multipleLinks' | 'text' | 'media';
type MediaSourceType = Extract<RecipeImportSourceType, 'image' | 'pdf'>;

const VIDEO_LINK =
  /^\s*(https?:\/\/)?([\w-]+\.)*(tiktok\.com|youtube\.com|youtu\.be|instagram\.com|instagr\.am|facebook\.com|fb\.watch)\b/i;

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xxl,
  },
  content: {
    gap: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xl,
  },
  homeContent: {
    gap: 0,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.lg,
  },
  homeTitle: {
    marginBottom: theme.space.sm,
    textAlign: 'center',
  },
  homeSubtitle: {
    marginBottom: theme.space.xxl,
    paddingHorizontal: theme.space.xs,
    textAlign: 'center',
  },
  formSection: {
    gap: theme.space.sm,
  },
  homeFormSection: {
    marginBottom: theme.space.xl,
  },
  inputLabel: {
    color: theme.text,
  },
  input: {
    minHeight: rs(56),
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderCurve: 'continuous',
    color: theme.text,
    backgroundColor: theme.backgroundElement,
    textAlignVertical: 'top',
  },
  multilineInput: {
    minHeight: rs(152),
    maxHeight: rs(280),
  },
  primaryButton: {
    minHeight: rs(56),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.accent,
  },
  homePrimaryButton: {
    marginBottom: theme.space.xs,
  },
  primaryButtonText: {
    color: theme.onAccent,
  },
  secondaryTextButton: {
    minHeight: rs(48),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
  },
  homeSecondaryLink: {
    marginBottom: theme.space.xl,
  },
  secondaryText: {
    color: theme.accent,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  homeSeparatorRow: {
    marginBottom: theme.space.xl,
  },
  separatorLine: {
    flex: 1,
  },
  sourceCards: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  sourceCard: {
    minHeight: rs(136),
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    padding: theme.space.md,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderCurve: 'continuous',
    backgroundColor: theme.backgroundSoft,
  },
  sourceCardPressed: {
    backgroundColor: theme.backgroundSoft,
  },
  sourceCardText: {
    color: theme.text,
    textAlign: 'center',
  },
  homeSourceCards: {
    marginBottom: theme.space.xl,
  },
  manualEntry: {
    minHeight: rs(52),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    alignSelf: 'flex-start',
    minHeight: rs(40),
  },
  mediaPickerRow: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  mediaPickerButton: {
    minHeight: rs(48),
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundElement,
  },
  videoPickerButton: {
    minHeight: rs(48),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundElement,
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

function linkSourceType(url: string): Extract<RecipeImportSourceType, 'url' | 'video'> {
  return VIDEO_LINK.test(url) ? 'video' : 'url';
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
  const [view, setView] = useState<ImportView>('home');
  const [sourceValue, setSourceValue] = useState('');
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [mediaSourceType, setMediaSourceType] = useState<MediaSourceType | null>(null);
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
    void loadRecipeImportDrafts(userId)
      .then((storedDrafts) => {
        if (!current) return;
        setDrafts(storedDrafts);
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
    setMediaSourceType('image');
    setError(null);
  }

  async function pickVideo() {
    if (!hasAI) {
      setError('Für den Videoimport brauchst du das AI-Abo dieses Haushalts.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Erlaube den Zugriff auf Fotos, um ein gespeichertes Rezeptvideo auszuwählen.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      selectionLimit: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    try {
      setError(null);
      const frames = await extractVideoRecipeFrames(asset.uri);
      setMedia(frames);
      setMediaSourceType('image');
    } catch (videoError: unknown) {
      const message = videoError instanceof Error ? videoError.message : '';
      setError(
        message.includes('Cannot find native module')
          ? 'Die Videoverarbeitung ist in dieser lokalen App-Version noch nicht verfügbar. Der Development Build muss neu erstellt werden.'
          : message || 'Das Video konnte nicht für den Rezeptimport vorbereitet werden.',
      );
    }
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
    setMediaSourceType('pdf');
    setError(null);
  }

  function changeView(nextView: ImportView) {
    setView(nextView);
    setSourceValue('');
    setMedia([]);
    setMediaSourceType(null);
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
    if (!userId || !activeHouseholdId || isImporting) return;
    setError(null);
    setIsImporting(true);
    try {
      if (view === 'home' || view === 'multipleLinks') {
        const links = splitLinks(sourceValue);
        if (links.length === 0) throw new Error('Füge mindestens einen Rezeptlink ein.');
        if (view === 'home' && links.length > 1) {
          throw new Error('Für mehrere Links nutze „Mehrere Links importieren“.');
        }
        if (view === 'multipleLinks' && links.length > 20) {
          throw new Error('Importiere höchstens 20 Links auf einmal.');
        }
        if (links.some((link) => linkSourceType(link) === 'video') && !hasAI) {
          throw new Error('Für den Videoimport brauchst du das AI-Abo dieses Haushalts.');
        }
        for (const link of links) {
          await importOne(link, { sourceType: linkSourceType(link), sourceUrl: link });
        }
      } else if (view === 'text') {
        const text = sourceValue.trim();
        if (!text) throw new Error('Füge zuerst den Rezepttext ein.');
        if (!hasAI) throw new Error('Für den Textimport brauchst du das AI-Abo dieses Haushalts.');
        await importOne('Eingefügter Rezepttext', { sourceType: 'text', sourceText: text });
      } else {
        if (media.length === 0) throw new Error('Wähle zuerst Fotos, ein Video oder ein PDF aus.');
        if (!hasAI)
          throw new Error('Für den Medienimport brauchst du das AI-Abo dieses Haushalts.');
        const sourceType = mediaSourceType ?? 'image';
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

  function openManualRecipe() {
    router.push({ pathname: '/recipe/create' });
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

  const isAiImportView = view === 'text' || view === 'media' || (view === 'multipleLinks' && hasAI);
  const activeTitle =
    view === 'multipleLinks'
      ? 'Mehrere Links importieren'
      : view === 'text'
        ? 'Text einfügen'
        : view === 'media'
          ? 'Foto oder PDF'
          : 'Rezept hinzufügen';
  const submitLabel =
    view === 'home'
      ? 'Link importieren'
      : view === 'multipleLinks'
        ? 'Links importieren'
        : view === 'text'
          ? 'Text importieren'
          : 'Import starten';
  const submitButton = (
    <Press
      accessibilityRole="button"
      disabled={isImporting}
      onPress={() => void handleImport()}
      style={[styles.primaryButton, isImporting ? styles.disabled : undefined]}>
      {isImporting ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Txt
          variant={view === 'home' ? 'heading' : 'body'}
          weight="700"
          style={styles.primaryButtonText}>
          {submitLabel}
        </Txt>
      )}
    </Press>
  );
  const header = (
    <View style={[styles.content, view === 'home' && styles.homeContent]}>
      {view === 'home' ? (
        <>
          <Txt variant="title" weight="700" center style={styles.homeTitle}>
            Rezept hinzufügen
          </Txt>
          <Txt variant="body" weight="500" center style={styles.homeSubtitle}>
            Rezeptlink einfügen oder eine andere Quelle wählen.
          </Txt>
          <View style={[styles.formSection, styles.homeFormSection]}>
            <Txt variant="heading" weight="700" style={styles.inputLabel}>
              Rezeptlink
            </Txt>
            <TextField
              value={sourceValue}
              onChangeText={(value) => {
                setSourceValue(value);
                setError(null);
              }}
              maxLength={2_048}
              placeholder="https://…"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Rezeptlink"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="go"
              onSubmitEditing={() => void handleImport()}
            />
          </View>
          {submitButton}
          {error ? (
            <Txt variant="caption" tone="danger">
              {error}
            </Txt>
          ) : null}
          <Press
            accessibilityRole="button"
            onPress={() => changeView('multipleLinks')}
            style={[styles.secondaryTextButton, styles.homeSecondaryLink]}>
            <Txt variant="heading" weight="700" style={styles.secondaryText}>
              Mehrere Links importieren
            </Txt>
          </Press>
          <View style={[styles.separatorRow, styles.homeSeparatorRow]}>
            <Divider style={styles.separatorLine} />
            <Txt variant="body" tone="secondary" weight="700">
              ODER
            </Txt>
            <Divider style={styles.separatorLine} />
          </View>
          <View style={[styles.sourceCards, styles.homeSourceCards]}>
            <Press
              accessibilityRole="button"
              onPress={() => changeView('text')}
              containerStyle={{ flex: 1 }}
              style={({ pressed }) => [styles.sourceCard, pressed && styles.sourceCardPressed]}>
              <Feather name="file-text" size={rs(44)} color={colors.text} accessible={false} />
              <Txt variant="heading" weight="700" style={styles.sourceCardText}>
                Text einfügen
              </Txt>
            </Press>
            <Press
              accessibilityRole="button"
              onPress={() => changeView('media')}
              containerStyle={{ flex: 1 }}
              style={({ pressed }) => [styles.sourceCard, pressed && styles.sourceCardPressed]}>
              <Feather name="camera" size={rs(44)} color={colors.text} accessible={false} />
              <Txt variant="heading" weight="700" style={styles.sourceCardText}>
                Foto oder PDF
              </Txt>
            </Press>
          </View>
          <Press accessibilityRole="button" onPress={openManualRecipe} style={styles.manualEntry}>
            <Txt variant="heading" weight="700" style={styles.secondaryText}>
              Rezept manuell eingeben
            </Txt>
          </Press>
        </>
      ) : (
        <>
          <Press
            accessibilityRole="button"
            onPress={() => changeView('home')}
            style={styles.backAction}>
            <Feather name="arrow-left" size={18} color={colors.text} accessible={false} />
            <Txt variant="body" weight="700">
              Zurück
            </Txt>
          </Press>
          <Txt variant="title" weight="700">
            {activeTitle}
          </Txt>
          {view === 'multipleLinks' ? (
            <View style={styles.formSection}>
              <Txt variant="body" weight="700" style={styles.inputLabel}>
                Rezeptlinks
              </Txt>
              <TextField
                value={sourceValue}
                onChangeText={(value) => {
                  setSourceValue(value);
                  setError(null);
                }}
                maxLength={20_000}
                multiline
                numberOfLines={5}
                placeholder="Ein Rezeptlink pro Zeile"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Rezeptlinks"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.multilineInput]}
                textAlignVertical="top"
              />
            </View>
          ) : null}
          {view === 'text' ? (
            <View style={styles.formSection}>
              <Txt variant="body" weight="700" style={styles.inputLabel}>
                Rezepttext
              </Txt>
              <TextField
                value={sourceValue}
                onChangeText={(value) => {
                  setSourceValue(value);
                  setError(null);
                }}
                maxLength={50_000}
                multiline
                numberOfLines={8}
                placeholder="Rezepttext hier einfügen"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Rezepttext"
                style={[styles.input, styles.multilineInput]}
                textAlignVertical="top"
              />
            </View>
          ) : null}
          {view === 'media' ? (
            <>
              <View style={styles.mediaPickerRow}>
                <Press
                  accessibilityRole="button"
                  onPress={() => void pickImages()}
                  style={styles.mediaPickerButton}>
                  <Txt variant="body" weight="700">
                    Fotos auswählen
                  </Txt>
                </Press>
                <Press
                  accessibilityRole="button"
                  onPress={() => void pickPdf()}
                  style={styles.mediaPickerButton}>
                  <Txt variant="body" weight="700">
                    PDF auswählen
                  </Txt>
                </Press>
              </View>
              <Press
                accessibilityRole="button"
                onPress={() => void pickVideo()}
                style={styles.videoPickerButton}>
                <Txt variant="body" weight="700">
                  Video aus Fotos auswählen
                </Txt>
              </Press>
              <Txt variant="caption" tone="secondary">
                Speichere das Reel zuerst mit deinem Shortcut in Fotos. fam liest bis zu fünf
                aussagekräftige Videobilder für den Rezeptentwurf aus.
              </Txt>
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
                Bis zu fünf Fotos oder ein PDF mit maximal 5,5 MB. Videos werden als Standbilder
                importiert.
              </Txt>
            </>
          ) : null}
          {isAiImportView && hasAI ? (
            <Txt variant="caption" tone="secondary">
              KI-Auswertung: 3 Credits.
              {credits
                ? ' Verbraucht: ' +
                  String(credits.creditsUsed) +
                  '/' +
                  String(credits.creditLimit) +
                  ' diesen Monat.'
                : ''}
            </Txt>
          ) : null}
          {!hasAI && (view === 'text' || view === 'media') ? (
            <Txt variant="caption" tone="secondary">
              Die KI-Auswertung benötigt das AI-Abo des aktiven Haushalts.
            </Txt>
          ) : null}
          {submitButton}
          {error ? (
            <Txt variant="caption" tone="danger">
              {error}
            </Txt>
          ) : null}
          {credits?.blocked && isAiImportView ? (
            <Txt variant="caption" tone="danger">
              Das monatliche Credit-Limit ist erreicht. Vollständige strukturierte Weblinks bleiben
              kostenlos.
            </Txt>
          ) : null}
        </>
      )}
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
      {drafts.length > 0 ? (
        <Txt variant="title" weight="700" style={styles.sectionTitle}>
          Importentwürfe
        </Txt>
      ) : null}
    </View>
  );

  return (
    <HubScreen
      header={{
        title: 'fam',
        titleVariant: 'brand',
        align: 'center',
        leading: <BackButton label="Zurück" variant="header" onPress={() => router.back()} />,
      }}
      showProfile={false}>
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
            ListEmptyComponent={null}
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
