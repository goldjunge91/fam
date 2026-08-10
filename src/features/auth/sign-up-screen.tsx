import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { authErrorMessage, signInWithOAuthProvider, signUp } from '@/features/auth/api';
import { fieldErrors, signUpSchema } from '@/features/auth/auth-schemas';
import { PendingAuthBanner } from '@/features/auth/components/pending-auth-banner';

export function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

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
      setPendingEmail(parsed.data.email);
      return;
    }

    router.replace('/onboarding');
  }

  if (pendingEmail) {
    return (
      <Screen
        title="Konto aktivieren"
        subtitle="E-Mail-Bestätigung ausstehend"
        back={{ label: 'Anmelden', href: '/sign-in' }}>
        <PendingAuthBanner
          email={pendingEmail}
          password={password}
          onConfirmed={() => router.replace('/onboarding')}
          onChangeEmail={() => setPendingEmail(null)}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Konto erstellen"
      subtitle="Für dich und deinen Haushalt"
      back={{ label: 'Anmelden', href: '/sign-in' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card>
          <View style={styles.form}>
            <TextField
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

            {formError ? (
              <ThemedText type="small" themeColor="danger">
                {formError}
              </ThemedText>
            ) : null}

            <Button label="Konto erstellen" onPress={handleSubmit} loading={loading} />

            <View style={styles.divider}>
              <ThemedText type="small" themeColor="textSecondary">
                oder weiter mit
              </ThemedText>
            </View>

            <Button
              label="  Mit Apple anmelden"
              variant="secondary"
              onPress={async () => {
                const { error } = await signInWithOAuthProvider('apple');
                if (error) setFormError(authErrorMessage(error));
              }}
            />

            <Button
              label="🌐  Mit Google anmelden"
              variant="secondary"
              onPress={async () => {
                const { error } = await signInWithOAuthProvider('google');
                if (error) setFormError(authErrorMessage(error));
              }}
            />

            <ThemedText type="small" themeColor="textSecondary">
              Vorrat und Einkaufsliste teilst du später mit deinem Haushalt. Kalorien, Gewicht und
              Ziele bleiben privat.
            </ThemedText>
          </View>
        </Card>

        <Button
          label="Ich habe schon ein Konto"
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  divider: {
    alignItems: 'center',
    marginVertical: Spacing.one,
  },
});
