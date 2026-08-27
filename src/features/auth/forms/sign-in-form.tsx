import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { authErrorMessage, signIn } from '@/features/auth/api';
import { fieldErrors, signInSchema } from '@/features/auth/auth-schemas';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (loading) return;

    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setLoading(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setLoading(false);

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
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSubmit}
        returnKeyType="go"
      />

      {formError ? <ThemedText type="smallDanger">{formError}</ThemedText> : null}

      <Button label={submitLabel} onPress={handleSubmit} loading={loading} />
    </View>
  );
}
