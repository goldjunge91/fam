import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, TextField, Txt } from '@/constants/ui';
import { useCreateHouseholdMutation } from '@/features/household/api';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

export function CreateHouseholdScreen() {
  const { t } = useTranslation();
  const [householdName, setHouseholdName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useCreateHouseholdMutation();

  async function handleSubmit() {
    const trimmed = householdName.trim();
    if (!trimmed) {
      setErrorMsg(t('household.create.nameRequired'));
      return;
    }

    setErrorMsg(null);
    try {
      // `useCreateHouseholdMutation`s onSuccess pullt den neuen Haushalt
      // bereits in den lokalen Spiegel und invalidiert die Query, bevor
      // dieses mutateAsync aufloest — kein zusaetzlicher Refetch noetig.
      await mutation.mutateAsync(trimmed);
      // Nach der Erstellung routen wir ins Dashboard.
      // Falls der Nutzer von der "Kein Haushalt"-Weiche kam, greift nun die App.
      router.replace('/');
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(t('household.create.unexpectedError'));
      }
    }
  }

  return (
    <Screen
      title={t('household.create.title')}
      subtitle={t('household.create.subtitle')}
      back={{ label: t('household.create.back') }}>
      {/* Formular zur Erstellung eines neuen Haushalts */}
      <ContentCard>
        <View style={styles.form}>
          {/* Eingabefeld für Haushaltsname */}
          <TextField
            label={t('household.create.nameLabel')}
            value={householdName}
            onChangeText={setHouseholdName}
            placeholder={t('household.create.namePlaceholder')}
            autoCapitalize="words"
          />

          {/* Validierungs- und Serverfehler */}
          {errorMsg ? (
            <Txt variant="body" tone="danger">
              {errorMsg}
            </Txt>
          ) : null}

          {/* Erstellen-Button */}
          <Button
            title={t('household.create.create')}
            onPress={handleSubmit}
            loading={mutation.isPending}
          />
        </View>
      </ContentCard>

      {/* Alternative Aktion: Haushalts-Beitritt via Code */}
      <Button
        title={t('household.create.joinWithCode')}
        variant="secondary"
        onPress={() => router.push('/household/join')}
      />

      {/* Abbrechen-Button (sofern Historie vorhanden) */}
      {router.canGoBack() && (
        <Button
          title={t('household.create.cancel')}
          variant="secondary"
          onPress={() => router.back()}
        />
      )}
    </Screen>
  );
}
