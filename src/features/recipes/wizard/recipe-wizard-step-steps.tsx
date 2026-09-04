import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, TextInput, TouchableOpacity, View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { StepMentionText } from '@/features/recipes/components/step-mention-text';
import { pickRecipeImage } from '@/features/recipes/data/household-recipe-images';
import {
  computeMentionUsage,
  type MentionableIngredient,
  matchPendingMention,
  mentionedIngredientIds,
} from '@/features/recipes/domain/ingredient-mentions';
import type { IngredientComponentGroup, WizardStepItem } from './types';

function flattenIngredients(components: IngredientComponentGroup[]): MentionableIngredient[] {
  const result: MentionableIngredient[] = [];
  for (const comp of components) {
    for (const item of comp.items) {
      // item.product ist nur bei einer frisch abgeschlossenen OFF-Suche
      // gesetzt. Beim Bearbeiten geladene Zutaten haben stattdessen
      // productQuery/existingProductId (siehe recipe-create-screen.tsx-
      // Hydration) — ohne diesen Fallback wuerden sie hier fehlen.
      const name = item.product?.name ?? (item.existingProductId ? item.productQuery : null);
      if (!name) continue;
      const quantity = Number.parseFloat(item.quantity);
      result.push({
        itemId: item.id,
        name,
        unit: item.unit,
        quantity: Number.isNaN(quantity) ? 0 : quantity,
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
  const [expanded, setExpanded] = useState(true);
  if (ingredients.length === 0) return null;

  const doneCount = ingredients.filter((i) => (used.get(i.itemId) ?? 0) >= i.quantity).length;

  return (
    <View
      className="mb-two pb-two"
      style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
      <Pressable
        className="flex-row items-center justify-between py-one"
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Zutatenliste einklappen' : 'Zutatenliste ausklappen'}>
        <Txt variant="micro" tone="secondary" className="tracking-widest" weight="700">
          ZUTATEN
        </Txt>
        <View className="flex-row items-center gap-two">
          {!expanded ? (
            <Txt variant="caption" tone="secondary">
              {doneCount}/{ingredients.length} aufgebraucht
            </Txt>
          ) : null}
          <Txt variant="captionCompact" tone="secondary">
            {expanded ? '▾' : '▸'}
          </Txt>
        </View>
      </Pressable>

      {expanded ? (
        <View className="gap-[6px] pt-one">
          {ingredients.map((ing) => {
            const usedAmount = used.get(ing.itemId) ?? 0;
            const pct =
              ing.quantity > 0 ? Math.min(100, Math.round((usedAmount / ing.quantity) * 100)) : 0;
            const full = ing.quantity > 0 && usedAmount >= ing.quantity;
            const remaining = Math.max(0, ing.quantity - usedAmount);
            return (
              <View key={ing.itemId}>
                <View className="flex-row items-baseline justify-between gap-two">
                  <Txt
                    variant="body"
                    weight="700"
                    style={
                      full
                        ? { color: colors.textMuted, textDecorationLine: 'line-through' }
                        : undefined
                    }>
                    {ing.name}
                  </Txt>
                  <Txt
                    variant="caption"
                    tone={full ? 'success' : 'secondary'}
                    weight={full ? '600' : undefined}>
                    {full ? 'aufgebraucht' : `${remaining}${ing.unit} übrig`}
                  </Txt>
                </View>
                <View
                  className="h-[2px] rounded-hairline overflow-hidden"
                  style={{ backgroundColor: colors.border }}>
                  <View
                    className="h-full"
                    style={{ width: `${pct}%`, backgroundColor: colors.basil }}
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

interface RecipeWizardStepStepsProps {
  steps: WizardStepItem[];
  onStepsChange: (steps: WizardStepItem[]) => void;
  components: IngredientComponentGroup[];
  onBack: () => void;
  onNext: () => void;
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
  const autocomplete = pendingAutocomplete(step.text, ingredients);

  function handleChangeText(text: string) {
    onUpdateStep(step.id, { text, ingredientIds: mentionedIngredientIds(text, ingredients) });
  }

  function insertMention(ingredient: MentionableIngredient) {
    const pending = matchPendingMention(step.text);
    if (!pending) return;
    const triggerPos = step.text.length - 1 - pending.query.length;
    handleChangeText(`${step.text.slice(0, triggerPos)}@${ingredient.name}`);
  }

  return (
    <View
      className="rounded-sheet p-[11px] mb-three gap-[10px]"
      style={{ backgroundColor: colors.surface }}>
      <View className="row-center gap-[10px]">
        <TouchableOpacity
          onLongPress={drag}
          className="p-one"
          accessibilityLabel="Schritt verschieben">
          <Txt variant="heading" tone="secondary">
            ≡
          </Txt>
        </TouchableOpacity>
        <Txt variant="label" tone="primary" weight="700" className="flex-1">
          Schritt {index + 1}
        </Txt>
        <TouchableOpacity
          onPress={() => onRemoveStep(step.id)}
          className="w-9 h-9 rounded-sheet items-center justify-center"
          style={{ backgroundColor: colors.surfaceSoft }}
          accessibilityRole="button"
          accessibilityLabel="Delete step">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
              stroke={colors.text}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      <View className="relative">
        <TextInput
          className="rounded-card min-h-[132px] px-four py-three"
          style={{
            backgroundColor: colors.bg,
            color: colors.text,
            fontSize: 15,
            lineHeight: 21,
          }}
          value={step.text}
          onChangeText={handleChangeText}
          placeholder={`Was ist in Schritt ${index + 1} zu tun? Zutat mit @ einfügen, z. B. @Wurst50`}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />
        {autocomplete ? (
          <View className="mention-panel">
            {autocomplete.matches.slice(0, 6).map((ing) => (
              <TouchableOpacity
                key={ing.itemId}
                className="mention-row"
                onPress={() => insertMention(ing)}>
                <Txt variant="body" weight="700">
                  {ing.name}{' '}
                  <Txt variant="caption" tone="secondary">
                    · {ing.quantity}
                    {ing.unit}
                  </Txt>
                </Txt>
              </TouchableOpacity>
            ))}
            <View className="mention-hint">
              <Txt variant="caption" tone="secondary">
                Danach direkt eine Zahl tippen, z. B. „{autocomplete.matches[0].name}50“
              </Txt>
            </View>
          </View>
        ) : null}
      </View>

      {step.text.trim() ? (
        <StepMentionText
          text={step.text}
          ingredients={ingredients}
          variant="caption"
          tone="secondary"
          className="px-one"
        />
      ) : null}

      {step.localImageUri ? (
        <View className="gap-[6px]">
          <Image
            source={{ uri: step.localImageUri }}
            // expo-image benötigt inline Dimensionen
            style={{ width: '100%', height: 140, borderRadius: 12 }}
            contentFit="cover"
          />
          <TouchableOpacity
            className="self-start"
            onPress={() => onUpdateStep(step.id, { localImageUri: null, existingImagePath: null })}>
            <Txt variant="label" tone="primary" weight="600">
              Bild entfernen
            </Txt>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity className="self-start" onPress={() => onPickImage(step.id)}>
          <Txt variant="label" tone="primary" weight="600">
            + Bild hinzufügen
          </Txt>
        </TouchableOpacity>
      )}

      <StepTimerField
        minutes={step.timerMinutes}
        onChange={(minutes) => onUpdateStep(step.id, { timerMinutes: minutes })}
      />
    </View>
  );
});

interface StepTimerFieldProps {
  minutes: number | null;
  onChange: (minutes: number | null) => void;
}

function StepTimerField({ minutes, onChange }: StepTimerFieldProps) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  if (minutes !== null) {
    return (
      <View className="row-center gap-two">
        <Txt variant="label" tone="primary" weight="600">
          ⏱ {minutes} Min. Timer
        </Txt>
        <TouchableOpacity onPress={() => onChange(null)}>
          <Txt variant="label" tone="primary" weight="600">
            Entfernen
          </Txt>
        </TouchableOpacity>
      </View>
    );
  }

  if (editing) {
    return (
      <View className="row-center gap-two">
        <TextInput
          className="rounded-card px-three py-two w-[70px]"
          style={{ backgroundColor: colors.bg, color: colors.text, fontSize: 15, lineHeight: 21 }}
          value={draft}
          onChangeText={setDraft}
          placeholder="Min."
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          autoFocus
          onSubmitEditing={() => {
            const parsed = Number.parseInt(draft, 10);
            if (parsed > 0) onChange(parsed);
            setDraft('');
            setEditing(false);
          }}
        />
        <TouchableOpacity
          onPress={() => {
            const parsed = Number.parseInt(draft, 10);
            if (parsed > 0) onChange(parsed);
            setDraft('');
            setEditing(false);
          }}>
          <Txt variant="label" tone="primary" weight="600">
            Übernehmen
          </Txt>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setDraft('');
            setEditing(false);
          }}>
          <Txt variant="label" tone="secondary" weight="600">
            Abbrechen
          </Txt>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity className="self-start" onPress={() => setEditing(true)}>
      <Txt variant="label" tone="primary" weight="600">
        + Timer hinzufügen
      </Txt>
    </TouchableOpacity>
  );
}

export function RecipeWizardStepSteps({
  steps,
  onStepsChange,
  components,
  onBack,
  onNext,
}: RecipeWizardStepStepsProps) {
  const { colors } = useTheme();
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
        localImageUri: null,
        existingImagePath: null,
        timerMinutes: null,
        ingredientIds: [],
      },
    ]);
  }

  async function pickImageFor(stepId: string) {
    const uri = await pickRecipeImage();
    if (uri) updateStep(stepId, { localImageUri: uri });
  }

  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    onStepsChange(reorderItems(steps, from, to));
  }

  return (
    <View className="flex-1 px-four">
      <Txt
        variant="micro"
        tone="secondary"
        className="pt-two pb-[6px] tracking-widest"
        weight="500">
        SCHRITT 3 VON 4
      </Txt>
      <Txt variant="heading" className="mb-one">
        Zubereitungsschritte
      </Txt>
      <Txt variant="label" tone="secondary" className="mb-two">
        Zutat mit @ einfügen (z. B. @Wurst50 = 50 g Wurst). Zum Umsortieren einen Schritt gedrückt
        halten und ziehen.
      </Txt>

      <IngredientLedger ingredients={ingredients} used={used} />

      <ReorderableList
        className="flex-1"
        contentContainerClassName="pb-six"
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
            <TouchableOpacity
              className="w-full h-[42px] rounded-fam-large items-center justify-center mt-one mb-seven active:opacity-75"
              style={{ backgroundColor: colors.surface }}
              onPress={addStep}>
              <Txt variant="captionCompact" tone="primary" weight="600">
                + Schritt hinzufügen
              </Txt>
            </TouchableOpacity>

            <View className="flex-row gap-[14px] mb-three">
              <Pressable
                className="flex-1 min-h-[48px] rounded-card items-center justify-center active:opacity-75"
                style={{ backgroundColor: colors.surface }}
                onPress={onBack}>
                <Txt variant="captionCompact" tone="primary" weight="600">
                  Zurück
                </Txt>
              </Pressable>
              <Pressable
                className="flex-1 min-h-[48px] rounded-card items-center justify-center active:opacity-75"
                style={{ backgroundColor: colors.basil }}
                accessibilityRole="button"
                onPress={onNext}>
                <Txt variant="captionCompact" tone="onAccent" weight="600">
                  Weiter
                </Txt>
              </Pressable>
            </View>
          </>
        }
      />
    </View>
  );
}
