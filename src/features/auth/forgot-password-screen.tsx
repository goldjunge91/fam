import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { authErrorMessage, requestPasswordReset } from '@/features/auth/api';
import { fieldErrors, resetRequestSchema } from '@/features/auth/auth-schemas';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (loading) return;

    setFormError(null);
    const parsed = resetRequestSchema.safeParse({ email });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setLoading(true);
    const { error } = await requestPasswordReset(parsed.data.email);
    setLoading(false);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Screen title="E-Mail unterwegs" back={{ label: 'Anmelden', href: '/sign-in' }}>
        <Card>
          {/* Neutral formuliert, um registrierte Adressen nicht offenzulegen. */}
          <ThemedText>
            Falls es zu {email} ein Konto gibt, ist eine E-Mail mit einem Link zum Zurücksetzen
            unterwegs.
          </ThemedText>
        </Card>
        <Button
          label="Zurück zur Anmeldung"
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Passwort zurücksetzen"
      subtitle="Wir schicken dir einen Link"
      back={{ label: 'Anmelden', href: '/sign-in' }}>
      <Card>
        <View className="gap-three">
          <TextField
            testID="forgot-password-email"
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            inputMode="email"
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          {formError ? <ThemedText type="smallDanger">{formError}</ThemedText> : null}

          <Button label="Link anfordern" onPress={handleSubmit} loading={loading} />
        </View>
      </Card>

      <Button label="Zurück" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
