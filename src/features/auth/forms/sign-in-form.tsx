import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, TextField, Txt } from '@/constants/ui';
import { signIn } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import {
  type SignInInput,
  signInSchema,
  translateAuthValidationMessage,
} from '@/lib/db/zod/auth.zod';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

interface SignInFormProps {
  onSuccess?: () => void;
  submitLabel?: string;
  testIDPrefix?: string;
}

export function SignInForm({ onSuccess, submitLabel, testIDPrefix = 'sign-in' }: SignInFormProps) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  useRozeniteRHFDevTools({ control, id: 'sign-in' });
  const email = watch('email');
  const password = watch('password');

  async function submit(values: SignInInput) {
    setFormError(null);
    const { error } = await signIn(values.email, values.password);

    if (error) {
      setFormError(authErrorMessage(error, t));
      return;
    }

    onSuccess?.();
  }

  return (
    <View style={styles.form}>
      <TextField
        testID={`${testIDPrefix}-email`}
        label={t('auth.fields.email')}
        value={email}
        onChangeText={(value) => setValue('email', value, { shouldValidate: true })}
        error={translateAuthValidationMessage(errors.email?.message, t)}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        inputMode="email"
      />

      <TextField
        testID={`${testIDPrefix}-password`}
        label={t('auth.fields.password')}
        value={password}
        onChangeText={(value) => setValue('password', value, { shouldValidate: true })}
        error={translateAuthValidationMessage(errors.password?.message, t)}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void handleSubmit(submit)()}
        returnKeyType="go"
      />

      {formError ? (
        <Txt variant="body" tone="danger" weight="500">
          {formError}
        </Txt>
      ) : null}

      <Button
        title={submitLabel ?? t('auth.signIn.submit')}
        onPress={() => void handleSubmit(submit)()}
        loading={isSubmitting}
      />
    </View>
  );
}
