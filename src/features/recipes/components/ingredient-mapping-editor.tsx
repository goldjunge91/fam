import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, TextField, Txt } from '@/constants/ui';
import {
  type IngredientMappingReview,
  type IngredientMappingSourceContext,
  isCurrentIngredientMappingReview,
  UNKNOWN_INGREDIENT_MAPPING,
} from '../domain/ingredient-mapping';
import { useFoodIngredients } from '../hooks/use-food-ingredients';

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.sm,
  },
  trigger: {
    alignSelf: 'flex-start',
    minHeight: rs(40),
    justifyContent: 'center',
  },
  editor: {
    gap: theme.space.sm,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundSoft,
  },
  selectedNames: {
    gap: theme.space.xs,
  },
  results: {
    gap: theme.space.xs,
    maxHeight: rs(208),
  },
  result: {
    minHeight: rs(40),
    justifyContent: 'center',
    paddingHorizontal: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  confirm: {
    minHeight: theme.controlSizes.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
  },
}));

type IngredientMappingEditorProps = {
  itemId: string;
  sourceText: string | null;
  extractionConfidence?: 'high' | 'medium' | 'low';
  mapping: IngredientMappingReview;
  evidenceSnapshot: string;
  source: IngredientMappingSourceContext | null;
  reviewerId: string | undefined;
  onChange: (mapping: IngredientMappingReview) => void;
  onEvidenceChange: (evidence: string) => void;
};

export function IngredientMappingEditor({
  itemId,
  sourceText,
  extractionConfidence,
  mapping,
  evidenceSnapshot,
  source,
  reviewerId,
  onChange,
  onEvidenceChange,
}: IngredientMappingEditorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    mapping.status === 'verified' ? [...mapping.ingredientIds] : [],
  );
  const { data: ingredients = [], isError, isFetching } = useFoodIngredients();
  const currentReview = isCurrentIngredientMappingReview(mapping, source);
  const selectedNames = useMemo(
    () =>
      selectedIds.map(
        (id) => ingredients.find((ingredient) => ingredient.id === id)?.canonical_name ?? id,
      ),
    [ingredients, selectedIds],
  );
  const visibleIngredients = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('de-DE');
    return ingredients
      .filter(
        (ingredient) =>
          !normalizedSearch ||
          ingredient.canonical_name.toLocaleLowerCase('de-DE').includes(normalizedSearch),
      )
      .slice(0, 24);
  }, [ingredients, search]);
  const canVerify =
    !!reviewerId &&
    !!source &&
    !!source.sourceVersion.trim() &&
    !!evidenceSnapshot.trim() &&
    selectedIds.length > 0;

  function toggleIngredient(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id],
    );
    onChange({ ...UNKNOWN_INGREDIENT_MAPPING });
  }

  function updateEvidence(value: string) {
    onEvidenceChange(value);
    onChange({ ...UNKNOWN_INGREDIENT_MAPPING });
  }

  function confirmMapping() {
    if (!canVerify || !source || !reviewerId) return;
    onChange({
      version: 1,
      status: 'verified',
      ingredientIds: [...selectedIds],
      complete: true,
      ...source,
      evidenceSnapshot: evidenceSnapshot.trim(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerId,
    });
  }

  return (
    <View style={styles.root} key={itemId}>
      <Press
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel={t('recipes.mapping.checkAccessibility', { count: selectedIds.length })}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}>
        <Txt variant="caption" tone={currentReview ? 'primary' : 'secondary'} weight="600">
          {currentReview
            ? t('recipes.mapping.checked', { count: mapping.ingredientIds.length })
            : selectedIds.length > 0
              ? t('recipes.mapping.open', { count: selectedIds.length })
              : t('recipes.mapping.check')}
        </Txt>
      </Press>
      {sourceText ? (
        <Txt variant="caption" tone="secondary">
          {t('recipes.mapping.sourceText', { text: sourceText })}
        </Txt>
      ) : null}
      {extractionConfidence ? (
        <Txt variant="caption" tone="secondary">
          {t('recipes.mapping.confidence', {
            value: t(`recipes.mapping.${extractionConfidence}`),
          })}
        </Txt>
      ) : null}
      {expanded ? (
        <View style={styles.editor}>
          <Txt variant="caption" weight="700">
            {t('recipes.mapping.listTitle')}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {t('recipes.mapping.listHint')}
          </Txt>
          <TextField
            accessibilityLabel={t('recipes.mapping.evidenceLabel')}
            value={evidenceSnapshot}
            onChangeText={updateEvidence}
            placeholder={t('recipes.mapping.evidencePlaceholder')}
            multiline
            numberOfLines={4}
            maxLength={12_000}
            textAlignVertical="top"
          />
          <TextField
            accessibilityLabel={t('recipes.mapping.searchLabel')}
            value={search}
            onChangeText={setSearch}
            placeholder={t('recipes.mapping.searchPlaceholder')}
          />
          {selectedNames.length > 0 ? (
            <View style={styles.selectedNames}>
              {selectedNames.map((name) => (
                <Txt key={`${itemId}-${name}`} variant="caption" weight="600">
                  {name}
                </Txt>
              ))}
            </View>
          ) : null}
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {visibleIngredients.map((ingredient) => {
              const selected = selectedIds.includes(ingredient.id);
              return (
                <Press
                  key={ingredient.id}
                  style={[
                    styles.result,
                    { backgroundColor: selected ? colors.accent : colors.backgroundElement },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleIngredient(ingredient.id)}>
                  <Txt variant="caption" tone={selected ? 'onAccent' : 'secondary'}>
                    {selected ? t('recipes.mapping.selected') : ''}
                    {ingredient.canonical_name}
                  </Txt>
                </Press>
              );
            })}
          </ScrollView>
          {isFetching && ingredients.length === 0 ? (
            <Txt variant="caption" tone="secondary">
              {t('recipes.mapping.loading')}
            </Txt>
          ) : null}
          {isError && ingredients.length === 0 ? (
            <Txt variant="caption" tone="danger">
              {t('recipes.mapping.unavailable')}
            </Txt>
          ) : null}
          {source === null ? (
            <Txt variant="caption" tone="secondary">
              {t('recipes.mapping.missingSource')}
            </Txt>
          ) : null}
          <Press
            style={[
              styles.confirm,
              { backgroundColor: colors.accent, opacity: canVerify ? 1 : 0.45 },
            ]}
            accessibilityRole="button"
            disabled={!canVerify}
            onPress={confirmMapping}>
            <Txt variant="caption" tone="onAccent" weight="700">
              {t('recipes.mapping.confirm')}
            </Txt>
          </Press>
          {currentReview ? (
            <Press
              style={styles.trigger}
              accessibilityRole="button"
              onPress={() => onChange({ ...UNKNOWN_INGREDIENT_MAPPING })}>
              <Txt variant="caption" tone="secondary">
                {t('recipes.mapping.reset')}
              </Txt>
            </Press>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
