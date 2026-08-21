import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Pressable, TextInput, TouchableOpacity, View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import Svg, { Path } from 'react-native-svg';
import { ThemedText } from '@/components/theme/themed-text';
import { StepMentionText } from '@/features/recipes/components/step-mention-text';
import {
  computeMentionUsage,
  type MentionableIngredient,
  matchPendingMention,
  mentionedIngredientIds,
} from '@/features/recipes/ingredient-mentions';
import { pickRecipeImage } from '@/features/recipes/recipe-image-uploader';
import { useTheme } from '@/hooks/use-theme';
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

/**
 * Filtert die Autovervollstaendigungs-Treffer fuer eine gerade getippte
 * Erwaehnung — und unterdrueckt sie, sobald der einzige Treffer exakt dem
 * bereits eingefuegten Namen entspricht (sonst bliebe das Menue nach der
 * Auswahl sichtbar, siehe justSelectedValueRef-Muster in
 * product-search-dropdown.tsx, hier ohne Extra-State geloest).
 */
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

/**
 * Immer sichtbare (nicht mitscrollende), einklappbare Zutatenuebersicht
 * oberhalb der Zubereitungsschritte — zeigt live, wie viel jeder Zutat schon
 * per @-Erwaehnung in den Schritten zugeordnet ist.
 */
function IngredientLedger({ ingredients, used }: IngredientLedgerProps) {
  const [expanded, setExpanded] = useState(true);
  if (ingredients.length === 0) return null;

  const doneCount = ingredients.filter((i) => (used.get(i.itemId) ?? 0) >= i.quantity).length;

  return (
    <View className="mb-two pb-two border-b-hairline border-border">
      <Pressable
        className="flex-row items-center justify-between py-one"
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Zutatenliste einklappen' : 'Zutatenliste ausklappen'}>
        <ThemedText
          type="detail"
          themeColor="textSecondary"
          className="text-[9px] leading-[11px] font-bold tracking-widest">
          ZUTATEN
        </ThemedText>
        <View className="flex-row items-center gap-two">
          {!expanded ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {doneCount}/{ingredients.length} aufgebraucht
            </ThemedText>
          ) : null}
          <ThemedText themeColor="textSecondary" className="text-[11px]">
            {expanded ? '▾' : '▸'}
          </ThemedText>
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
                  <ThemedText
                    type="detail"
                    className={`font-bold ${full ? 'line-through text-text-secondary' : ''}`}>
                    {ing.name}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    themeColor={full ? 'success' : 'textSecondary'}
                    className={full ? 'font-semibold' : undefined}>
                    {full ? 'aufgebraucht' : `${remaining}${ing.unit} übrig`}
                  </ThemedText>
                </View>
                <View className="h-[2px] rounded-hairline bg-border overflow-hidden">
                  <View className="h-full bg-accent" style={{ width: `${pct}%` }} />
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
  const theme = useTheme();
  const autocomplete = pendingAutocomplete(step.text, ingredients);

  function handleChangeText(text: string) {
    onUpdateStep(step.id, { text, ingredientIds: mentionedIngredientIds(text, ingredients) });
  }

  function insertMention(ingredient: MentionableIngredient) {
    const pending = matchPendingMention(step.text);
    if (!pending) return;
    const triggerPos = step.text.length - 1 - pending.query.length;
    handleChangeText(step.text.slice(0, triggerPos) + '@' + ingredient.name);
  }

  return (
    <View className="bg-white/70 rounded-sheet p-[11px] mb-three gap-[10px]">
      <View className="row-center gap-[10px]">
        <TouchableOpacity
          onLongPress={drag}
          className="p-one"
          accessibilityLabel="Schritt verschieben">
          <ThemedText type="headingSmall" themeColor="textSecondary">
            ≡
          </ThemedText>
        </TouchableOpacity>
        <ThemedText type="label" themeColor="accent" className="flex-1 font-bold">
          Schritt {index + 1}
        </ThemedText>
        <TouchableOpacity
          onPress={() => onRemoveStep(step.id)}
          className="w-9 h-9 rounded-sheet bg-background-element items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Delete step">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
              stroke={theme.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      <View className="relative">
        <TextInput
          className="bg-white rounded-card min-h-[132px] px-four py-three text-[15px] text-text"
          value={step.text}
          onChangeText={handleChangeText}
          placeholder={`Was ist in Schritt ${index + 1} zu tun? Zutat mit @ einfügen, z. B. @Wurst50`}
          placeholderTextColor={theme.textSecondary}
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
                <ThemedText type="detail" className="font-semibold">
                  {ing.name}{' '}
                  <ThemedText type="detail" themeColor="textSecondary">
                    · {ing.quantity}
                    {ing.unit}
                  </ThemedText>
                </ThemedText>
              </TouchableOpacity>
            ))}
            <View className="mention-hint">
              <ThemedText type="caption" themeColor="textSecondary">
                Danach direkt eine Zahl tippen, z. B. „{autocomplete.matches[0].name}50“
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>

      {step.text.trim() ? (
        <StepMentionText
          text={step.text}
          ingredients={ingredients}
          type="detail"
          themeColor="textSecondary"
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
            <ThemedText type="label" themeColor="accent" className="font-semibold">
              Bild entfernen
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity className="self-start" onPress={() => onPickImage(step.id)}>
          <ThemedText type="label" themeColor="accent" className="font-semibold">
            + Bild hinzufügen
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
});

export function RecipeWizardStepSteps({
  steps,
  onStepsChange,
  components,
  onBack,
  onNext,
}: RecipeWizardStepStepsProps) {
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
      <ThemedText
        type="detail"
        themeColor="textSecondary"
        className="pt-two pb-[6px] text-[8px] leading-[10px] font-medium tracking-widest">
        SCHRITT 3 VON 4
      </ThemedText>
      <ThemedText type="headingSmall" className="mb-one">
        Zubereitungsschritte
      </ThemedText>
      <ThemedText type="label" themeColor="textSecondary" className="mb-two">
        Zutat mit @ einfügen (z. B. @Wurst50 = 50 g Wurst). Zum Umsortieren einen Schritt gedrückt
        halten und ziehen.
      </ThemedText>

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
              className="w-full h-[42px] bg-background-element rounded-fam-large items-center justify-center mt-one mb-seven active:opacity-75"
              onPress={addStep}>
              <ThemedText type="detail" themeColor="accent" className="font-semibold">
                + Schritt hinzufügen
              </ThemedText>
            </TouchableOpacity>

            <View className="flex-row gap-[14px] mb-three">
              <Pressable
                className="flex-1 min-h-[48px] rounded-card items-center justify-center bg-background-element active:opacity-75"
                onPress={onBack}>
                <ThemedText type="captionCompact" themeColor="accent" className="font-semibold">
                  Zurück
                </ThemedText>
              </Pressable>
              <Pressable
                className="flex-1 min-h-[48px] rounded-card items-center justify-center bg-accent active:opacity-75"
                onPress={onNext}>
                <ThemedText type="captionCompact" className="text-white font-semibold">
                  Weiter
                </ThemedText>
              </Pressable>
            </View>
          </>
        }
      />
    </View>
  );
}
