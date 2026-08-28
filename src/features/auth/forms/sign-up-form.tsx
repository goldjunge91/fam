import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { signUp } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { type SignUpInput, signUpSchema } from '@/lib/db/zod/auth.zod';

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
  submitLabel = 'Konto erstellen',
  testIDPrefix = 'sign-up',
}: SignUpFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', passwordConfirmation: '' },
  });
  const email = watch('email');
  const password = watch('password');
  const passwordConfirmation = watch('passwordConfirmation');

  async function submit(values: SignUpInput) {
    setFormError(null);
    const { data, error } = await signUp(values.email, values.password);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }

    if (!data.session) {
      onPendingVerification({ email: values.email, password: values.password });
      return;
    }

    onSuccess();
  }

  return (
    <View className="gap-three">
      <TextField
        testID={`${testIDPrefix}-email`}
        label="E-Mail"
        value={email}
        onChangeText={(value) => setValue('email', value, { shouldValidate: true })}
        error={errors.email?.message}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        inputMode="email"
      />

      <TextField
        testID={`${testIDPrefix}-password`}
        label="Passwort"
        value={password}
        onChangeText={(value) => setValue('password', value, { shouldValidate: true })}
        error={errors.password?.message}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <TextField
        testID={`${testIDPrefix}-password-confirmation`}
        label="Passwort wiederholen"
        value={passwordConfirmation}
        onChangeText={(value) => setValue('passwordConfirmation', value, { shouldValidate: true })}
        error={errors.passwordConfirmation?.message}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void handleSubmit(submit)()}
        returnKeyType="go"
      />

      {formError ? <ThemedText type="smallDanger">{formError}</ThemedText> : null}

      <Button
        label={submitLabel}
        onPress={() => void handleSubmit(submit)()}
        loading={isSubmitting}
      />
    </View>
  );
}
