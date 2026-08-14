import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import {
  DIETARY_TAGS,
  DIFFICULTIES,
  DISH_TYPES,
} from '@/features/recipes/wizard/recipe-metadata-options';

import { useApplyRecipeTemplateMutation, useRecipeTemplateDetail } from './use-recipe-templates';

const DIFFICULTY_LABELS = Object.fromEntries(DIFFICULTIES.map((d) => [d.value, d.label]));
const DISH_TYPE_LABELS = Object.fromEntries(DISH_TYPES.map((d) => [d.value, d.label]));
const DIETARY_TAG_LABELS = Object.fromEntries(DIETARY_TAGS.map((d) => [d.value, d.label]));

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#FF5262"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#332222" strokeWidth={2} />
      <Path d="M12 7v5l3 3" stroke="#332222" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Vorschau eines vorgefertigten Rezepts ("Vorlage"), erreichbar direkt aus
 * der Rezepte-Übersicht (recipes-screen.tsx) — keine eigene "Vorlagen"-Liste,
 * die Vorschläge erscheinen dort als ganz normale Rezept-Karten. Der primäre
 * CTA hier kopiert die Vorlage in den aktiven Haushalt.
 */
export function RecipeTemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeHouseholdId } = useActiveHousehold();
  const { session } = useSession();
  const [isApplying, setIsApplying] = useState(false);

  const { data: template, isLoading } = useRecipeTemplateDetail(id);
  const applyTemplate = useApplyRecipeTemplateMutation();

  const handleCopy = async () => {
    if (!template || !activeHouseholdId || !session?.user.id) return;
    setIsApplying(true);
    try {
      const recipe = await applyTemplate.mutateAsync({
        template,
        household_id: activeHouseholdId,
        created_by: session.user.id,
      });
      router.replace({ pathname: '/recipe/detail', params: { id: recipe.id } });
    } catch (error) {
      Alert.alert(
        'Fehler',
        error instanceof Error ? error.message : 'Rezept konnte nicht kopiert werden.',
      );
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading || !template) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Zurück">
            <BackIcon />
          </TouchableOpacity>
        </View>
        <ActivityIndicator style={styles.loading} color="#FF5262" />
      </SafeAreaView>
    );
  }

  const allTags = [...template.dish_types, ...template.dietary_tags];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurück">
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {template.title}
        </Text>
        <View style={styles.headerIconButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{template.title}</Text>

        <View style={styles.badgeRow}>
          {template.difficulty ? (
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{DIFFICULTY_LABELS[template.difficulty]}</Text>
            </View>
          ) : null}
          {template.cook_time_minutes ? (
            <View style={styles.timeBadge}>
              <ClockIcon />
              <Text style={styles.timeText}>{template.cook_time_minutes}min</Text>
            </View>
          ) : null}
          {allTags.map((tag) => (
            <View key={tag} style={styles.badgePillAlt}>
              <Text style={styles.badgePillAltText}>
                {DISH_TYPE_LABELS[tag] ?? DIETARY_TAG_LABELS[tag] ?? tag}
              </Text>
            </View>
          ))}
        </View>

        {template.instructions ? (
          <Text style={styles.instructions}>{template.instructions}</Text>
        ) : null}

        <Text style={styles.sectionLabel}>Zutaten</Text>
        {template.components.map((component) => (
          <View key={component.id} style={styles.componentBlock}>
            {template.components.length > 1 ? (
              <Text style={styles.componentName}>{component.name}</Text>
            ) : null}
            {component.items.map((item) => (
              <View key={item.id} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{item.product_name ?? 'Zutat'}</Text>
                <Text style={styles.ingredientAmount}>
                  {item.quantity ?? item.grams} {item.unit}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {template.steps.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Zubereitung</Text>
            {template.steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                <Text style={styles.stepIndex}>{String(step.position + 1).padStart(2, '0')}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.copyButton, isApplying && styles.copyButtonDisabled]}
          onPress={handleCopy}
          disabled={isApplying || !activeHouseholdId}
          accessibilityRole="button"
          accessibilityLabel="In meine Rezepte kopieren">
          {isApplying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.copyButtonText}>In meine Rezepte kopieren</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFDF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerIconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#332222' },
  loading: { marginTop: 60 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: '700', color: '#332222', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  badgePill: {
    backgroundColor: '#FFE2E2',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgePillText: { fontSize: 12, fontWeight: '600', color: '#FF5262' },
  badgePillAlt: {
    backgroundColor: '#F3E8FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgePillAltText: { fontSize: 12, fontWeight: '600', color: '#9B51E0' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 13, color: '#332222' },
  instructions: { fontSize: 14, color: '#665555', marginBottom: 16, lineHeight: 20 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#332222',
    marginTop: 12,
    marginBottom: 8,
  },
  componentBlock: { marginBottom: 8 },
  componentName: { fontSize: 13, fontWeight: '600', color: '#9B51E0', marginBottom: 4 },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE2E2',
  },
  ingredientName: { fontSize: 14, color: '#332222', flex: 1 },
  ingredientAmount: { fontSize: 14, color: '#665555' },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepIndex: { fontSize: 13, fontWeight: '700', color: '#FF5262', width: 24 },
  stepText: { flex: 1, fontSize: 14, color: '#332222', lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: '#FFFDF9',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE2E2',
  },
  copyButton: {
    backgroundColor: '#FF5262',
    borderRadius: 24,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonDisabled: { opacity: 0.6 },
  copyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
