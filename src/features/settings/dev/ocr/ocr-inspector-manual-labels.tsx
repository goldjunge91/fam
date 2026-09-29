import { useState } from 'react';
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
  { value: 'article', label: 'Artikel' },
  { value: 'quantity', label: 'Menge' },
  { value: 'unitPrice', label: 'Preis/Stk' },
  { value: 'price', label: 'Preis' },
] as const satisfies ReadonlyArray<{ value: ManualLabelField; label: string }>;

const FIELD_LABELS: Record<ManualLabelField, string> = {
  article: 'Artikel',
  quantity: 'Menge',
  unitPrice: 'Preis/Stk',
  price: 'Preis',
};

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
  const { colors } = useTheme();
  const [field, setField] = useState<ManualLabelField>('article');

  function toggle(index: number): void {
    const current = selection[field];
    const next = current.includes(index)
      ? current.filter((selectedIndex) => selectedIndex !== index)
      : [...current, index];
    onChange({ ...selection, [field]: next });
  }

  return (
    <View style={styles.root}>
      <SegmentedControl
        label="Zielfeld"
        selected={field}
        options={FIELD_OPTIONS}
        onSelect={(nextField) => setField(nextField)}
        size="compact"
      />
      <Txt variant="caption" tone="secondary" style={styles.hint} selectable>
        Tippe OCR-Zeilen an, um sie zum ausgewählten Feld zu kombinieren. Menge und Preise bleiben
        optional.
      </Txt>
      {FIELD_OPTIONS.map(({ value }) => {
        const valueText = manualLabelText(lines, selection[value]);
        return valueText ? (
          <View key={value} style={styles.selection}>
            <Txt variant="caption" tone="secondary">
              {FIELD_LABELS[value]}
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
            accessibilityLabel={`${selected ? 'Ausgewählt' : 'Auswählen'} für ${FIELD_LABELS[field]}: ${line.text}`}
            onPress={() => toggle(index)}
            style={[styles.line, selected && styles.lineSelected]}>
            <View style={styles.lineContent}>
              <Txt variant="body" numberOfLines={2}>
                {index + 1}. {line.text}
              </Txt>
              <Txt variant="caption" color={selected ? colors.accent : colors.textSecondary}>
                {selected ? `${FIELD_LABELS[field]} ausgewählt` : 'antippen zum Zuordnen'}
              </Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
