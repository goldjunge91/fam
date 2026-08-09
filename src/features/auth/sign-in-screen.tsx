import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { authErrorMessage, signIn, signInWithOAuthProvider } from '@/features/auth/api';
import { fieldErrors, signInSchema } from '@/features/auth/auth-schemas';

export function SignInScreen() {
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
  }

  return (
    <Screen title="Anmelden" subtitle="Schön, dass du wieder da bist">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card>
          <View style={styles.form}>
            <TextField
              testID="sign-in-email"
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
              testID="sign-in-password"
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

            <View style={styles.divider}>
              <ThemedText type="small" themeColor="textSecondary">
                oder anmelden mit
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
  divider: {
    alignItems: 'center',
    marginVertical: Spacing.one,
  },
  links: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
});
