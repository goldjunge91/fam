import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontSize } from '@/components/themed-text';

import type { DietaryTag, Difficulty, DishType } from '@/features/recipes/use-recipes';
import { UNIT_OPTIONS } from '@/lib/units';
import { DIETARY_TAGS, DIFFICULTIES, DISH_TYPES } from './recipe-metadata-options';
import type { IngredientComponentGroup, WizardStepItem } from './types';

function unitLabel(unit: string): string {
  return UNIT_OPTIONS.find((o) => o.value === unit)?.label ?? unit;
}

function labelFor<T extends string>(options: { value: T; label: string }[], value: T): string {
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
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>SCHRITT 4 VON 4</Text>
      <Text style={styles.pageTitle}>Vorschau</Text>
      <View style={styles.coverCard}>
        {coverPreviewUri ? (
          <Image
            source={{ uri: coverPreviewUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <Text style={styles.coverPlaceholderText}>Kein Titelbild</Text>
        )}
      </View>

      <Text style={styles.title}>{title || 'Ohne Titel'}</Text>

      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setTab('ingredients')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'ingredients' }}
          style={[styles.tab, tab === 'ingredients' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'ingredients' && styles.tabTextActive]}>
            Zutaten
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('instructions')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'instructions' }}
          style={[styles.tab, tab === 'instructions' && styles.tabActive]}>
          <Text style={[styles.tabText, tab === 'instructions' && styles.tabTextActive]}>
            Anleitung
          </Text>
        </Pressable>
      </View>

      {tab === 'ingredients' ? (
        <View style={styles.tabContent}>
          {description ? <Text style={styles.description}>{description}</Text> : null}

          <View style={styles.metaRow}>
            {cookTimeMinutes ? (
              <Text style={styles.metaBadge}>⏱ {cookTimeMinutes} Min.</Text>
            ) : null}
            <Text style={styles.metaBadge}>🍽 {defaultServings} Portionen</Text>
            {difficulty ? (
              <Text style={styles.metaBadge}>{labelFor(DIFFICULTIES, difficulty)}</Text>
            ) : null}
          </View>

          {dishTypes.length > 0 || dietaryTags.length > 0 ? (
            <View style={styles.tagRow}>
              {dishTypes.map((d) => (
                <Text key={d} style={styles.tag}>
                  {labelFor(DISH_TYPES, d)}
                </Text>
              ))}
              {dietaryTags.map((d) => (
                <Text key={d} style={styles.tag}>
                  {labelFor(DIETARY_TAGS, d)}
                </Text>
              ))}
            </View>
          ) : null}

          {hashtagsInput.trim() ? <Text style={styles.hashtags}>{hashtagsInput}</Text> : null}

          {components.map((comp) => (
            <View key={comp.id} style={styles.componentSection}>
              <Text style={styles.sectionLabel}>{comp.title}</Text>
              {comp.items
                .filter((item) => item.product || item.existingProductId)
                .map((item) => (
                  <Text key={item.id} style={styles.ingredientLine}>
                    • {item.product?.name ?? item.productQuery} — {item.quantity}{' '}
                    {unitLabel(item.unit)}
                  </Text>
                ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.tabContent}>
          {steps
            .filter((step) => step.text.trim())
            .map((step, index) => (
              <View key={step.id} style={styles.stepCard}>
                <Text style={styles.stepIndex}>Schritt {index + 1}</Text>
                {step.localImageUri ? (
                  <Image
                    source={{ uri: step.localImageUri }}
                    style={styles.stepImage}
                    contentFit="cover"
                  />
                ) : null}
                <Text style={styles.stepText}>{step.text}</Text>
                {step.ingredientIds.length > 0 ? (
                  <View style={styles.chipRow}>
                    {step.ingredientIds.map((id) => (
                      <Text key={id} style={styles.chip}>
                        {ingredientLabelById.get(id) ?? id}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
        </View>
      )}

      <View style={styles.navRow}>
        <Pressable style={[styles.navButton, styles.navButtonSecondary]} onPress={onBack}>
          <Text style={styles.navButtonSecondaryText}>Zurück</Text>
        </Pressable>
        <Pressable
          style={[styles.navButton, styles.navButtonPrimary, saving && styles.navButtonDisabled]}
          onPress={onSave}
          disabled={saving}>
          <Text style={styles.navButtonPrimaryText}>{saving ? 'Speichert…' : 'Speichern'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  eyebrow: {
    paddingTop: 8,
    ...FontSize[8],
    lineHeight: 10,
    fontWeight: '500',
    color: '#766E78',
    letterSpacing: 0.7,
  },
  pageTitle: {
    paddingTop: 6,
    paddingBottom: 12,
    ...FontSize[21],
    lineHeight: 25,
    fontWeight: '700',
    color: '#302A31',
    letterSpacing: -0.35,
  },
  coverCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#EEE5EC',
    borderRadius: 19,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    color: '#786F79',
    ...FontSize[14],
  },
  title: {
    ...FontSize[22],
    fontWeight: '700',
    color: '#302A31',
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#EEE5EC',
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#705773',
  },
  tabText: {
    ...FontSize[14],
    fontWeight: '600',
    color: '#705773',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    gap: 12,
  },
  description: {
    ...FontSize[15],
    color: '#302A31',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaBadge: {
    ...FontSize[13],
    fontWeight: '600',
    color: '#302A31',
    backgroundColor: '#EEE5EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    ...FontSize[12],
    fontWeight: '600',
    color: '#705773',
    backgroundColor: '#F2EBF1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  hashtags: {
    ...FontSize[13],
    color: '#786F79',
  },
  componentSection: {
    gap: 4,
  },
  sectionLabel: {
    ...FontSize[15],
    fontWeight: '700',
    color: '#302A31',
  },
  ingredientLine: {
    ...FontSize[14],
    color: '#302A31',
  },
  stepCard: {
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderRadius: 19,
    borderCurve: 'continuous',
    padding: 12,
    gap: 8,
  },
  stepIndex: {
    ...FontSize[13],
    fontWeight: '700',
    color: '#705773',
  },
  stepImage: {
    width: '100%',
    height: 140,
    borderRadius: 14,
  },
  stepText: {
    ...FontSize[14],
    color: '#302A31',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    ...FontSize[12],
    fontWeight: '600',
    color: '#705773',
    backgroundColor: '#EEE5EC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  navRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
    marginBottom: 12,
  },
  navButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPrimary: {
    backgroundColor: '#705773',
  },
  navButtonPrimaryText: {
    color: '#FFFFFF',
    ...FontSize[11],
    fontWeight: '600',
  },
  navButtonSecondary: {
    backgroundColor: '#EEE5EC',
  },
  navButtonSecondaryText: {
    color: '#705773',
    ...FontSize[11],
    fontWeight: '600',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
});
