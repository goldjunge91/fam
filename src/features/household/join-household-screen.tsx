import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, TextField, Txt } from '@/constants/ui';
import { clearPendingInviteToken, peekPendingInviteToken } from '@/features/auth/pending-invite';
import { useRedeemInviteMutation } from '@/features/household/api';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

export function JoinHouseholdScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string }>();
  const [tokenInput, setTokenInput] = useState(params.token ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redeemMutation = useRedeemInviteMutation();

  useEffect(() => {
    // Token erst beim erfolgreichen Beitritt entfernen.
    if (!params.token) {
      peekPendingInviteToken().then((pending) => {
        if (pending) {
          setTokenInput(pending);
        }
      });
    }
  }, [params.token]);

  async function handleJoin() {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setErrorMsg(t('household.join.codeRequired'));
      return;
    }

    setErrorMsg(null);
    try {
      await redeemMutation.mutateAsync(trimmed);
      await clearPendingInviteToken();
      router.replace('/');
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg(t('household.join.genericError'));
      }
    }
  }

  return (
    <Screen
      title={t('household.join.title')}
      subtitle={t('household.join.subtitle')}
      back={{ label: t('household.join.back') }}
      backStyle="icon">
      {/* Eingabe-Formular für den Einladungs-Code / Token */}
      <ContentCard title={t('household.join.cardTitle')}>
        <View style={styles.form}>
          {/* Eingabefeld für Einladungs-Token */}
          <TextField
            label={t('household.join.codeLabel')}
            placeholder={t('household.join.codePlaceholder')}
            value={tokenInput}
            onChangeText={setTokenInput}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Fehleranzeige bei ungültigem / abgelaufenem Code */}
          {errorMsg ? (
            <Txt variant="body" tone="danger">
              {errorMsg}
            </Txt>
          ) : null}

          {/* Beitreten-Aktionsbutton */}
          <Button
            title={t('household.join.submit')}
            onPress={handleJoin}
            loading={redeemMutation.isPending}
            disabled={!tokenInput.trim()}
          />
        </View>
      </ContentCard>

      {/* Abbrechen-Button (sofern Historie vorhanden) */}
      {router.canGoBack() && (
        <Button
          title={t('household.join.cancel')}
          variant="secondary"
          onPress={() => router.back()}
        />
      )}
    </Screen>
  );
}
