import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { updateProfile, useProfile } from '@/features/auth/api';
import { fieldErrors, getDeviceDateFormat, profileSchema } from '@/features/auth/auth-schemas';
import { useSession } from '@/features/auth/session-provider';
import type { ActivityLevel } from '@/features/onboarding/types';
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

export function EditProfileScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isLoading: profileLoading } = useProfile(userId);
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (profile) {
      if (profile.display_name) setDisplayName(profile.display_name);
      if (profile.birth_date) {
        const parts = profile.birth_date.split('-');
        if (parts.length === 3) {
          setBirthDate(`${parts[2]}.${parts[1]}.${parts[0]}`);
        } else {
          setBirthDate(profile.birth_date);
        }
      }
      if (profile.height_cm) setHeightCm(String(profile.height_cm));
      if (profile.sex) setSex(profile.sex as 'male' | 'female');
      if (profile.activity_level) setActivityLevel(profile.activity_level as ActivityLevel);
    }
  }, [profile]);

  async function handleSubmit() {
    if (loading || !userId) return;

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
    const { error } = await updateProfile(userId, parsed.data);
    setLoading(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    Alert.alert('Erfolg', 'Dein Profil wurde erfolgreich aktualisiert.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <Screen title="Profil bearbeiten" back={{ label: 'Einstellungen', href: '/settings' }}>
      <Card title="Persönliche Angaben">
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
            placeholder={getDeviceDateFormat().placeholder}
            autoCapitalize="none"
          />

          <TextField
            label="Größe in cm"
            value={heightCm}
            onChangeText={setHeightCm}
            error={errors.heightCm}
            placeholder="178"
            autoCapitalize="none"
          />
        </View>
      </Card>

      <Card title="Berechnungsbasis">
        <ThemedText type="small" themeColor="textSecondary">
          Wird für die Schätzung deines Kalorienbedarfs verwendet.
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

      <Button label="Profil speichern" onPress={handleSubmit} loading={loading || profileLoading} />
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
