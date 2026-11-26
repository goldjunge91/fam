import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { SegmentedControl, Txt } from '@/constants/ui';
import type { ReceiptOcrLine } from '@/features/ocr/processing/native';

export type ManualLabelField = 'article' | 'quantity' | 'unitPrice' | 'price';
export type ManualLabelSelection = Record<ManualLabelField, readonly number[]>;

type ManualLabelAssignmentProps = {
  lines: readonly ReceiptOcrLine[];
  selection: ManualLabelSelection;
  onChange: (selection: ManualLabelSelection) => void;
};

const FIELD_OPTIONS = [
  { value: 'article', labelKey: 'dev.ocr.labels.article' },
  { value: 'quantity', labelKey: 'dev.ocr.labels.quantity' },
  { value: 'unitPrice', labelKey: 'dev.ocr.labels.unitPrice' },
  { value: 'price', labelKey: 'dev.ocr.labels.price' },
] as const satisfies ReadonlyArray<{
  value: ManualLabelField;
  labelKey:
    | 'dev.ocr.labels.article'
    | 'dev.ocr.labels.quantity'
    | 'dev.ocr.labels.unitPrice'
    | 'dev.ocr.labels.price';
}>;

const styles = StyleSheet.create((theme) => ({
  root: { gap: theme.space.sm },
  hint: { marginTop: -theme.space.xs },
  line: {
    minHeight: 48,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: radius.s,
    backgroundColor: theme.backgroundElement,
    justifyContent: 'center',
  },
  lineSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.backgroundSoft,
  },
  lineContent: { gap: space.xs },
  selection: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderRadius: radius.s,
    backgroundColor: theme.backgroundSoft,
  },
}));

export function manualLabelText(
  lines: readonly ReceiptOcrLine[],
  indexes: readonly number[],
): string {
  return indexes
    .map((index) => lines[index]?.text.trim())
    .filter((text): text is string => Boolean(text))
    .join(' ');
}

export function ManualLabelAssignment({ lines, selection, onChange }: ManualLabelAssignmentProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [field, setField] = useState<ManualLabelField>('article');

  function toggle(index: number): void {
    const current = selection[field];
    const next = current.includes(index)
      ? current.filter((selectedIndex) => selectedIndex !== index)
      : [...current, index];
    onChange({ ...selection, [field]: next });
  }

  const fieldLabel = (value: ManualLabelField) =>
    t(FIELD_OPTIONS.find((option) => option.value === value)?.labelKey ?? 'dev.ocr.labels.article');

  return (
    <View style={styles.root}>
      <SegmentedControl
        label={t('dev.ocr.labels.targetField')}
        selected={field}
        options={FIELD_OPTIONS.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))}
        onSelect={(nextField) => setField(nextField)}
        size="compact"
      />
      <Txt variant="caption" tone="secondary" style={styles.hint} selectable>
        {t('dev.ocr.labels.hint')}
      </Txt>
      {FIELD_OPTIONS.map(({ value }) => {
        const valueText = manualLabelText(lines, selection[value]);
        return valueText ? (
          <View key={value} style={styles.selection}>
            <Txt variant="caption" tone="secondary">
              {fieldLabel(value)}
            </Txt>
            <Txt variant="body" selectable>
              {valueText}
            </Txt>
          </View>
        ) : null;
      })}
      {lines.map((line, index) => {
        const selected = selection[field].includes(index);
        return (
          <Pressable
            key={`${line.text}-${line.boundingBox.x}-${line.boundingBox.y}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={t('dev.ocr.labels.selectLine', {
              state: selected ? t('dev.ocr.labels.selected') : t('dev.ocr.labels.select'),
              field: fieldLabel(field),
              text: line.text,
            })}
            onPress={() => toggle(index)}
            style={[styles.line, selected && styles.lineSelected]}>
            <View style={styles.lineContent}>
              <Txt variant="body" numberOfLines={2}>
                {index + 1}. {line.text}
              </Txt>
              <Txt variant="caption" color={selected ? colors.accent : colors.textSecondary}>
                {selected
                  ? t('dev.ocr.labels.selectedField', { field: fieldLabel(field) })
                  : t('dev.ocr.labels.tapToAssign')}
              </Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
