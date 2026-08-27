import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { authErrorMessage, signUp } from '@/features/auth/api';
import { fieldErrors, signUpSchema } from '@/features/auth/auth-schemas';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (loading) return;

    setFormError(null);
    const parsed = signUpSchema.safeParse({ email, password, passwordConfirmation });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setLoading(true);
    const { data, error } = await signUp(parsed.data.email, parsed.data.password);
    setLoading(false);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }

    if (!data.session) {
      onPendingVerification({ email: parsed.data.email, password: parsed.data.password });
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
        onChangeText={setEmail}
        error={errors.email}
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
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <TextField
        testID={`${testIDPrefix}-password-confirmation`}
        label="Passwort wiederholen"
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        error={errors.passwordConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSubmit}
        returnKeyType="go"
      />

      {formError ? <ThemedText type="smallDanger">{formError}</ThemedText> : null}

      <Button label={submitLabel} onPress={handleSubmit} loading={loading} />
    </View>
  );
}
