import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';

import { Button, Press, TextField, Txt } from '@/constants/ui';
import {
  addFoodSelection,
  createCustomFoodSelection,
  customFoodLabelSchema,
  type FoodSelection,
  getFoodRuleLabel,
} from '@/features/profile/domain/food-rules';
import { foodRuleSelectionSheetStyles } from '@/features/profile/sheets/food-rule-selection-sheet-styles';

type FoodPreset<Code extends string> = {
  code: Code;
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

function normalizedComparison(value: string, locale: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(locale);
}

function translateFoodRuleError(
  t: ReturnType<typeof useTranslation>['t'],
  message: string,
): string {
  if (message === 'Bitte gib ein Lebensmittel ein.') return t('profile.foodRules.validationEmpty');
  if (message === 'Der Eintrag darf höchstens 80 Zeichen lang sein.') {
    return t('profile.foodRules.validationTooLong');
  }
  return message;
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
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<FoodSelection<Code>[]>(value);
  const [query, setQuery] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setQuery('');
    setInputError(null);
  }, [value, visible]);

  const normalizedQuery = normalizedComparison(query, i18n.language);
  const filteredPresets = useMemo(
    () =>
      normalizedQuery
        ? presets.filter(({ code }) =>
            normalizedComparison(getFoodRuleLabel(t, code), i18n.language).includes(
              normalizedQuery,
            ),
          )
        : presets,
    [i18n.language, normalizedQuery, presets, t],
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
      setInputError(
        translateFoodRuleError(
          t,
          parsed.error.issues[0]?.message ?? t('profile.foodRules.validationEmpty'),
        ),
      );
      return;
    }

    const matchingPreset = presets.find(
      ({ code }) =>
        normalizedComparison(getFoodRuleLabel(t, code), i18n.language) ===
        normalizedComparison(parsed.data, i18n.language),
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
  const addLabel = parsedQuery.success
    ? t('profile.foodRules.add', { value: parsedQuery.data })
    : t('profile.foodRules.addGeneric');

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
                  ? t('profile.foodRules.commonHint')
                  : t('profile.foodRules.customHint')}
              </Txt>
            </View>
            <Press
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`${title} ${t('common.actions.close').toLocaleLowerCase(i18n.language)}`}
              style={foodRuleSelectionSheetStyles.closeButton}>
              <Txt
                variant="body"
                tone="secondary"
                accessibilityElementsHidden={true}
                importantForAccessibility="no">
                ✕
              </Txt>
            </Press>
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
          <Button title={addLabel} variant="secondary" onPress={addCustomEntry} />

          <ScrollView
            style={foodRuleSelectionSheetStyles.options}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={foodRuleSelectionSheetStyles.optionsContent}>
            {filteredPresets.map((preset, index) => {
              const selected = isPresetSelected(preset.code);
              const label = getFoodRuleLabel(t, preset.code);
              return (
                <Press
                  key={preset.code}
                  onPress={() => togglePreset(preset.code)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected }}
                  style={[
                    foodRuleSelectionSheetStyles.option,
                    selected && foodRuleSelectionSheetStyles.optionSelected,
                    index < filteredPresets.length - 1 &&
                      foodRuleSelectionSheetStyles.optionBordered,
                  ]}>
                  <Txt variant="body" style={foodRuleSelectionSheetStyles.optionLabel}>
                    {label}
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
                </Press>
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
                  <Press
                    onPress={() =>
                      setDraft((current) =>
                        current.filter(
                          (item) =>
                            item.source !== 'custom' ||
                            item.normalizedLabel !== selection.normalizedLabel,
                        ),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.foodRules.remove', { value: selection.label })}
                    style={foodRuleSelectionSheetStyles.removeButton}>
                    <Txt variant="label" tone="primary" weight="700">
                      {t('common.actions.remove')}
                    </Txt>
                  </Press>
                </View>
              ))}
          </ScrollView>

          <Button
            title={t('profile.foodRules.apply')}
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
