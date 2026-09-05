import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Button, Txt } from '@/constants/ui';
import { signIn } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { type SignInInput, signInSchema } from '@/lib/db/zod/auth.zod';

interface SignInFormProps {
  onSuccess?: () => void;
  submitLabel?: string;
  testIDPrefix?: string;
}

export function SignInForm({
  onSuccess,
  submitLabel = 'Anmelden',
  testIDPrefix = 'sign-in',
}: SignInFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const email = watch('email');
  const password = watch('password');

  async function submit(values: SignInInput) {
    setFormError(null);
    const { error } = await signIn(values.email, values.password);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }

    onSuccess?.();
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
        title={submitLabel}
        onPress={() => void handleSubmit(submit)()}
        loading={isSubmitting}
      />
    </View>
  );
}
