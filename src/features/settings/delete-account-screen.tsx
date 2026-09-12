import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import { signOutAndClearLocalData } from '@/features/auth/sign-out';
import { getSupabase } from '@/lib/supabase';

export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  async function performDeletion() {
    setDeleting(true);
    try {
      const { data, error } = await getSupabase().functions.invoke('delete-account', {
        method: 'POST',
      });

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 409) {
          Alert.alert(
            t('settings.groups.data.deleteAccount.notYetPossibleTitle'),
            t('settings.groups.data.deleteAccount.notYetPossibleBody'),
          );
          return;
        }

        Alert.alert(t('settings.groups.data.deleteAccount.failedTitle'), error.message);
        return;
      }

      if (data && (data as { error?: string }).error) {
        Alert.alert(
          t('settings.groups.data.deleteAccount.failedTitle'),
          (data as { message?: string }).message ??
            t('settings.groups.data.deleteAccount.unknownError'),
        );
        return;
      }

      const { error: signOutError } = await signOutAndClearLocalData(queryClient);
      if (signOutError) throw signOutError;

      router.replace('/onboarding');
    } catch (err) {
      Alert.alert(t('settings.groups.data.deleteAccount.failedTitle'), (err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeletion() {
    Alert.alert(
      t('settings.groups.data.deleteAccount.confirmTitle'),
      t('settings.groups.data.deleteAccount.confirmBody'),
      [
        { text: t('settings.groups.data.deleteAccount.cancel'), style: 'cancel' },
        {
          text: t('settings.groups.data.deleteAccount.confirmDelete'),
          style: 'destructive',
          onPress: performDeletion,
        },
      ],
    );
  }

  return (
    <Screen
      title={t('settings.groups.data.deleteAccount.label')}
      back={{ label: t('settings.backToSettings'), href: '/settings' }}
      backStyle="icon">
      {/* Warnhinweis-Karte zu den Auswirkungen der Account-Löschung */}
      <Card>
        <Txt variant="body" tone="secondary" weight="500">
          {t('settings.groups.data.deleteAccount.hint')}
        </Txt>
      </Card>
      {/* Gefahren-Aktionsbutton zum Einleiten der Kontolöschung */}
      <View className="mt-four">
        <Button
          title={t('settings.groups.data.deleteAccount.deleteButton')}
          variant="danger"
          onPress={confirmDeletion}
          loading={deleting}
        />
      </View>
    </Screen>
  );
}
