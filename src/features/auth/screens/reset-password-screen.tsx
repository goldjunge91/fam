import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { Txt } from '@/constants/ui';
import { updatePassword } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { type NewPasswordInput, newPasswordSchema } from '@/lib/db/zod/auth.zod';

export function ResetPasswordScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  });
  const password = watch('password');
  const passwordConfirmation = watch('passwordConfirmation');

  async function submit(values: NewPasswordInput) {
    setFormError(null);
    const { error } = await updatePassword(values.password);

    if (error) {
      setFormError(authErrorMessage(error) ?? 'Der Link ist abgelaufen. Fordere einen neuen an.');
      return;
    }

    router.replace('/');
  }

  return (
    <Screen title="Neues Passwort" subtitle="Danach bist du direkt angemeldet">
      {/* Formular für neues Passwort */}
      <Card>
        <View className="gap-three">
          {/* Eingabe neues Passwort */}
          <TextField
            label="Neues Passwort"
            value={password}
            onChangeText={(value) => setValue('password', value, { shouldValidate: true })}
            error={errors.password?.message}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          {/* Eingabe Passwort-Bestätigung */}
          <TextField
            label="Passwort wiederholen"
            value={passwordConfirmation}
            onChangeText={(value) =>
              setValue('passwordConfirmation', value, { shouldValidate: true })
            }
            error={errors.passwordConfirmation?.message}
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
            label="Passwort speichern"
            onPress={() => void handleSubmit(submit)()}
            loading={isSubmitting}
          />
        </View>
      </Card>
    </Screen>
  );
}
