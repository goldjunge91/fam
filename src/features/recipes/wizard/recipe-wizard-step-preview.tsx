import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import type { DietaryTag, Difficulty, DishType } from '@/features/recipes/hooks/use-recipes';
import { UNIT_OPTIONS } from '@/lib/units';
import { DIETARY_TAGS, DIFFICULTIES, DISH_TYPES } from './recipe-metadata-options';
import type { IngredientComponentGroup, WizardStepItem } from './types';

function unitLabel(unit: string): string {
  return UNIT_OPTIONS.find((o) => o.value === unit)?.label ?? unit;
}

function labelFor<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

interface RecipeWizardStepPreviewProps {
  coverPreviewUri: string | null;
  title: string;
  description: string;
  cookTimeMinutes: string;
  defaultServings: number;
  difficulty: Difficulty | null;
  dishTypes: DishType[];
  dietaryTags: DietaryTag[];
  hashtagsInput: string;
  components: IngredientComponentGroup[];
  steps: WizardStepItem[];
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
}

type PreviewTab = 'ingredients' | 'instructions';

export function RecipeWizardStepPreview({
  coverPreviewUri,
  title,
  description,
  cookTimeMinutes,
  defaultServings,
  difficulty,
  dishTypes,
  dietaryTags,
  hashtagsInput,
  components,
  steps,
  saving,
  onBack,
  onSave,
}: RecipeWizardStepPreviewProps) {
  const [tab, setTab] = useState<PreviewTab>('ingredients');

  // Schluessel ist die lokale IngredientItem.id, nicht die (erst beim
  // finalen Speichern entstehende) DB-item-ID — siehe Kommentar in
  // recipe-wizard-step-steps.tsx.
  const ingredientLabelById = new Map<string, string>();
  for (const comp of components) {
    for (const item of comp.items) {
      // item.product ist nur bei einer frisch abgeschlossenen OFF-Suche
      // gesetzt. Beim Bearbeiten geladene Zutaten haben stattdessen
      // productQuery/existingProductId (siehe recipe-create-screen.tsx-
      // Hydration) — ohne diesen Fallback fehlten sie hier komplett bzw.
      // zeigten nur ihre rohe ID.
      const name = item.product?.name ?? (item.existingProductId ? item.productQuery : null);
      if (name) {
        ingredientLabelById.set(item.id, `${name} (${comp.title})`);
      }
    }
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-four pb-six"
      showsVerticalScrollIndicator={false}>
      <ThemedText
        type="detail"
        themeColor="textSecondary"
        className="pt-two text-[8px] leading-[10px] font-medium tracking-widest">
        SCHRITT 4 VON 4
      </ThemedText>
      <ThemedText type="headingSmall" className="pt-[6px] pb-three">
        Vorschau
      </ThemedText>
      <View className="w-full h-[200px] bg-background-element rounded-sheet overflow-hidden mb-four justify-center items-center">
        {coverPreviewUri ? (
          <Image
            source={{ uri: coverPreviewUri }}
            // expo-image unterstützt kein NativeWind absoluteFill
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            contentFit="cover"
          />
        ) : (
          <ThemedText type="body" themeColor="textSecondary">
            Kein Titelbild
          </ThemedText>
        )}
      </View>

      <ThemedText type="headingSmall" className="mb-four">
        {title || 'Ohne Titel'}
      </ThemedText>

      <View className="flex-row bg-background-element rounded-fam-large p-one mb-four">
        <Pressable
          onPress={() => setTab('ingredients')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'ingredients' }}
          className={`flex-1 py-[10px] rounded-fam-large items-center ${
            tab === 'ingredients' ? 'bg-accent' : ''
          }`}>
          <ThemedText
            type="body"
            themeColor={tab === 'ingredients' ? 'onAccent' : 'accent'}
            className="font-semibold">
            Zutaten
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setTab('instructions')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'instructions' }}
          className={`flex-1 py-[10px] rounded-fam-large items-center ${
            tab === 'instructions' ? 'bg-accent' : ''
          }`}>
          <ThemedText
            type="body"
            themeColor={tab === 'instructions' ? 'onAccent' : 'accent'}
            className="font-semibold">
            Anleitung
          </ThemedText>
        </Pressable>
      </View>

      {tab === 'ingredients' ? (
        <View className="gap-three">
          {description ? <ThemedText type="body">{description}</ThemedText> : null}

          <View className="row-wrap gap-two">
            {cookTimeMinutes ? (
              <View className="bg-background-element px-three py-[6px] rounded-fam-large">
                <ThemedText type="label" className="font-semibold">
                  ⏱ {cookTimeMinutes} Min.
                </ThemedText>
              </View>
            ) : null}
            <View className="bg-background-element px-three py-[6px] rounded-fam-large">
              <ThemedText type="label" className="font-semibold">
                🍽 {defaultServings} Portionen
              </ThemedText>
            </View>
            {difficulty ? (
              <View className="bg-background-element px-three py-[6px] rounded-fam-large">
                <ThemedText type="label" className="font-semibold">
                  {labelFor(DIFFICULTIES, difficulty)}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {dishTypes.length > 0 || dietaryTags.length > 0 ? (
            <View className="row-wrap gap-two">
              {dishTypes.map((d) => (
                <View key={d} className="bg-background-selected px-[10px] py-[5px] rounded-control">
                  <ThemedText type="caption" themeColor="accent" className="font-semibold">
                    {labelFor(DISH_TYPES, d)}
                  </ThemedText>
                </View>
              ))}
              {dietaryTags.map((d) => (
                <View key={d} className="bg-background-selected px-[10px] py-[5px] rounded-control">
                  <ThemedText type="caption" themeColor="accent" className="font-semibold">
                    {labelFor(DIETARY_TAGS, d)}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {hashtagsInput.trim() ? (
            <ThemedText type="label" themeColor="textSecondary">
              {hashtagsInput}
            </ThemedText>
          ) : null}

          {components.map((comp) => (
            <View key={comp.id} className="gap-one">
              <ThemedText type="bodyBold">{comp.title}</ThemedText>
              {comp.items
                .filter((item) => item.product || item.existingProductId)
                .map((item) => (
                  <ThemedText key={item.id} type="body">
                    • {item.product?.name ?? item.productQuery} — {item.quantity}{' '}
                    {unitLabel(item.unit)}
                  </ThemedText>
                ))}
            </View>
          ))}
        </View>
      ) : (
        <View className="gap-three">
          {steps
            .filter((step) => step.text.trim())
            .map((step, index) => (
              <View key={step.id} className="bg-white/70 rounded-sheet p-three gap-two">
                <ThemedText type="label" themeColor="accent" className="font-bold">
                  Schritt {index + 1}
                </ThemedText>
                {step.localImageUri ? (
                  <Image
                    source={{ uri: step.localImageUri }}
                    // expo-image benötigt inline styles
                    style={{ width: '100%', height: 140, borderRadius: 12 }}
                    contentFit="cover"
                  />
                ) : null}
                <ThemedText type="body">{step.text}</ThemedText>
                {step.timerMinutes !== null ? (
                  <ThemedText type="caption" themeColor="textSecondary">
                    ⏱ {step.timerMinutes} Min. Timer
                  </ThemedText>
                ) : null}
                {step.ingredientIds.length > 0 ? (
                  <View className="row-wrap gap-[6px]">
                    {step.ingredientIds.map((id) => (
                      <View
                        key={id}
                        className="bg-background-element px-[10px] py-one rounded-control">
                        <ThemedText type="caption" themeColor="accent" className="font-semibold">
                          {ingredientLabelById.get(id) ?? id}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
        </View>
      )}

      <View className="flex-row gap-[14px] mt-five mb-three">
        <Pressable
          className="flex-1 min-h-[48px] rounded-card items-center justify-center bg-background-element active:opacity-75"
          onPress={onBack}>
          <ThemedText type="captionCompact" themeColor="accent" className="font-semibold">
            Zurück
          </ThemedText>
        </Pressable>
        <Pressable
          className={`flex-1 min-h-[48px] rounded-card items-center justify-center bg-accent active:opacity-75 ${
            saving ? 'opacity-50' : ''
          }`}
          accessibilityRole="button"
          onPress={onSave}
          disabled={saving}>
          <ThemedText type="captionCompact" className="text-white font-semibold">
            {saving ? 'Speichert…' : 'Speichern'}
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}
