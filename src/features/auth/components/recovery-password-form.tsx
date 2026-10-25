import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, TextField, Txt } from '@/constants/ui';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { usePasswordRecoveryStore } from '@/features/auth/recovery-store';
import {
  type NewPasswordInput,
  newPasswordSchema,
  translateAuthValidationMessage,
} from '@/lib/db/zod/auth.zod';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

export function RecoveryPasswordForm({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const phase = usePasswordRecoveryStore((state) => state.phase);
  const operation = usePasswordRecoveryStore((state) => state.operation);
  const outcome = usePasswordRecoveryStore((state) => state.outcome);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });
  useRozeniteRHFDevTools({ control, id: 'recovery-password' });
  const password = watch('password');
  const passwordConfirmation = watch('passwordConfirmation');

  async function submit(values: NewPasswordInput) {
    setFormError(null);
    const result = await usePasswordRecoveryStore.getState().savePassword(values.password);
    if (result.status === 'error') {
      setFormError(authErrorMessage(result.error, t) ?? t('auth.passwordReset.expiredLink'));
      return;
    }
    if (result.status === 'missing-session') {
      setFormError(t('auth.passwordReset.expiredLink'));
      return;
    }
    if (result.status === 'ok' && result.outcome !== 'sign-in-required') {
      router.replace('/');
    }
  }

  if (phase === 'sign-in-required') {
    return (
      <Screen title={t('auth.passwordReset.updatedSignInTitle')}>
        <ContentCard>
          <Txt variant="body">{t('auth.passwordReset.updatedSignInBody')}</Txt>
        </ContentCard>
        <Button title={t('auth.passwordReset.continue')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (phase === 'updated') {
    return (
      <Screen title={t('auth.passwordReset.passwordUpdatedTitle')}>
        <ContentCard>
          <Txt variant="body">
            {t(
              outcome === 'existing-session'
                ? 'auth.passwordReset.passwordUpdatedExistingSessionBody'
                : 'auth.passwordReset.passwordUpdatedBody',
            )}
          </Txt>
        </ContentCard>
        <Button title={t('auth.passwordReset.continue')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('auth.passwordReset.newPasswordTitle')}
      subtitle={t('auth.passwordReset.newPasswordSubtitle')}>
      <ContentCard>
        <View style={styles.form}>
          <TextField
            testID="recovery-new-password"
            label={t('auth.fields.newPassword')}
            value={password}
            onChangeText={(value) => setValue('password', value, { shouldValidate: true })}
            error={translateAuthValidationMessage(errors.password?.message, t)}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextField
            testID="recovery-password-confirmation"
            label={t('auth.fields.passwordConfirmation')}
            value={passwordConfirmation}
            onChangeText={(value) =>
              setValue('passwordConfirmation', value, { shouldValidate: true })
            }
            error={translateAuthValidationMessage(errors.passwordConfirmation?.message, t)}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={() => void handleSubmit(submit)()}
            returnKeyType="go"
          />

          {formError ? (
            <Txt variant="body" tone="danger">
              {formError}
            </Txt>
          ) : null}

          <Button
            title={t('auth.passwordReset.save')}
            onPress={() => void handleSubmit(submit)()}
            loading={isSubmitting || operation === 'saving'}
            disabled={operation === 'saving'}
          />
        </View>
      </ContentCard>
      <Button
        title={t('auth.passwordReset.cancel')}
        variant="secondary"
        onPress={onCancel}
        disabled={operation === 'saving'}
      />
    </Screen>
  );
}
