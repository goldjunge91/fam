import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { authErrorMessage, signIn } from '@/features/auth/api';
import { fieldErrors, signInSchema } from '@/features/auth/auth-schemas';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    // Doppel-Submit abfangen: Ohne das erzeugt ein schneller zweiter Tap einen
    // zweiten Request und laeuft in Supabases Rate Limit.
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
    // Kein manueller Redirect: Der SessionProvider bekommt das Event, und
    // Stack.Protected wechselt die Route. Ein eigener Aufruf hier wuerde mit
    // dem Guard konkurrieren.
  }

  return (
    <Screen title="Anmelden" subtitle="Schön, dass du wieder da bist">
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
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            {formError ? (
              <ThemedText type="small" themeColor="danger">
                {formError}
              </ThemedText>
            ) : null}

            <Button label="Anmelden" onPress={handleSubmit} loading={loading} />
          </View>
        </Card>

        <View style={styles.links}>
          <Link href="/sign-up" asChild>
            <ThemedText type="link" themeColor="accent">
              Noch kein Konto? Registrieren
            </ThemedText>
          </Link>

          <Link href="/forgot-password" asChild>
            <ThemedText type="link" themeColor="textSecondary">
              Passwort vergessen
            </ThemedText>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  links: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
});
