import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { updateProfile } from '@/features/auth/api';
import { fieldErrors, profileSchema } from '@/features/auth/auth-schemas';
import { useSession } from '@/features/auth/session-provider';
import { useTheme } from '@/hooks/use-theme';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Kaum Bewegung' },
  { value: 'light', label: 'Leicht aktiv' },
  { value: 'moderate', label: 'Mäßig aktiv' },
  { value: 'active', label: 'Aktiv' },
  { value: 'very_active', label: 'Sehr aktiv' },
] as const;

const SEX_OPTIONS = [
  { value: 'male', label: 'Männlich' },
  { value: 'female', label: 'Weiblich' },
] as const;

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            // Nochmal antippen hebt die Auswahl auf — sonst gaebe es keinen Weg
            // zurueck zu "keine Angabe", und die Angabe ist freiwillig.
            onPress={() => onChange(selected ? undefined : option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.choice,
              {
                backgroundColor: selected ? theme.accent : theme.backgroundElement,
                borderColor: selected ? theme.accent : theme.border,
              },
            ]}>
            <ThemedText type="small" style={selected ? styles.choiceSelected : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Profil-Onboarding (#57).
 *
 * Jedes Feld ist freiwillig. Die App muss mit einem unvollstaendigen Profil
 * funktionieren — fehlt etwas, meldet die Kalorienberechnung spaeter ehrlich
 * "nicht berechenbar" (#81), statt einen Wert zu raten.
 */
export function OnboardingScreen() {
  const { session } = useSession();

  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | undefined>();
  const [activityLevel, setActivityLevel] = useState<
    (typeof ACTIVITY_LEVELS)[number]['value'] | undefined
  >();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (loading || !session) return;

    setFormError(null);
    const parsed = profileSchema.safeParse({
      displayName: displayName.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      heightCm: heightCm.trim() ? Number(heightCm.replace(',', '.')) : undefined,
      sex,
      activityLevel,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setLoading(true);
    const { error } = await updateProfile(session.user.id, parsed.data);
    setLoading(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    router.replace('/');
  }

  return (
    <Screen title="Dein Profil" subtitle="Alles freiwillig — du kannst es später ergänzen">
      <Card>
        <View style={styles.form}>
          <TextField
            label="Name"
            value={displayName}
            onChangeText={setDisplayName}
            error={errors.displayName}
            autoCapitalize="words"
            placeholder="Wie sollen dich andere sehen?"
          />

          <TextField
            label="Geburtsdatum"
            value={birthDate}
            onChangeText={setBirthDate}
            error={errors.birthDate}
            placeholder="JJJJ-MM-TT"
            autoCapitalize="none"
            inputMode="numeric"
          />

          <TextField
            label="Größe in cm"
            value={heightCm}
            onChangeText={setHeightCm}
            error={errors.heightCm}
            placeholder="178"
            inputMode="numeric"
            keyboardType="number-pad"
          />
        </View>
      </Card>

      <Card title="Berechnungsbasis">
        <ThemedText type="small" themeColor="textSecondary">
          Wird nur für die Schätzung deines Kalorienbedarfs verwendet. Ohne Angabe setzt du dein
          Ziel später selbst.
        </ThemedText>
        <ChoiceRow options={SEX_OPTIONS} value={sex} onChange={setSex} />
      </Card>

      <Card title="Wie aktiv bist du?">
        <ChoiceRow options={ACTIVITY_LEVELS} value={activityLevel} onChange={setActivityLevel} />
      </Card>

      {formError ? (
        <ThemedText type="small" themeColor="danger">
          {formError}
        </ThemedText>
      ) : null}

      <Button label="Speichern" onPress={handleSubmit} loading={loading} />
      <Button label="Später ausfüllen" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  choice: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  choiceSelected: {
    color: '#ffffff',
  },
});
