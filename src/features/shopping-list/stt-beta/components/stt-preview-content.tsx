import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Press, Surface, TextField, Txt } from '@/constants/ui';
import { getUnitLabel } from '@/lib/units';
import { getClarificationSummary } from '../domain/clarification';
import { type NameCorrection, normalizeCorrectionName } from '../name-corrections';
import type { BetaPreviewItem, ParsedShoppingItem, ShoppingListSuggestion } from '../types';
import type { TextBetaPreview, TextBetaSelection } from '../workflow/text-workflow';
import { NaturalLanguageAdditionSheetCloseButton } from './stt-close-button';

export type NaturalLanguageAdditionSwiftUIPreviewProps = {
  visible: boolean;
  nameCorrections?: readonly NameCorrection[];
  correctionBusy?: boolean;
  onCorrectName?: (itemId: string, name: string, remember: boolean) => void | Promise<void>;
  onForgetCorrection?: (original: string) => void | Promise<void>;
  preview: TextBetaPreview;
  onRequestClose: () => void;
  onDismiss: () => void;
  onEditText: (text: string) => void;
  onConfirm: (selections: readonly TextBetaSelection[]) => void;
};

export type NaturalLanguageAdditionSwiftUIPreviewContentProps = Omit<
  NaturalLanguageAdditionSwiftUIPreviewProps,
  'visible' | 'onDismiss'
>;

function itemLabel(item: ParsedShoppingItem, t: TFunction): string {
  const unit = item.unit ? getUnitLabel(item.unit, t) : null;
  const quantity =
    item.quantity === 1 && unit === null ? '' : `${item.quantity}${unit ? ` ${unit}` : ''} `;
  const brand = item.brand
    ? t('shoppingList.speechBeta.preview.fromBrand', { brand: item.brand })
    : '';
  return `${quantity}${item.name}${brand}`;
}

function summaryText(items: readonly BetaPreviewItem[], t: TFunction): string {
  const safeCount = items.filter((item) => !item.routing.needsClarification).length;
  const unclearCount = items.length - safeCount;
  if (unclearCount === 0) {
    return t('shoppingList.speechBeta.preview.summarySafe', { count: safeCount });
  }
  return t('shoppingList.speechBeta.preview.summaryWithUnclear', {
    safeCount,
    count: unclearCount,
  });
}

function initialSelections(items: readonly BetaPreviewItem[]): Record<string, string | null> {
  return Object.fromEntries(
    items.map((item) => [
      item.itemId,
      item.routing.kind === 'resolved' ? item.routing.listId : null,
    ]),
  );
}

/** Renders the shared preview content used by both platform-specific sheet hosts. */
export function NaturalLanguageAdditionSwiftUIPreviewContent({
  preview,
  onRequestClose,
  onEditText,
  onConfirm,
  nameCorrections = [],
  correctionBusy = false,
  onCorrectName,
  onForgetCorrection,
}: NaturalLanguageAdditionSwiftUIPreviewContentProps) {
  const { t } = useTranslation();
  const selectionDefaults = useMemo(() => initialSelections(preview.items), [preview]);
  const [showCorrections, setShowCorrections] = useState(false);
  const [draftText, setDraftText] = useState(preview.input.text);
  const [selectedTargets, setSelectedTargets] =
    useState<Record<string, string | null>>(selectionDefaults);
  const [deferredItemIds, setDeferredItemIds] = useState<ReadonlySet<string>>(new Set());

  const previousItemsRef = useRef(preview.items);
  useEffect(() => {
    setDraftText(preview.input.text);
  }, [preview.input.text]);

  useEffect(() => {
    const unchangedIds = new Set(
      preview.items
        .filter((item) => previousItemsRef.current.includes(item))
        .map((item) => item.itemId),
    );
    previousItemsRef.current = preview.items;
    setSelectedTargets((current) =>
      Object.fromEntries(
        preview.items.map((item) => [
          item.itemId,
          unchangedIds.has(item.itemId)
            ? (current[item.itemId] ?? null)
            : selectionDefaults[item.itemId],
        ]),
      ),
    );
    setDeferredItemIds((current) => new Set([...current].filter((id) => unchangedIds.has(id))));
  }, [preview.items, selectionDefaults]);

  const summary = getClarificationSummary(preview.items);
  const selections = useMemo(
    () =>
      preview.items.flatMap((item) => {
        const targetListId = selectedTargets[item.itemId];
        return targetListId ? [{ itemId: item.itemId, targetListId }] : [];
      }),
    [preview.items, selectedTargets],
  );

  const selectSuggestion = (itemId: string, listId: string) => {
    setSelectedTargets((current) => ({ ...current, [itemId]: listId }));
    setDeferredItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  };

  const deferItem = (itemId: string) => {
    setSelectedTargets((current) => ({ ...current, [itemId]: null }));
    setDeferredItemIds((current) => new Set(current).add(itemId));
  };

  return (
    <Surface tone="surface" style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Txt variant="caption" tone="secondary">
            {t('shoppingList.speechBeta.preview.newItems')}
          </Txt>
          <Txt variant="title" testID="Passt-das-so">
            {t('shoppingList.speechBeta.preview.title')}
          </Txt>
        </View>
        <NaturalLanguageAdditionSheetCloseButton
          onPress={onRequestClose}
          accessibilityLabel={t('shoppingList.speechBeta.preview.close')}
        />
      </View>

      <ScrollView
        testID="natural-language-addition-preview-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        <View style={styles.transcript}>
          <TextField
            label={t('shoppingList.speechBeta.preview.recognizedText')}
            value={draftText}
            onChangeText={setDraftText}
            editable={!correctionBusy}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={styles.transcriptInput}
          />
          <Button
            title={t('shoppingList.speechBeta.preview.recheck')}
            variant="secondary"
            onPress={() => onEditText(draftText.trim())}
            disabled={!draftText.trim() || correctionBusy}
            full
          />
          {preview.parseResult.unparsedText ? (
            <Txt variant="body" tone="warning" accessibilityRole="alert">
              {t('shoppingList.speechBeta.preview.unparsed', {
                text: preview.parseResult.unparsedText,
              })}
            </Txt>
          ) : null}
          <Txt variant="caption" tone="secondary">
            {summaryText(preview.items, t)}
          </Txt>
        </View>

        {summary.shouldBundle ? (
          <View style={styles.bundlePrompt}>
            <View style={styles.bundlePromptHeader}>
              <Txt variant="label">{t('shoppingList.speechBeta.preview.bundleTitle')}</Txt>
              <Txt variant="caption" tone="warning">
                {t('shoppingList.speechBeta.preview.open', {
                  count: summary.suggestedUnclearItemCount,
                })}
              </Txt>
            </View>
            <Txt variant="caption" tone="secondary">
              {t('shoppingList.speechBeta.preview.bundleHint')}
            </Txt>
          </View>
        ) : null}

        <View style={styles.rows}>
          {preview.items.map((item) => (
            <PreviewRow
              key={item.itemId}
              item={item}
              deferred={deferredItemIds.has(item.itemId)}
              selectedTargetId={selectedTargets[item.itemId]}
              onSelectSuggestion={selectSuggestion}
              onDefer={deferItem}
              correctionBusy={correctionBusy}
              onCorrectName={onCorrectName}
              suggestedName={
                nameCorrections.find(
                  (correction) =>
                    normalizeCorrectionName(correction.original) ===
                    normalizeCorrectionName(item.item.name),
                )?.corrected
              }
            />
          ))}
        </View>

        {nameCorrections.length > 0 && onForgetCorrection ? (
          <View style={styles.rows}>
            <Button
              title={t('shoppingList.speechBeta.preview.remembered', {
                count: nameCorrections.length,
              })}
              variant="secondary"
              onPress={() => setShowCorrections((shown) => !shown)}
            />
            {showCorrections
              ? nameCorrections.map((correction) => (
                  <View key={correction.original} style={styles.rows}>
                    <Txt variant="body">
                      {correction.original} → {correction.corrected}
                    </Txt>
                    <Button
                      title={t('shoppingList.speechBeta.preview.forget', {
                        name: correction.original,
                      })}
                      variant="secondary"
                      disabled={correctionBusy}
                      onPress={() => {
                        void onForgetCorrection(correction.original);
                      }}
                    />
                  </View>
                ))
              : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button
            title={t('shoppingList.speechBeta.preview.addItems', { count: selections.length })}
            onPress={() => onConfirm(selections)}
            disabled={selections.length === 0 || correctionBusy}
            full
          />
          <Button
            title={t('shoppingList.speechBeta.preview.later')}
            testID="Später"
            variant="secondary"
            onPress={onRequestClose}
            full
          />
        </View>
      </ScrollView>
    </Surface>
  );
}

type PreviewRowProps = {
  item: BetaPreviewItem;
  correctionBusy: boolean;
  suggestedName?: string;
  onCorrectName: NaturalLanguageAdditionSwiftUIPreviewProps['onCorrectName'];
  deferred: boolean;
  selectedTargetId: string | null | undefined;
  onSelectSuggestion: (itemId: string, listId: string) => void;
  onDefer: (itemId: string) => void;
};

function PreviewRow({
  item,
  deferred,
  selectedTargetId,
  onSelectSuggestion,
  onDefer,
  correctionBusy,
  suggestedName,
  onCorrectName,
}: PreviewRowProps) {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(item.item.name);
  useEffect(() => {
    setName(item.item.name);
    setEditingName(false);
  }, [item.item.name]);
  const hasNewName = name.trim().length > 0 && name.trim() !== item.item.name;
  const isUnclear = item.routing.needsClarification;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemHeader}>
        <Txt variant="body" weight="600">
          {itemLabel(item.item, t)}
        </Txt>
        <Txt variant="caption" tone={isUnclear ? 'warning' : 'success'}>
          {isUnclear ? '?' : '✓'}
        </Txt>
      </View>

      {onCorrectName ? (
        <View style={styles.rows}>
          {suggestedName &&
          normalizeCorrectionName(suggestedName) !== normalizeCorrectionName(item.item.name) ? (
            <Button
              title={t('shoppingList.speechBeta.preview.suggestionTake', {
                name: suggestedName,
              })}
              variant="secondary"
              disabled={correctionBusy}
              onPress={() => {
                void onCorrectName(item.itemId, suggestedName, false);
              }}
            />
          ) : null}
          {editingName ? (
            <>
              <TextField
                label={t('shoppingList.speechBeta.preview.itemName')}
                value={name}
                onChangeText={setName}
                editable={!correctionBusy}
              />
              <Button
                title={t('shoppingList.speechBeta.preview.takeOnly')}
                variant="secondary"
                disabled={!hasNewName || correctionBusy}
                onPress={() => {
                  void onCorrectName(item.itemId, name.trim(), false);
                }}
              />
              <Button
                title={t('shoppingList.speechBeta.preview.takeAndRemember')}
                disabled={!hasNewName || correctionBusy}
                onPress={() => {
                  void onCorrectName(item.itemId, name.trim(), true);
                }}
              />
              <Button
                title={t('shoppingList.speechBeta.preview.cancelCorrection')}
                variant="secondary"
                disabled={correctionBusy}
                onPress={() => {
                  setName(item.item.name);
                  setEditingName(false);
                }}
              />
            </>
          ) : (
            <Button
              title={t('shoppingList.speechBeta.preview.correctName')}
              variant="secondary"
              disabled={correctionBusy}
              onPress={() => setEditingName(true)}
            />
          )}
        </View>
      ) : null}

      {isUnclear ? (
        <View style={styles.suggestionList}>
          {item.routing.suggestions.map((suggestion) => (
            <SuggestionButton
              key={suggestion.listId}
              itemId={item.itemId}
              suggestion={suggestion}
              selected={selectedTargetId === suggestion.listId}
              onPress={onSelectSuggestion}
            />
          ))}
          <Press
            selected={deferred}
            onPress={() => onDefer(item.itemId)}
            accessibilityRole="button"
            accessibilityLabel={t('shoppingList.speechBeta.preview.defer')}
            accessibilityState={{ selected: deferred }}
            containerStyle={styles.choiceContainer}>
            <View style={[styles.choice, deferred && styles.deferredChoice]}>
              <Txt variant="caption" tone="secondary">
                {t('shoppingList.speechBeta.preview.defer')}
              </Txt>
            </View>
          </Press>
        </View>
      ) : (
        <Txt variant="caption" tone="secondary">
          {item.routing.bestMatch?.listName ?? t('shoppingList.speechBeta.preview.certain')}
        </Txt>
      )}
    </View>
  );
}

type SuggestionButtonProps = {
  itemId: string;
  suggestion: ShoppingListSuggestion;
  selected: boolean;
  onPress: (itemId: string, listId: string) => void;
};

function SuggestionButton({ itemId, suggestion, selected, onPress }: SuggestionButtonProps) {
  return (
    <Press
      selected={selected}
      onPress={() => onPress(itemId, suggestion.listId)}
      accessibilityRole="button"
      accessibilityLabel={suggestion.listName}
      accessibilityState={{ selected }}
      containerStyle={styles.choiceContainer}>
      <View style={styles.choice}>
        <Txt variant="caption" weight="600">
          {suggestion.listName}
        </Txt>
        {selected ? (
          <Txt variant="caption" tone="accent">
            ✓
          </Txt>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create((theme) => ({
  sheet: {
    flex: 1,
    width: '100%',
    minHeight: theme.space.xxxxl,
    backgroundColor: theme.backgroundElement,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: theme.space.lg,
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.md,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.lg,
  },
  headerCopy: {
    flex: 1,
    gap: theme.space.xs,
  },
  transcript: {
    gap: theme.space.xs,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
    backgroundColor: theme.backgroundSoft,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
  },
  transcriptInput: {
    minHeight: 96,
  },
  bundlePrompt: {
    gap: theme.space.xs,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.warning,
    backgroundColor: theme.backgroundSoft,
    padding: theme.space.md,
  },
  bundlePromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  rows: {
    gap: theme.space.sm,
  },
  itemRow: {
    gap: theme.space.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundElement,
    padding: theme.space.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  suggestionList: {
    gap: theme.space.xs,
  },
  choiceContainer: {
    width: '100%',
  },
  choice: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  deferredChoice: {
    backgroundColor: theme.backgroundSoft,
    borderColor: theme.accent,
  },
  footer: {
    gap: theme.space.sm,
  },
}));
