import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, TextField, Txt } from '@/constants/ui';
import {
  addFoodSelection,
  createCustomFoodSelection,
  customFoodLabelSchema,
  type FoodSelection,
} from '@/features/profile/domain/food-rules';
import { foodRuleSelectionSheetStyles } from '@/features/profile/sheets/food-rule-selection-sheet-styles';

type FoodPreset<Code extends string> = {
  code: Code;
  label: string;
};

type FoodRuleSelectionSheetProps<Code extends string> = {
  visible: boolean;
  title: string;
  inputLabel: string;
  presets: readonly FoodPreset<Code>[];
  value: FoodSelection<Code>[];
  onApply: (value: FoodSelection<Code>[]) => void;
  onClose: () => void;
};

function normalizedComparison(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

export function FoodRuleSelectionSheet<Code extends string>({
  visible,
  title,
  inputLabel,
  presets,
  value,
  onApply,
  onClose,
}: FoodRuleSelectionSheetProps<Code>) {
  const [draft, setDraft] = useState<FoodSelection<Code>[]>(value);
  const [query, setQuery] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setQuery('');
    setInputError(null);
  }, [value, visible]);

  const normalizedQuery = normalizedComparison(query);
  const filteredPresets = useMemo(
    () =>
      normalizedQuery
        ? presets.filter(({ label }) => normalizedComparison(label).includes(normalizedQuery))
        : presets,
    [normalizedQuery, presets],
  );

  function isPresetSelected(code: Code) {
    return draft.some((selection) => selection.source === 'preset' && selection.code === code);
  }

  function togglePreset(code: Code) {
    setDraft((current) => {
      const selected = current.some(
        (selection) => selection.source === 'preset' && selection.code === code,
      );

      return selected
        ? current.filter((selection) => selection.source !== 'preset' || selection.code !== code)
        : addFoodSelection(current, { source: 'preset', code });
    });
  }

  function addCustomEntry() {
    const parsed = customFoodLabelSchema.safeParse(query);
    if (!parsed.success) {
      setInputError(parsed.error.issues[0]?.message ?? 'Bitte prüfe den Eintrag.');
      return;
    }

    const matchingPreset = presets.find(
      ({ label }) => normalizedComparison(label) === parsed.data.toLocaleLowerCase('de-DE'),
    );

    setDraft((current) =>
      matchingPreset
        ? addFoodSelection(current, { source: 'preset', code: matchingPreset.code })
        : addFoodSelection(current, createCustomFoodSelection(parsed.data)),
    );
    setQuery('');
    setInputError(null);
  }

  const parsedQuery = customFoodLabelSchema.safeParse(query);
  const addLabel = parsedQuery.success ? `${parsedQuery.data} hinzufügen` : 'Eintrag hinzufügen';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={foodRuleSelectionSheetStyles.backdrop}>
        <View style={foodRuleSelectionSheetStyles.sheet}>
          <View style={foodRuleSelectionSheetStyles.handle} />
          <View style={foodRuleSelectionSheetStyles.header}>
            <View style={foodRuleSelectionSheetStyles.headerCopy}>
              <Txt variant="heading">{title}</Txt>
              <Txt variant="caption" tone="secondary">
                {presets.length > 0
                  ? 'Häufige auswählen oder eigene ergänzen'
                  : 'Eigene Lebensmittel ergänzen'}
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              role="button"
              aria-label={`${title} schließen`}
              style={foodRuleSelectionSheetStyles.closeButton}>
              <Txt variant="body" tone="secondary" aria-hidden>
                ✕
              </Txt>
            </Pressable>
          </View>

          <TextField
            value={query}
            onChangeText={(nextValue) => {
              setQuery(nextValue);
              setInputError(null);
            }}
            placeholder={inputLabel}
            error={inputError ?? undefined}
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={addCustomEntry}
          />
          {inputError ? (
            <Txt role="alert" variant="caption" tone="danger">
              {inputError}
            </Txt>
          ) : null}
          <Button title={addLabel} variant="secondary" onPress={addCustomEntry} />

          <ScrollView
            style={foodRuleSelectionSheetStyles.options}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={foodRuleSelectionSheetStyles.optionsContent}>
            {filteredPresets.map((preset, index) => {
              const selected = isPresetSelected(preset.code);
              return (
                <Pressable
                  key={preset.code}
                  onPress={() => togglePreset(preset.code)}
                  role="checkbox"
                  aria-label={preset.label}
                  aria-checked={selected}
                  style={[
                    foodRuleSelectionSheetStyles.option,
                    selected && foodRuleSelectionSheetStyles.optionSelected,
                    index < filteredPresets.length - 1 &&
                      foodRuleSelectionSheetStyles.optionBordered,
                  ]}>
                  <Txt variant="body" style={foodRuleSelectionSheetStyles.optionLabel}>
                    {preset.label}
                  </Txt>
                  <View
                    style={[
                      foodRuleSelectionSheetStyles.checkbox,
                      selected && foodRuleSelectionSheetStyles.checkboxSelected,
                    ]}>
                    {selected ? (
                      <Txt variant="caption" tone="onAccent">
                        ✓
                      </Txt>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            {draft
              .filter((selection) => selection.source === 'custom')
              .map((selection) => (
                <View
                  key={selection.normalizedLabel}
                  style={foodRuleSelectionSheetStyles.customRow}>
                  <Txt variant="body" style={foodRuleSelectionSheetStyles.customLabel}>
                    {selection.label}
                  </Txt>
                  <Pressable
                    onPress={() =>
                      setDraft((current) =>
                        current.filter(
                          (item) =>
                            item.source !== 'custom' ||
                            item.normalizedLabel !== selection.normalizedLabel,
                        ),
                      )
                    }
                    role="button"
                    aria-label={`${selection.label} entfernen`}
                    style={foodRuleSelectionSheetStyles.removeButton}>
                    <Txt variant="label" tone="primary" weight="700">
                      Entfernen
                    </Txt>
                  </Pressable>
                </View>
              ))}
          </ScrollView>

          <Button
            title="Auswahl übernehmen"
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
