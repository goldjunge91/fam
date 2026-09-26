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
import { updatePassword } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
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

export function ResetPasswordScreen() {
  const { t } = useTranslation();
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
  useRozeniteRHFDevTools({ control, id: 'reset-password' });
  const password = watch('password');
  const passwordConfirmation = watch('passwordConfirmation');

  async function submit(values: NewPasswordInput) {
    setFormError(null);
    const { error } = await updatePassword(values.password);

    if (error) {
      setFormError(authErrorMessage(error, t) ?? t('auth.passwordReset.expiredLink'));
      return;
    }

    router.replace('/');
  }

  return (
    <Screen
      title={t('auth.passwordReset.newPasswordTitle')}
      subtitle={t('auth.passwordReset.newPasswordSubtitle')}>
      {/* Formular für neues Passwort */}
      <ContentCard>
        <View style={styles.form}>
          {/* Eingabe neues Passwort */}
          <TextField
            label={t('auth.fields.newPassword')}
            value={password}
            onChangeText={(value) => setValue('password', value, { shouldValidate: true })}
            error={translateAuthValidationMessage(errors.password?.message, t)}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          {/* Eingabe Passwort-Bestätigung */}
          <TextField
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

          {/* Formularfehler */}
          {formError ? (
            <Txt variant="body" tone="danger">
              {formError}
            </Txt>
          ) : null}

          {/* Absende-Button */}
          <Button
            title={t('auth.passwordReset.save')}
            onPress={() => void handleSubmit(submit)()}
            loading={isSubmitting}
          />
        </View>
      </ContentCard>
    </Screen>
  );
}
