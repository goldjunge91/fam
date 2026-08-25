import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
import { authErrorMessage, signInWithOAuthProvider, signUp } from '@/features/auth/api';
import { fieldErrors, signUpSchema } from '@/features/auth/auth-schemas';
import { AppleSignInButton } from '@/features/auth/components/apple-sign-in-button';
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
        {/* Banner/Hinweis für ausstehende E-Mail-Bestätigung */}
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
        {/* Haupt-Registrierungsformular */}
        <Card>
          <View className="gap-three">
            {/* E-Mail Eingabefeld */}
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

            {/* Passwort Eingabefeld */}
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

            {/* Passwort-Bestätigung Eingabefeld */}
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

            {/* Fehlermeldung */}
            {formError ? <ThemedText type="smallDanger">{formError}</ThemedText> : null}

            {/* Registrierungs-Button */}
            <Button label="Konto erstellen" onPress={handleSubmit} loading={loading} />

            {/* Trennlinie für Drittanbieter-Logins */}
            <View className="divider">
              <ThemedText type="smallMuted">oder weiter mit</ThemedText>
            </View>

            {/* OAuth Buttons (Apple & Google) */}
            <AppleSignInButton onError={setFormError} />

            <Button
              label="🌐  Mit Google anmelden"
              variant="secondary"
              onPress={async () => {
                const { error } = await signInWithOAuthProvider('google');
                if (error) setFormError(authErrorMessage(error));
              }}
            />

            {/* Datenschutz- & Haushalts-Hinweis */}
            <ThemedText type="smallMuted">
              Vorrat und Einkaufsliste teilst du später mit deinem Haushalt. Kalorien, Gewicht und
              Ziele bleiben privat.
            </ThemedText>
          </View>
        </Card>

        {/* Wechsel zur Anmeldung */}
        <Button
          label="Ich habe schon ein Konto"
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
