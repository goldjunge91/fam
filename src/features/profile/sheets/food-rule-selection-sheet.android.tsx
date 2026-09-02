import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import { Button } from '@/components/ui/buttons';
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
        <ThemedView className="profile-food-rules-sheet">
          <View className="modal-handle" />
          <View className="profile-food-rules-sheet-header">
            <View className="flex-1 gap-half">
              <ThemedText type="headingSmall">{title}</ThemedText>
              <ThemedText type="smallMuted">
                {presets.length > 0
                  ? 'Häufige auswählen oder eigene ergänzen'
                  : 'Eigene Lebensmittel ergänzen'}
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              role="button"
              aria-label={`${title} schließen`}
              className="modal-close-btn">
              <ThemedText aria-hidden>✕</ThemedText>
            </Pressable>
          </View>

          <TextField
            value={query}
            onChangeText={(nextValue) => {
              setQuery(nextValue);
              setInputError(null);
            }}
            placeholder={inputLabel}
            accessibilityHint={inputError ?? undefined}
            className={inputError ? 'input-field-error' : ''}
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={addCustomEntry}
          />
          {inputError ? (
            <ThemedText role="alert" type="smallDanger">
              {inputError}
            </ThemedText>
          ) : null}
          <Button label={addLabel} variant="secondary" onPress={addCustomEntry} />

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
                  className={`profile-food-rules-option ${
                    index < filteredPresets.length - 1 ? 'profile-food-rules-option-bordered' : ''
                  }`}>
                  <ThemedText className="flex-1">{preset.label}</ThemedText>
                  <View
                    className={`checkbox-base ${
                      selected ? 'checkbox-checked' : 'checkbox-unchecked'
                    }`}>
                    {selected ? (
                      <ThemedText type="caption" themeColor="onAccent">
                        ✓
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            {draft
              .filter((selection) => selection.source === 'custom')
              .map((selection) => (
                <View key={selection.normalizedLabel} className="profile-food-rules-custom-row">
                  <ThemedText className="flex-1">{selection.label}</ThemedText>
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
                    <ThemedText type="smallMuted">Entfernen</ThemedText>
                  </Pressable>
                </View>
              ))}
          </ScrollView>

          <Button
            label="Auswahl übernehmen"
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </ThemedView>
      </View>
    </Modal>
  );
}
