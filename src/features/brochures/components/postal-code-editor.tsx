import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, TextField, Txt } from '@/constants/ui';

const POSTAL_CODE_PATTERN = /^\d{5}$/;

type PostalCodeEditorProps = {
  onSubmit: (postalCode: string) => Promise<void>;
  onCancel?: () => void;
};

/** Inline-Formular für die manuelle PLZ-Eingabe, Alternative zum GPS-Standort im Prospekte-Bereich. */
export function PostalCodeEditor({ onSubmit, onCancel }: PostalCodeEditorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isValid = POSTAL_CODE_PATTERN.test(value);

  async function handleSubmit() {
    if (!isValid) {
      setError(t('brochures.postalCode.invalid'));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch {
      setError(t('brochures.postalCode.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextField
        label={t('brochures.postalCode.label')}
        value={value}
        onChangeText={(text) => setValue(text.replace(/\D/g, '').slice(0, 5))}
        keyboardType="number-pad"
        maxLength={5}
        placeholder={t('brochures.postalCode.placeholder')}
        error={error ?? undefined}
      />
      <View style={styles.actions}>
        <Press
          accessibilityRole="button"
          accessibilityLabel={t('brochures.postalCode.applyAccessibility')}
          disabled={!isValid || isSubmitting}
          onPress={handleSubmit}
          style={[
            styles.button,
            { backgroundColor: colors.accent, opacity: !isValid || isSubmitting ? 0.5 : 1 },
          ]}>
          <Txt variant="body" tone="onAccent" weight="700">
            {isSubmitting ? t('brochures.postalCode.saving') : t('brochures.postalCode.apply')}
          </Txt>
        </Press>
        {onCancel ? (
          <Press
            accessibilityRole="button"
            accessibilityLabel={t('brochures.postalCode.cancelAccessibility')}
            onPress={onCancel}
            style={styles.button}>
            <Txt variant="body" tone="secondary" weight="600">
              {t('brochures.postalCode.cancel')}
            </Txt>
          </Press>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.sm,
    width: '100%',
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
});
