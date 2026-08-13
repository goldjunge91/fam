import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
      if (item.product) {
        ingredientLabelById.set(item.id, `${item.product.name} (${comp.title})`);
      }
    }
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
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
                .filter((item) => item.product)
                .map((item) => (
                  <Text key={item.id} style={styles.ingredientLine}>
                    • {item.product?.name} — {item.quantity} {unitLabel(item.unit)}
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
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  coverCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#FFE2E2',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderText: {
    color: '#B4898B',
    fontSize: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2A181A',
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFE2E2',
    borderRadius: 18,
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
    backgroundColor: '#FF5262',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF5262',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    gap: 12,
  },
  description: {
    fontSize: 15,
    color: '#332222',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#332222',
    backgroundColor: '#FFE2E2',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#FF5262',
    backgroundColor: '#FFF0EF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  hashtags: {
    fontSize: 13,
    color: '#8A6E70',
  },
  componentSection: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A181A',
  },
  ingredientLine: {
    fontSize: 14,
    color: '#332222',
  },
  stepCard: {
    backgroundColor: '#FFF6F2',
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  stepIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF5262',
  },
  stepImage: {
    width: '100%',
    height: 140,
    borderRadius: 14,
  },
  stepText: {
    fontSize: 14,
    color: '#332222',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF5262',
    backgroundColor: '#FFE2E2',
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
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPrimary: {
    backgroundColor: '#FF5262',
  },
  navButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonSecondary: {
    backgroundColor: '#FFE2E2',
  },
  navButtonSecondaryText: {
    color: '#FF5262',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
});
