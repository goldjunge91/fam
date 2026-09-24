import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { StepRichContent } from '@/features/recipes/components/step-rich-content';
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

function RecipeStepPreview({
  step,
  index,
  ingredientLabelById,
}: {
  step: WizardStepItem;
  index: number;
  ingredientLabelById: Map<string, string>;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.stepCard, { backgroundColor: colors.backgroundElement }]}>
      <Txt variant="label" tone="primary" weight="700">
        Schritt {index + 1}
      </Txt>
      <StepRichContent
        text={step.text}
        images={[
          ...step.existingImages.map((image, imageIndex) => ({
            key: image.id ?? image.storagePath,
            path: image.storagePath,
            testID: imageIndex === 0 ? `recipe-preview-step-image-${step.id}` : undefined,
          })),
          ...step.localImageUris.map((uri, imageIndex) => ({
            key: uri,
            uri,
            testID:
              step.existingImages.length === 0 && imageIndex === 0
                ? `recipe-preview-step-image-${step.id}`
                : undefined,
          })),
        ]}
        variant="body"
      />
      {step.timerMinutes !== null ? (
        <Txt variant="caption" tone="secondary">
          ⏱ {step.timerMinutes} Min. Timer
        </Txt>
      ) : null}
      {step.ingredientIds.length > 0 ? (
        <View style={styles.stepIngredientWrap}>
          {step.ingredientIds.map((id) => (
            <View
              key={id}
              style={[styles.stepIngredient, { backgroundColor: colors.backgroundElement }]}>
              <Txt variant="caption" tone="primary" weight="600">
                {ingredientLabelById.get(id) ?? id}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: rs(24),
    paddingBottom: rs(64),
  },
  eyebrow: {
    paddingTop: rs(8),
    letterSpacing: 1.5,
  },
  heading: {
    paddingTop: rs(6),
    paddingBottom: rs(16),
  },
  cover: {
    width: '100%',
    height: rs(200),
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: rs(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: rs(24),
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: theme.radius.famLarge,
    padding: rs(4),
    marginBottom: rs(24),
  },
  tabContainer: {
    flex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderRadius: theme.radius.famLarge,
    paddingVertical: rs(10),
  },
  section: {
    gap: rs(16),
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(8),
  },
  infoChip: {
    borderRadius: theme.radius.famLarge,
    paddingHorizontal: rs(24),
    paddingVertical: rs(6),
  },
  tagChip: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: rs(10),
    paddingVertical: rs(5),
  },
  component: {
    gap: rs(4),
  },
  stepCard: {
    borderRadius: theme.radius.lg,
    padding: rs(16),
    gap: rs(8),
  },
  stepImage: {
    width: '100%',
    height: rs(140),
    borderRadius: theme.radius.sm,
  },
  stepIngredientWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(6),
  },
  stepIngredient: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
  },
  actions: {
    flexDirection: 'row',
    gap: rs(14),
    marginTop: rs(32),
    marginBottom: rs(16),
  },
  actionContainer: {
    flex: 1,
  },
  action: {
    minHeight: rs(48),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

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
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <Txt variant="caption" tone="secondary" style={styles.eyebrow} weight="500">
        SCHRITT 4 VON 4
      </Txt>
      <Txt variant="heading" style={styles.heading}>
        Vorschau
      </Txt>
      <View style={[styles.cover, { backgroundColor: colors.backgroundElement }]}>
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

      <Txt variant="heading" style={styles.title}>
        {title || 'Ohne Titel'}
      </Txt>

      <View style={[styles.tabs, { backgroundColor: colors.backgroundElement }]}>
        <Press
          onPress={() => setTab('ingredients')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'ingredients' }}
          containerStyle={styles.tabContainer}
          style={[
            styles.tab,
            { backgroundColor: tab === 'ingredients' ? colors.accent : 'transparent' },
          ]}>
          <Txt variant="body" tone={tab === 'ingredients' ? 'onAccent' : 'primary'} weight="600">
            Zutaten
          </Txt>
        </Press>
        <Press
          onPress={() => setTab('instructions')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'instructions' }}
          containerStyle={styles.tabContainer}
          style={[
            styles.tab,
            { backgroundColor: tab === 'instructions' ? colors.accent : 'transparent' },
          ]}>
          <Txt variant="body" tone={tab === 'instructions' ? 'onAccent' : 'primary'} weight="600">
            Anleitung
          </Txt>
        </Press>
      </View>

      {tab === 'ingredients' ? (
        <View style={styles.section}>
          {description ? <Txt variant="body">{description}</Txt> : null}

          <View style={styles.wrap}>
            {cookTimeMinutes ? (
              <View style={[styles.infoChip, { backgroundColor: colors.backgroundElement }]}>
                <Txt variant="label" weight="600">
                  ⏱ {cookTimeMinutes} Min.
                </Txt>
              </View>
            ) : null}
            <View style={[styles.infoChip, { backgroundColor: colors.backgroundElement }]}>
              <Txt variant="label" weight="600">
                🍽 {defaultServings} Portionen
              </Txt>
            </View>
            {difficulty ? (
              <View style={[styles.infoChip, { backgroundColor: colors.backgroundElement }]}>
                <Txt variant="label" weight="600">
                  {labelFor(DIFFICULTIES, difficulty)}
                </Txt>
              </View>
            ) : null}
          </View>

          {dishTypes.length > 0 || dietaryTags.length > 0 ? (
            <View style={styles.wrap}>
              {dishTypes.map((d) => (
                <View key={d} style={[styles.tagChip, { backgroundColor: colors.backgroundSoft }]}>
                  <Txt variant="caption" tone="primary" weight="600">
                    {labelFor(DISH_TYPES, d)}
                  </Txt>
                </View>
              ))}
              {dietaryTags.map((d) => (
                <View key={d} style={[styles.tagChip, { backgroundColor: colors.backgroundSoft }]}>
                  <Txt variant="caption" tone="primary" weight="600">
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
            <View key={comp.id} style={styles.component}>
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
        <View style={styles.section}>
          {steps
            .filter((step) => step.text.trim())
            .map((step, index) => (
              <RecipeStepPreview
                key={step.id}
                step={step}
                index={index}
                ingredientLabelById={ingredientLabelById}
              />
            ))}
        </View>
      )}

      <View style={styles.actions}>
        <Press
          containerStyle={styles.actionContainer}
          style={[styles.action, { backgroundColor: colors.backgroundElement }]}
          onPress={onBack}>
          <Txt variant="caption" tone="primary" weight="600">
            Zurück
          </Txt>
        </Press>
        <Press
          containerStyle={styles.actionContainer}
          style={[styles.action, { backgroundColor: colors.accent, opacity: saving ? 0.5 : 1 }]}
          accessibilityRole="button"
          onPress={onSave}
          disabled={saving}>
          <Txt variant="caption" tone="onAccent" weight="600">
            {saving ? 'Speichert…' : 'Speichern'}
          </Txt>
        </Press>
      </View>
    </ScrollView>
  );
}
