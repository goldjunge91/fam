import { Image } from 'expo-image';
import { memo, type Ref, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';
import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { inputTextStyles, MIN_TOUCH_SIZE, Press, Txt } from '@/constants/ui';
import { StepMentionText } from '@/features/recipes/components/step-mention-text';
import {
  pickRecipeImage,
  useRecipeStepImageUrl,
} from '@/features/recipes/data/household-recipe-images';
import {
  computeMentionUsage,
  type MentionableIngredient,
  matchPendingMention,
  mentionedIngredientIds,
} from '@/features/recipes/domain/ingredient-mentions';
import {
  createStepImageMarker,
  removeStepImageMarker,
  stripStepImageMarkers,
} from '@/features/recipes/domain/step-image-markers';
import {
  type IngredientComponentGroup,
  MAX_RECIPE_STEP_IMAGES,
  type WizardStepItem,
} from './types';

const styles = StyleSheet.create((theme) => ({
  ledger: {
    marginBottom: theme.space.sm,
    paddingBottom: theme.space.sm,
  },
  ledgerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.xs,
  },
  ledgerSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  ledgerBody: {
    gap: theme.space.md,
    paddingTop: theme.space.xs,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  progress: {
    height: rs(2),
    borderRadius: theme.radius.s,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  stepCard: {
    borderRadius: theme.radius.lg,
    padding: theme.space.md,
    marginBottom: theme.space.lg,
    gap: theme.space.md,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  dragButton: {
    padding: theme.space.xs,
  },
  stepTitle: {
    flex: 1,
  },
  // Sichtbare Flaeche 36, Trefferbereich 44 — die Vergroesserung des
  // Containers darf das Kachel-Design der Schrittliste nicht veraendern.
  deleteStepFace: {
    width: rs(36),
    height: rs(36),
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteStep: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorWrap: {
    position: 'relative',
  },
  editor: {
    borderRadius: theme.radius.md,
    minHeight: rs(132),
    paddingHorizontal: theme.space.xxl,
    paddingVertical: theme.space.lg,
  },
  mentionPanel: {
    marginTop: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
    padding: theme.space.xs,
  },
  mentionRow: {
    paddingHorizontal: theme.space.xxl,
    paddingVertical: theme.space.sm,
    borderBottomWidth: 0.5,
  },
  mentionHint: {
    paddingHorizontal: theme.space.xxl,
    paddingVertical: theme.space.sm,
  },
  mentionPreview: {
    paddingHorizontal: theme.space.xs,
  },
  imageBlock: {
    gap: theme.space.md,
  },
  stepImage: {
    width: '100%',
    height: rs(140),
    borderRadius: theme.radius.sm,
  },
  inlineLink: {
    alignSelf: 'flex-start',
  },
  timerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  timerInput: {
    width: rs(70),
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.xxl,
    paddingVertical: theme.space.sm,
  },
  screen: {
    flex: 1,
    paddingHorizontal: theme.space.xxl,
  },
  screenEyebrow: {
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.md,
  },
  screenTitle: {
    marginBottom: theme.space.xs,
  },
  screenHint: {
    marginBottom: theme.space.sm,
  },
  reorderable: {
    flex: 1,
  },
  reorderableContent: {
    paddingBottom: theme.space.xxxxl,
  },
  addStep: {
    width: '100%',
    height: rs(42),
    borderRadius: theme.radius.famLarge,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.space.xs,
    marginBottom: theme.space.xxxxl,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space.lg,
    marginBottom: theme.space.lg,
  },
  actionContainer: {
    flex: 1,
  },
  action: {
    minHeight: theme.controlSizes.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

function flattenIngredients(components: IngredientComponentGroup[]): MentionableIngredient[] {
  const result: MentionableIngredient[] = [];
  for (const comp of components) {
    for (const item of comp.items) {
      // item.product ist nur bei einer frisch abgeschlossenen OFF-Suche
      // gesetzt. Beim Bearbeiten geladene Zutaten haben stattdessen
      // productQuery/sourceText is the fallback for imported and hydrated rows
      // without a freshly selected product.
      const name =
        item.product?.name ?? (item.productQuery.trim() || item.sourceText?.trim() || null);
      if (!name) continue;
      const quantity = item.quantity.trim() === '' ? null : Number.parseFloat(item.quantity);
      result.push({
        itemId: item.id,
        name,
        unit: item.unit.trim() || null,
        quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
      });
    }
  }
  return result;
}

function pendingAutocomplete(text: string, ingredients: MentionableIngredient[]) {
  const pending = matchPendingMention(text);
  if (!pending) return null;
  const matches = ingredients.filter((i) =>
    i.name.toLowerCase().startsWith(pending.query.toLowerCase()),
  );
  if (matches.length === 0) return null;
  if (matches.length === 1 && matches[0].name.toLowerCase() === pending.query.toLowerCase()) {
    return null;
  }
  return { ...pending, matches };
}

interface IngredientLedgerProps {
  ingredients: MentionableIngredient[];
  used: Map<string, number>;
}

function IngredientLedger({ ingredients, used }: IngredientLedgerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  if (ingredients.length === 0) return null;

  const doneCount = ingredients.filter(
    (i) => i.quantity !== null && i.quantity > 0 && (used.get(i.itemId) ?? 0) >= i.quantity,
  ).length;

  return (
    <View style={[styles.ledger, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <Press
        style={styles.ledgerToggle}
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? t('recipes.wizard.collapseIngredients') : t('recipes.wizard.expandIngredients')
        }>
        <Txt variant="eyebrow" tone="secondary" weight="700">
          {t('recipes.wizard.ingredientLedger')}
        </Txt>
        <View style={styles.ledgerSummary}>
          {!expanded ? (
            <Txt variant="caption" tone="secondary">
              {t('recipes.wizard.remainingCount', {
                used: doneCount,
                total: ingredients.length,
              })}
            </Txt>
          ) : null}
          <Txt variant="caption" tone="secondary">
            {expanded ? '▾' : '▸'}
          </Txt>
        </View>
      </Press>

      {expanded ? (
        <View style={styles.ledgerBody}>
          {ingredients.map((ing) => {
            const usedAmount = used.get(ing.itemId) ?? 0;
            const usableQuantity = ing.quantity !== null && ing.quantity > 0 ? ing.quantity : null;
            const pct =
              usableQuantity !== null
                ? Math.min(100, Math.round((usedAmount / usableQuantity) * 100))
                : 0;
            const full = usableQuantity !== null && usedAmount >= usableQuantity;
            const remaining =
              usableQuantity === null ? null : Math.max(0, usableQuantity - usedAmount);
            return (
              <View key={ing.itemId}>
                <View style={styles.ledgerRow}>
                  <Txt
                    variant="body"
                    weight="700"
                    style={
                      full
                        ? { color: colors.textSecondary, textDecorationLine: 'line-through' }
                        : undefined
                    }>
                    {ing.name}
                  </Txt>
                  <Txt
                    variant="caption"
                    tone={full ? 'success' : 'secondary'}
                    weight={full ? '600' : undefined}>
                    {full
                      ? t('recipes.wizard.used')
                      : remaining !== null
                        ? t('recipes.wizard.remaining', {
                            amount: remaining,
                            unit: ing.unit ?? '',
                          })
                        : t('recipes.wizard.amount', {
                            amount: ing.quantity === null ? '' : ing.quantity,
                            unit: ing.unit ?? '',
                          })}
                  </Txt>
                </View>
                <View style={[styles.progress, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${pct}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export type RecipeWizardStepListRef = {
  scrollToEnd: (params?: { animated?: boolean }) => void;
};

interface RecipeWizardStepStepsProps {
  steps: WizardStepItem[];
  onStepsChange: (steps: WizardStepItem[]) => void;
  components: IngredientComponentGroup[];
  onBack: () => void;
  onNext: () => void;
  listRef?: Ref<RecipeWizardStepListRef>;
}

interface StepCardProps {
  step: WizardStepItem;
  index: number;
  ingredients: MentionableIngredient[];
  onUpdateStep: (id: string, patch: Partial<WizardStepItem>) => void;
  onRemoveStep: (id: string) => void;
  onPickImage: (stepId: string) => void;
}

const StepCard = memo(function StepCard({
  step,
  index,
  ingredients,
  onUpdateStep,
  onRemoveStep,
  onPickImage,
}: StepCardProps) {
  const drag = useReorderableDrag();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const autocomplete = pendingAutocomplete(step.text, ingredients);
  const [selection, setSelection] = useState({ start: step.text.length, end: step.text.length });

  function handleChangeText(text: string) {
    onUpdateStep(step.id, { text, ingredientIds: mentionedIngredientIds(text, ingredients) });
  }

  function insertMention(ingredient: MentionableIngredient) {
    const pending = matchPendingMention(step.text);
    if (!pending) return;
    const triggerPos = step.text.length - 1 - pending.query.length;
    handleChangeText(`${step.text.slice(0, triggerPos)}@${ingredient.name}`);
  }

  function insertImageMarker(imageIndex: number) {
    const start = Math.min(selection.start, step.text.length);
    const end = Math.min(Math.max(selection.end, start), step.text.length);
    const marker = createStepImageMarker(imageIndex);
    const text = `${step.text.slice(0, start)}${marker}${step.text.slice(end)}`;
    handleChangeText(text);
    setSelection({ start: start + marker.length, end: start + marker.length });
  }

  function removeImage(imageIndex: number) {
    const text = removeStepImageMarker(step.text, imageIndex);
    onUpdateStep(step.id, {
      text,
      ingredientIds: mentionedIngredientIds(text, ingredients),
      existingImages:
        imageIndex < step.existingImages.length
          ? step.existingImages.filter((_, index) => index !== imageIndex)
          : step.existingImages,
      localImageUris:
        imageIndex >= step.existingImages.length
          ? step.localImageUris.filter(
              (_, index) => index !== imageIndex - step.existingImages.length,
            )
          : step.localImageUris,
    });
  }

  return (
    <View style={[styles.stepCard, { backgroundColor: colors.backgroundElement }]}>
      <View style={styles.stepHeader}>
        <Press
          onLongPress={drag}
          style={styles.dragButton}
          accessibilityLabel={t('recipes.wizard.moveStep')}>
          <Txt variant="heading" tone="secondary">
            ≡
          </Txt>
        </Press>
        <Txt variant="label" tone="primary" weight="700" style={styles.stepTitle}>
          {t('recipes.wizard.stepLabel', { step: index + 1 })}
        </Txt>
        <Press
          onPress={() => onRemoveStep(step.id)}
          style={styles.deleteStep}
          accessibilityRole="button"
          accessibilityLabel={t('recipes.wizard.deleteStep')}>
          <View style={[styles.deleteStepFace, { backgroundColor: colors.backgroundSoft }]}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                stroke={colors.text}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Press>
      </View>

      <View style={styles.editorWrap}>
        <TextInput
          style={[
            styles.editor,
            inputTextStyles.recipeStep,
            { backgroundColor: colors.background, color: colors.text },
          ]}
          value={step.text}
          onChangeText={handleChangeText}
          onSelectionChange={({ nativeEvent }) => setSelection(nativeEvent.selection)}
          placeholder={t('recipes.wizard.stepPlaceholder', { step: index + 1 })}
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
        />
        {autocomplete ? (
          <View
            style={[
              styles.mentionPanel,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}>
            {autocomplete.matches.slice(0, 6).map((ing) => (
              <Press
                key={ing.itemId}
                style={[styles.mentionRow, { borderBottomColor: colors.border }]}
                onPress={() => insertMention(ing)}
                accessibilityRole="button"
                accessibilityLabel={t('recipes.wizard.mentionAccessibility', {
                  name: ing.name,
                  quantity: ing.quantity,
                  unit: ing.unit ?? '',
                })}>
                <Txt variant="body" weight="700">
                  {ing.name}{' '}
                  <Txt variant="caption" tone="secondary">
                    · {ing.quantity}
                    {ing.unit}
                  </Txt>
                </Txt>
              </Press>
            ))}
            <View style={styles.mentionHint}>
              <Txt variant="caption" tone="secondary">
                {t('recipes.wizard.mentionHint', { name: autocomplete.matches[0].name })}
              </Txt>
            </View>
          </View>
        ) : null}
      </View>

      {step.text.trim() ? (
        <StepMentionText
          text={stripStepImageMarkers(step.text)}
          ingredients={ingredients}
          variant="caption"
          tone="secondary"
          style={styles.mentionPreview}
        />
      ) : null}

      {step.existingImages.length + step.localImageUris.length > 0 ? (
        <View style={styles.imageBlock}>
          {step.existingImages.map((image, imageIndex) => (
            <StepImage
              key={image.id ?? image.storagePath}
              path={image.storagePath}
              imageIndex={imageIndex}
              onInsert={() => insertImageMarker(imageIndex)}
              testID={imageIndex === 0 ? `recipe-step-image-${step.id}` : undefined}
              onRemove={() => removeImage(imageIndex)}
            />
          ))}
          {step.localImageUris.map((uri, imageIndex) => (
            <StepImage
              key={uri}
              uri={uri}
              imageIndex={step.existingImages.length + imageIndex}
              onInsert={() => insertImageMarker(step.existingImages.length + imageIndex)}
              testID={
                step.existingImages.length === 0 && imageIndex === 0
                  ? `recipe-step-image-${step.id}`
                  : undefined
              }
              onRemove={() => removeImage(step.existingImages.length + imageIndex)}
            />
          ))}
        </View>
      ) : null}
      {step.existingImages.length + step.localImageUris.length < MAX_RECIPE_STEP_IMAGES ? (
        <Press style={styles.inlineLink} onPress={() => onPickImage(step.id)}>
          <Txt variant="label" tone="primary" weight="600">
            {t('recipes.wizard.addImage')}
          </Txt>
        </Press>
      ) : null}

      <StepTimerField
        minutes={step.timerMinutes}
        onChange={(minutes) => onUpdateStep(step.id, { timerMinutes: minutes })}
      />
    </View>
  );
});

function StepImage({
  path,
  uri,
  imageIndex,
  onInsert,
  testID,
  onRemove,
}: {
  path?: string;
  uri?: string;
  imageIndex: number;
  onInsert: () => void;
  testID?: string;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { data: signedUrl } = useRecipeStepImageUrl(uri ? null : path);
  const imageUri = uri ?? signedUrl;
  if (!imageUri) return null;

  return (
    <View style={styles.imageBlock}>
      <Image
        testID={testID}
        source={{ uri: imageUri }}
        style={styles.stepImage}
        contentFit="cover"
      />
      <Press style={styles.inlineLink} onPress={onInsert}>
        <Txt variant="label" tone="primary" weight="600">
          {t('recipes.wizard.insertImage', { image: imageIndex + 1 })}
        </Txt>
      </Press>
      <Press style={styles.inlineLink} onPress={onRemove}>
        <Txt variant="label" tone="primary" weight="600">
          {t('recipes.wizard.removeImage')}
        </Txt>
      </Press>
    </View>
  );
}

interface StepTimerFieldProps {
  minutes: number | null;
  onChange: (minutes: number | null) => void;
}

function StepTimerField({ minutes, onChange }: StepTimerFieldProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  if (minutes !== null) {
    return (
      <View style={styles.timerRow}>
        <Txt variant="label" tone="primary" weight="600">
          {t('recipes.wizard.timer', { count: minutes })}
        </Txt>
        <Press onPress={() => onChange(null)}>
          <Txt variant="label" tone="primary" weight="600">
            {t('recipes.wizard.removeTimer')}
          </Txt>
        </Press>
      </View>
    );
  }

  if (editing) {
    return (
      <View style={styles.timerRow}>
        <TextInput
          testID="recipe-step-timer-input"
          accessibilityLabel={t('recipes.wizard.timerMinutes')}
          style={[
            styles.timerInput,
            inputTextStyles.recipeStep,
            { backgroundColor: colors.background, color: colors.text },
          ]}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('recipes.wizard.timerMinutes')}
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          autoFocus
          onSubmitEditing={() => {
            const parsed = Number.parseInt(draft, 10);
            if (parsed > 0) onChange(parsed);
            setDraft('');
            setEditing(false);
          }}
        />
        <Press
          onPress={() => {
            const parsed = Number.parseInt(draft, 10);
            if (parsed > 0) onChange(parsed);
            setDraft('');
            setEditing(false);
          }}>
          <Txt variant="label" tone="primary" weight="600">
            {t('recipes.wizard.applyTimer')}
          </Txt>
        </Press>
        <Press
          onPress={() => {
            setDraft('');
            setEditing(false);
          }}>
          <Txt variant="label" tone="secondary" weight="600">
            {t('recipes.wizard.cancelTimer')}
          </Txt>
        </Press>
      </View>
    );
  }

  return (
    <Press style={styles.inlineLink} onPress={() => setEditing(true)}>
      <Txt variant="label" tone="primary" weight="600">
        {t('recipes.wizard.addTimer')}
      </Txt>
    </Press>
  );
}

export function RecipeWizardStepSteps({
  steps,
  onStepsChange,
  components,
  onBack,
  onNext,
  listRef,
}: RecipeWizardStepStepsProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const ingredients = flattenIngredients(components);
  const used = computeMentionUsage(
    steps.map((s) => s.text),
    ingredients,
  );

  function updateStep(id: string, patch: Partial<WizardStepItem>) {
    onStepsChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStep(id: string) {
    onStepsChange(steps.filter((s) => s.id !== id));
  }

  function addStep() {
    onStepsChange([
      ...steps,
      {
        id: `step-${Date.now()}-${Math.random()}`,
        serverId: null,
        text: '',
        localImageUris: [],
        existingImages: [],
        timerMinutes: null,
        ingredientIds: [],
      },
    ]);
  }

  async function pickImageFor(stepId: string) {
    const step = steps.find((item) => item.id === stepId);
    if (
      !step ||
      step.existingImages.length + step.localImageUris.length >= MAX_RECIPE_STEP_IMAGES
    ) {
      return;
    }
    const uri = await pickRecipeImage();
    if (uri) updateStep(stepId, { localImageUris: [...step.localImageUris, uri] });
  }

  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    onStepsChange(reorderItems(steps, from, to));
  }

  return (
    <View style={styles.screen}>
      <Txt variant="eyebrow" tone="secondary" style={styles.screenEyebrow} weight="500">
        {t('recipes.wizard.stepOf', { current: 3 })}
      </Txt>
      <Txt variant="heading" style={styles.screenTitle}>
        {t('recipes.wizard.steps')}
      </Txt>
      <Txt variant="label" tone="secondary" style={styles.screenHint}>
        {t('recipes.wizard.stepHint')}
      </Txt>

      <IngredientLedger ingredients={ingredients} used={used} />

      <ReorderableList<WizardStepItem>
        ref={(instance) => {
          const listHandle = instance
            ? {
                scrollToEnd: (params?: { animated?: boolean }) => instance.scrollToEnd(params),
              }
            : null;
          if (typeof listRef === 'function') {
            listRef(listHandle);
          } else if (listRef) {
            listRef.current = listHandle;
          }
        }}
        style={styles.reorderable}
        contentContainerStyle={styles.reorderableContent}
        showsVerticalScrollIndicator={false}
        data={steps}
        onReorder={handleReorder}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <StepCard
            step={item}
            index={index ?? 0}
            ingredients={ingredients}
            onUpdateStep={updateStep}
            onRemoveStep={removeStep}
            onPickImage={pickImageFor}
          />
        )}
        ListFooterComponent={
          <>
            <Press
              style={[styles.addStep, { backgroundColor: colors.backgroundElement }]}
              onPress={addStep}>
              <Txt variant="caption" tone="primary" weight="600">
                {t('recipes.wizard.addStep')}
              </Txt>
            </Press>

            <View style={styles.actions}>
              <Press
                containerStyle={styles.actionContainer}
                style={[styles.action, { backgroundColor: colors.backgroundElement }]}
                onPress={onBack}>
                <Txt variant="caption" tone="primary" weight="600">
                  {t('recipes.wizard.back')}
                </Txt>
              </Press>
              <Press
                containerStyle={styles.actionContainer}
                style={[styles.action, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                onPress={onNext}>
                <Txt variant="caption" tone="onAccent" weight="600">
                  {t('recipes.wizard.next')}
                </Txt>
              </Press>
            </View>
          </>
        }
      />
    </View>
  );
}
