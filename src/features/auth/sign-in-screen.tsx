import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
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
        {/* Haupt-Anmeldeformular */}
        <Card>
          <View className="gap-three">
            {/* E-Mail Eingabefeld */}
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

            {/* Passwort Eingabefeld */}
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

            {/* Fehlermeldung */}
            {formError ? <ThemedText type="smallDanger">{formError}</ThemedText> : null}

            {/* Anmelde-Button */}
            <Button label="Anmelden" onPress={handleSubmit} loading={loading} />

            {/* Trennlinie für Drittanbieter-Logins */}
            <View className="divider">
              <ThemedText type="smallMuted">oder anmelden mit</ThemedText>
            </View>

            {/* OAuth Buttons (Apple & Google) */}
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

        {/* Links zu Registrierung & Passwort vergessen */}
        <View className="link-stack">
          <Link href="/sign-up" asChild>
            <ThemedText type="link">Noch kein Konto? Registrieren</ThemedText>
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
