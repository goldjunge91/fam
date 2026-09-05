import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { TextField, Txt } from '@/constants/ui';

const POSTAL_CODE_PATTERN = /^\d{5}$/;

type PostalCodeEditorProps = {
  onSubmit: (postalCode: string) => Promise<void>;
  onCancel?: () => void;
};

/** Inline-Formular für die manuelle PLZ-Eingabe, Alternative zum GPS-Standort im Angebote-Bereich. */
export function PostalCodeEditor({ onSubmit, onCancel }: PostalCodeEditorProps) {
  const { colors } = useTheme();
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isValid = POSTAL_CODE_PATTERN.test(value);

  async function handleSubmit() {
    if (!isValid) {
      setError('Bitte eine gültige 5-stellige PLZ eingeben.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch {
      setError('PLZ konnte nicht gespeichert werden.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextField
        label="PLZ"
        value={value}
        onChangeText={(text) => setValue(text.replace(/\D/g, '').slice(0, 5))}
        keyboardType="number-pad"
        maxLength={5}
        placeholder="z. B. 10115"
        error={error ?? undefined}
      />
      <View style={styles.actions}>
        <Pressable
          role="button"
          disabled={!isValid || isSubmitting}
          onPress={handleSubmit}
          style={[
            styles.button,
            { backgroundColor: colors.basil, opacity: !isValid || isSubmitting ? 0.5 : 1 },
          ]}>
          <Txt variant="body" tone="inverse" weight="700">
            {isSubmitting ? 'Speichert...' : 'Übernehmen'}
          </Txt>
        </Pressable>
        {onCancel ? (
          <Pressable role="button" onPress={onCancel} style={styles.button}>
            <Txt variant="body" tone="secondary" weight="600">
              Abbrechen
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    width: '100%',
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 18,
  },
});
