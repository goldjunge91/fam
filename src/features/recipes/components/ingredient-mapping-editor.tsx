import { useMemo, useState } from 'react';
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
        accessibilityLabel={`Zutatenzuordnung prüfen, ${selectedIds.length} Zutaten ausgewählt`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}>
        <Txt variant="caption" tone={currentReview ? 'primary' : 'secondary'} weight="600">
          {currentReview
            ? `Zuordnung geprüft · ${mapping.ingredientIds.length}`
            : selectedIds.length > 0
              ? `Zuordnung offen · ${selectedIds.length} gewählt`
              : 'Zutatenzuordnung prüfen'}
        </Txt>
      </Press>
      {sourceText ? (
        <Txt variant="caption" tone="secondary">
          Importtext: {sourceText}
        </Txt>
      ) : null}
      {extractionConfidence ? (
        <Txt variant="caption" tone="secondary">
          KI-Erkennung:{' '}
          {extractionConfidence === 'high'
            ? 'hoch'
            : extractionConfidence === 'medium'
              ? 'mittel'
              : 'niedrig'}
        </Txt>
      ) : null}
      {expanded ? (
        <View style={styles.editor}>
          <Txt variant="caption" weight="700">
            Vollständige Zutatenliste
          </Txt>
          <Txt variant="caption" tone="secondary">
            Ordne jede Zutat der geprüften Basis zu. Das bestätigt die Zutatenidentität, keine
            Allergenfreiheit.
          </Txt>
          <TextField
            accessibilityLabel="Beleg der Zutatenliste"
            value={evidenceSnapshot}
            onChangeText={updateEvidence}
            placeholder="Vollständige Zutatenliste oder geprüfter Quellenausschnitt"
            multiline
            numberOfLines={4}
            maxLength={12_000}
            textAlignVertical="top"
          />
          <TextField
            accessibilityLabel="Zutat aus der geprüften Basis suchen"
            value={search}
            onChangeText={setSearch}
            placeholder="Kanonische Zutat suchen"
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
                    {selected ? '✓  ' : ''}
                    {ingredient.canonical_name}
                  </Txt>
                </Press>
              );
            })}
          </ScrollView>
          {isFetching && ingredients.length === 0 ? (
            <Txt variant="caption" tone="secondary">
              Zutatenbasis wird geladen.
            </Txt>
          ) : null}
          {isError && ingredients.length === 0 ? (
            <Txt variant="caption" tone="danger">
              Die geprüfte Zutatenbasis ist nicht verfügbar.
            </Txt>
          ) : null}
          {source === null ? (
            <Txt variant="caption" tone="secondary">
              Für diese Quelle fehlt eine stabile Version. Die Zuordnung bleibt offen.
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
              Vollständige Zutatenliste bestätigen
            </Txt>
          </Press>
          {currentReview ? (
            <Press
              style={styles.trigger}
              accessibilityRole="button"
              onPress={() => onChange({ ...UNKNOWN_INGREDIENT_MAPPING })}>
              <Txt variant="caption" tone="secondary">
                Zuordnung zurücksetzen
              </Txt>
            </Press>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
