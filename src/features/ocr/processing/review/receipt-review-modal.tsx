import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { Button, CloseButton, Press, Surface, Txt } from '@/constants/ui';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { ReceiptDraft } from '../domain/types';
import {
  addReceiptReviewItem,
  applyReceiptReviewState,
  createReceiptReviewState,
  getReceiptReviewValidationErrors,
  type ReceiptReviewState,
  type ReceiptReviewStoreOption,
  removeReceiptReviewItem,
  updateReceiptReviewItem,
  updateReceiptReviewState,
} from './model';

type ReceiptReviewModalProps = {
  visible: boolean;
  draft: ReceiptDraft;
  stores: readonly ReceiptReviewStoreOption[];
  onCancel: () => void;
  onConfirm: (draft: ReceiptDraft, storeId: string, state: ReceiptReviewState) => void;
  initialState?: ReceiptReviewState;
  onStateChange?: (state: ReceiptReviewState) => void | Promise<void>;
  /** Renders the review content inside a parent-owned native Modal. */
  embedded?: boolean;
};

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: theme.space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.md,
  },
  content: {
    gap: theme.space.md,
    paddingBottom: theme.space.xxxl,
  },
  field: {
    gap: theme.space.xs,
  },
  input: {
    minHeight: 42,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.backgroundElement,
    color: theme.text,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  item: {
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
    borderTopWidth: theme.borderWidth.base,
    borderTopColor: theme.border,
  },
  itemInputs: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  itemInput: {
    flex: 1,
  },
  storeChoices: {
    gap: theme.space.sm,
  },
  storeChoice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
  },
  uncertain: {
    color: theme.warningText,
  },
  remove: {
    alignSelf: 'flex-end',
  },
  error: {
    color: theme.dangerText,
  },
}));

function validationMessage(
  code: ReturnType<typeof getReceiptReviewValidationErrors>[number]['code'],
  t: (key: string) => string,
): string {
  return t(`ocr.review.validation.${code}`);
}

export function ReceiptReviewModal({
  visible,
  draft,
  stores,
  onCancel,
  onConfirm,
  initialState,
  onStateChange,
  embedded = false,
}: ReceiptReviewModalProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<ReceiptReviewState>(
    () => initialState ?? createReceiptReviewState(draft),
  );
  const [error, setError] = useState<string | null>(null);
  const wasVisible = useRef(false);
  const lastPersistedState = useRef<string | null>(null);

  useEffect(() => {
    debugLogEvent('receipt.capture.review_modal.visibility_changed', {
      visible,
      embedded,
    });
  }, [embedded, visible]);

  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      lastPersistedState.current = null;
      return;
    }
    if (!wasVisible.current) {
      wasVisible.current = true;
      lastPersistedState.current = null;
      setState(initialState ?? createReceiptReviewState(draft, null));
      setError(null);
    }
  }, [draft, initialState, visible]);

  useEffect(() => {
    if (!visible) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastPersistedState.current) return;
    lastPersistedState.current = serialized;
    void onStateChange?.(state);
  }, [onStateChange, state, visible]);

  function changeState(update: (current: ReceiptReviewState) => ReceiptReviewState) {
    setState((current) => update(current));
  }

  function confirm() {
    debugLogEvent('receipt.capture.save.button_pressed', {
      item_count: state.items.length,
      has_store: Boolean(state.storeId),
    });
    try {
      const reviewed = applyReceiptReviewState(draft, state);
      const errors = getReceiptReviewValidationErrors(
        reviewed,
        state.storeId,
        stores.map(({ id }) => id),
      );
      const firstError = errors[0];
      if (firstError) {
        throw new Error(validationMessage(firstError.code, t));
      }
      if (!state.storeId) throw new Error(t('ocr.review.validation.store_required'));
      onConfirm(reviewed, state.storeId, state);
      setError(null);
    } catch (nextError: unknown) {
      debugLogEvent('receipt.capture.save.validation_failed', {
        error_type: nextError instanceof Error ? nextError.name : typeof nextError,
        error_message: nextError instanceof Error ? nextError.message : t('ocr.review.error'),
      });
      setError(nextError instanceof Error ? nextError.message : t('ocr.review.error'));
    }
  }

  const content = (
    <Surface style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Txt variant="heading" weight="700">
            {t('ocr.review.title')}
          </Txt>
          <CloseButton
            accessibilityLabel={t('ocr.review.cancel')}
            onPress={() => {
              debugLogEvent('receipt.capture.button_pressed', { button: 'cancel_review' });
              onCancel();
            }}
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Txt variant="body" weight="700">
              {t('ocr.review.market')}
            </Txt>
            <TextInput
              accessibilityLabel={t('ocr.review.market')}
              value={state.market}
              onChangeText={(market) =>
                changeState((current) => updateReceiptReviewState(current, { market }))
              }
              style={styles.input}
            />
            {state.marketNeedsReview ? (
              <Txt variant="caption" style={styles.uncertain}>
                {t('ocr.review.needsReview')}
              </Txt>
            ) : null}
          </View>
          <View style={styles.field}>
            <Txt variant="body" weight="700">
              {t('ocr.review.store')}
            </Txt>
            <View style={styles.storeChoices}>
              {stores.map((store) => (
                <Press
                  key={store.id}
                  accessibilityRole="radio"
                  accessibilityLabel={store.name}
                  accessibilityState={{ selected: state.storeId === store.id }}
                  selected={state.storeId === store.id}
                  onPress={() => {
                    debugLogEvent('receipt.capture.button_pressed', {
                      button: 'store_select',
                    });
                    changeState((current) =>
                      updateReceiptReviewState(current, { storeId: store.id }),
                    );
                  }}
                  style={styles.storeChoice}>
                  <Txt variant="body">{store.name}</Txt>
                </Press>
              ))}
            </View>
            {!state.storeId ? (
              <Txt variant="caption" style={styles.uncertain}>
                {t('ocr.review.storeRequired')}
              </Txt>
            ) : null}
          </View>
          <View style={styles.field}>
            <Txt variant="body" weight="700">
              {t('ocr.review.date')}
            </Txt>
            <TextInput
              accessibilityLabel={t('ocr.review.date')}
              value={state.purchaseDate}
              onChangeText={(purchaseDate) =>
                changeState((current) => updateReceiptReviewState(current, { purchaseDate }))
              }
              style={styles.input}
            />
            {state.dateNeedsReview ? (
              <Txt variant="caption" style={styles.uncertain}>
                {t('ocr.review.needsReview')}
              </Txt>
            ) : null}
          </View>
          <View style={styles.field}>
            <Txt variant="body" weight="700">
              {t('ocr.review.total')}
            </Txt>
            <TextInput
              accessibilityLabel={t('ocr.review.total')}
              keyboardType="decimal-pad"
              value={state.totalCents}
              onChangeText={(totalCents) =>
                changeState((current) => updateReceiptReviewState(current, { totalCents }))
              }
              style={styles.input}
            />
            {state.totalNeedsReview ? (
              <Txt variant="caption" style={styles.uncertain}>
                {t('ocr.review.needsReview')}
              </Txt>
            ) : null}
          </View>

          {state.items.map((item, index) => (
            <View key={item.id} style={styles.item}>
              <Txt variant="body" weight="700">
                {t('ocr.review.item', { number: index + 1 })}
              </Txt>
              <TextInput
                accessibilityLabel={t('ocr.review.itemName')}
                value={item.name}
                onChangeText={(name) =>
                  changeState((current) => updateReceiptReviewItem(current, index, { name }))
                }
                style={styles.input}
              />
              <View style={styles.itemInputs}>
                <View style={styles.itemInput}>
                  <Txt variant="caption" tone="secondary">
                    {t('ocr.review.quantity')}
                  </Txt>
                  <TextInput
                    accessibilityLabel={t('ocr.review.quantity')}
                    keyboardType="decimal-pad"
                    value={item.quantity}
                    onChangeText={(quantity) =>
                      changeState((current) =>
                        updateReceiptReviewItem(current, index, { quantity }),
                      )
                    }
                    style={styles.input}
                  />
                </View>
                <View style={styles.itemInput}>
                  <Txt variant="caption" tone="secondary">
                    {t('ocr.review.lineTotal')}
                  </Txt>
                  <TextInput
                    accessibilityLabel={t('ocr.review.lineTotal')}
                    keyboardType="decimal-pad"
                    value={item.lineTotalCents}
                    onChangeText={(lineTotalCents) =>
                      changeState((current) =>
                        updateReceiptReviewItem(current, index, { lineTotalCents }),
                      )
                    }
                    style={styles.input}
                  />
                </View>
              </View>
              {item.needsReview ? (
                <Txt variant="caption" style={styles.uncertain}>
                  {t('ocr.review.needsReview')}
                </Txt>
              ) : null}
              <Button
                title={t('ocr.review.removeItem')}
                variant="link"
                size="sm"
                style={styles.remove}
                onPress={() => {
                  debugLogEvent('receipt.capture.button_pressed', {
                    button: 'remove_item',
                    item_position: index,
                  });
                  changeState((current) => removeReceiptReviewItem(current, item.id));
                }}
              />
            </View>
          ))}

          {error ? (
            <Txt variant="body" tone="danger" accessibilityRole="alert" style={styles.error}>
              {error}
            </Txt>
          ) : null}
          <Button
            title={t('ocr.review.addItem')}
            variant="secondary"
            onPress={() => {
              debugLogEvent('receipt.capture.button_pressed', { button: 'add_item' });
              changeState((current) => addReceiptReviewItem(current));
            }}
          />
          <Button title={t('ocr.review.confirm')} onPress={confirm} />
        </ScrollView>
      </SafeAreaView>
    </Surface>
  );

  if (embedded || process.env.NODE_ENV === 'test') return visible ? content : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={process.env.EXPO_OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onCancel}>
      {content}
    </Modal>
  );
}
