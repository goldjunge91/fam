import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, TextField, Txt } from '@/constants/ui';
import {
  addFoodSelection,
  createCustomFoodSelection,
  customFoodLabelSchema,
  type FoodSelection,
} from '@/features/profile/domain/food-rules';

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
  const { colors } = useTheme();
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
      <View className="profile-food-rules-sheet-backdrop">
        <View className="profile-food-rules-sheet" style={{ backgroundColor: colors.surface }}>
          <View className="modal-handle" />
          <View className="profile-food-rules-sheet-header">
            <View className="flex-1 gap-half">
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
              className="modal-close-btn">
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-two">
            {filteredPresets.map((preset, index) => {
              const selected = isPresetSelected(preset.code);
              return (
                <Pressable
                  key={preset.code}
                  onPress={() => togglePreset(preset.code)}
                  role="checkbox"
                  aria-label={preset.label}
                  aria-checked={selected}
                  className="profile-food-rules-option"
                  style={{
                    backgroundColor: selected ? colors.basilSoft : colors.surface,
                    borderBottomColor: colors.border,
                    borderBottomWidth: index < filteredPresets.length - 1 ? 1 : 0,
                  }}>
                  <Txt variant="body" className="flex-1">
                    {preset.label}
                  </Txt>
                  <View
                    className="checkbox-base"
                    style={{
                      backgroundColor: selected ? colors.basil : 'transparent',
                      borderColor: colors.basil,
                      borderWidth: 1.5,
                    }}>
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
                <View key={selection.normalizedLabel} className="profile-food-rules-custom-row">
                  <Txt variant="body" className="flex-1">
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
                    className="profile-food-rules-remove">
                    <Txt variant="caption" tone="secondary">
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
