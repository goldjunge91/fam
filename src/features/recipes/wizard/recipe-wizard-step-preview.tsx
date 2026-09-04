import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
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
  const { colors } = useTheme();
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
      <Txt variant="micro" tone="secondary" className="pt-two tracking-widest" weight="500">
        SCHRITT 4 VON 4
      </Txt>
      <Txt variant="heading" className="pt-[6px] pb-three">
        Vorschau
      </Txt>
      <View
        className="w-full h-[200px] rounded-sheet overflow-hidden mb-four justify-center items-center"
        style={{ backgroundColor: colors.backgroundElement }}>
        {coverPreviewUri ? (
          <Image
            source={{ uri: coverPreviewUri }}
            // expo-image unterstützt kein NativeWind absoluteFill
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            contentFit="cover"
          />
        ) : (
          <Txt variant="body" tone="secondary">
            Kein Titelbild
          </Txt>
        )}
      </View>

      <Txt variant="heading" className="mb-four">
        {title || 'Ohne Titel'}
      </Txt>

      <View
        className="flex-row rounded-fam-large p-one mb-four"
        style={{ backgroundColor: colors.backgroundElement }}>
        <Pressable
          onPress={() => setTab('ingredients')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'ingredients' }}
          className="flex-1 py-[10px] rounded-fam-large items-center"
          style={{ backgroundColor: tab === 'ingredients' ? colors.accent : 'transparent' }}>
          <Txt
            variant="bodyRelaxed"
            tone={tab === 'ingredients' ? 'onAccent' : 'primary'}
            weight="600">
            Zutaten
          </Txt>
        </Pressable>
        <Pressable
          onPress={() => setTab('instructions')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'instructions' }}
          className="flex-1 py-[10px] rounded-fam-large items-center"
          style={{ backgroundColor: tab === 'instructions' ? colors.accent : 'transparent' }}>
          <Txt
            variant="bodyRelaxed"
            tone={tab === 'instructions' ? 'onAccent' : 'primary'}
            weight="600">
            Anleitung
          </Txt>
        </Pressable>
      </View>

      {tab === 'ingredients' ? (
        <View className="gap-three">
          {description ? <Txt variant="body">{description}</Txt> : null}

          <View className="row-wrap gap-two">
            {cookTimeMinutes ? (
              <View
                className="px-three py-[6px] rounded-fam-large"
                style={{ backgroundColor: colors.backgroundElement }}>
                <Txt variant="label" weight="600">
                  ⏱ {cookTimeMinutes} Min.
                </Txt>
              </View>
            ) : null}
            <View
              className="px-three py-[6px] rounded-fam-large"
              style={{ backgroundColor: colors.backgroundElement }}>
              <Txt variant="label" weight="600">
                🍽 {defaultServings} Portionen
              </Txt>
            </View>
            {difficulty ? (
              <View
                className="px-three py-[6px] rounded-fam-large"
                style={{ backgroundColor: colors.backgroundElement }}>
                <Txt variant="label" weight="600">
                  {labelFor(DIFFICULTIES, difficulty)}
                </Txt>
              </View>
            ) : null}
          </View>

          {dishTypes.length > 0 || dietaryTags.length > 0 ? (
            <View className="row-wrap gap-two">
              {dishTypes.map((d) => (
                <View
                  key={d}
                  className="px-[10px] py-[5px] rounded-control"
                  style={{ backgroundColor: colors.backgroundSelected }}>
                  <Txt variant="captionCompact" tone="primary" weight="600">
                    {labelFor(DISH_TYPES, d)}
                  </Txt>
                </View>
              ))}
              {dietaryTags.map((d) => (
                <View
                  key={d}
                  className="px-[10px] py-[5px] rounded-control"
                  style={{ backgroundColor: colors.backgroundSelected }}>
                  <Txt variant="captionCompact" tone="primary" weight="600">
                    {labelFor(DIETARY_TAGS, d)}
                  </Txt>
                </View>
              ))}
            </View>
          ) : null}

          {hashtagsInput.trim() ? (
            <Txt variant="label" tone="secondary">
              {hashtagsInput}
            </Txt>
          ) : null}

          {components.map((comp) => (
            <View key={comp.id} className="gap-one">
              <Txt variant="body" weight="700">
                {comp.title}
              </Txt>
              {comp.items
                .filter((item) => item.product || item.existingProductId)
                .map((item) => (
                  <Txt key={item.id} variant="body">
                    • {item.product?.name ?? item.productQuery} — {item.quantity}{' '}
                    {unitLabel(item.unit)}
                  </Txt>
                ))}
            </View>
          ))}
        </View>
      ) : (
        <View className="gap-three">
          {steps
            .filter((step) => step.text.trim())
            .map((step, index) => (
              <View
                key={step.id}
                className="rounded-sheet p-three gap-two"
                style={{ backgroundColor: colors.backgroundElement }}>
                <Txt variant="label" tone="primary" weight="700">
                  Schritt {index + 1}
                </Txt>
                {step.localImageUri ? (
                  <Image
                    source={{ uri: step.localImageUri }}
                    // expo-image benötigt inline styles
                    style={{ width: '100%', height: 140, borderRadius: 12 }}
                    contentFit="cover"
                  />
                ) : null}
                <Txt variant="body">{step.text}</Txt>
                {step.timerMinutes !== null ? (
                  <Txt variant="caption" tone="secondary">
                    ⏱ {step.timerMinutes} Min. Timer
                  </Txt>
                ) : null}
                {step.ingredientIds.length > 0 ? (
                  <View className="row-wrap gap-[6px]">
                    {step.ingredientIds.map((id) => (
                      <View
                        key={id}
                        className="px-[10px] py-one rounded-control"
                        style={{ backgroundColor: colors.backgroundElement }}>
                        <Txt variant="captionCompact" tone="primary" weight="600">
                          {ingredientLabelById.get(id) ?? id}
                        </Txt>
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
          className="flex-1 min-h-[48px] rounded-card items-center justify-center active:opacity-75"
          style={{ backgroundColor: colors.backgroundElement }}
          onPress={onBack}>
          <Txt variant="captionCompact" tone="primary" weight="600">
            Zurück
          </Txt>
        </Pressable>
        <Pressable
          className="flex-1 min-h-[48px] rounded-card items-center justify-center active:opacity-75"
          style={{ backgroundColor: colors.accent, opacity: saving ? 0.5 : 1 }}
          accessibilityRole="button"
          onPress={onSave}
          disabled={saving}>
          <Txt variant="captionCompact" tone="onAccent" weight="600">
            {saving ? 'Speichert…' : 'Speichern'}
          </Txt>
        </Pressable>
      </View>
    </ScrollView>
  );
}
