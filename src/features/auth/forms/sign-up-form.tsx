import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, TextField, Txt } from '@/constants/ui';
import { signUp } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import {
  type SignUpInput,
  signUpSchema,
  translateAuthValidationMessage,
} from '@/lib/db/zod/auth.zod';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

export interface PendingSignUp {
  email: string;
  password: string;
}

interface SignUpFormProps {
  onSuccess: () => void;
  onPendingVerification: (pendingSignUp: PendingSignUp) => void;
  submitLabel?: string;
  testIDPrefix?: string;
}

export function SignUpForm({
  onSuccess,
  onPendingVerification,
  submitLabel,
  testIDPrefix = 'sign-up',
}: SignUpFormProps) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', passwordConfirmation: '' },
  });
  useRozeniteRHFDevTools({ control, id: 'sign-up' });
  const email = watch('email');
  const password = watch('password');
  const passwordConfirmation = watch('passwordConfirmation');

  async function submit(values: SignUpInput) {
    setFormError(null);
    const { data, error } = await signUp(values.email, values.password);

    if (error) {
      setFormError(authErrorMessage(error, t));
      return;
    }

    if (!data.session) {
      onPendingVerification({ email: values.email, password: values.password });
      return;
    }

    onSuccess();
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
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <TextField
        testID={`${testIDPrefix}-password-confirmation`}
        label={t('auth.fields.passwordConfirmation')}
        value={passwordConfirmation}
        onChangeText={(value) => setValue('passwordConfirmation', value, { shouldValidate: true })}
        error={translateAuthValidationMessage(errors.passwordConfirmation?.message, t)}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void handleSubmit(submit)()}
        returnKeyType="go"
      />

      {formError ? (
        <Txt variant="body" tone="danger" weight="500">
          {formError}
        </Txt>
      ) : null}

      <Button
        title={submitLabel ?? t('auth.signUp.submit')}
        onPress={() => void handleSubmit(submit)()}
        loading={isSubmitting}
      />
    </View>
  );
}
