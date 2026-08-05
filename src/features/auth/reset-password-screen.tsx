import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { authErrorMessage, updatePassword } from '@/features/auth/api';
import { fieldErrors, newPasswordSchema } from '@/features/auth/auth-schemas';

/**
 * Ziel des Deep Links aus der Reset-Mail.
 *
 * Supabase legt beim Oeffnen des Links bereits eine Recovery-Session an — der
 * Nutzer ist an dieser Stelle also angemeldet, und `updateUser` funktioniert.
 * Ein abgelaufener Link erzeugt keine Session; dann meldet der Server den
 * Fehler beim Speichern.
 */
export function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (loading) return;

    setFormError(null);
    const parsed = newPasswordSchema.safeParse({ password, passwordConfirmation });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setLoading(true);
    const { error } = await updatePassword(parsed.data.password);
    setLoading(false);

    if (error) {
      setFormError(authErrorMessage(error) ?? 'Der Link ist abgelaufen. Fordere einen neuen an.');
      return;
    }

    router.replace('/');
  }

  return (
    <Screen title="Neues Passwort" subtitle="Danach bist du direkt angemeldet">
      <Card>
        <View style={styles.form}>
          <TextField
            label="Neues Passwort"
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

          <Button label="Passwort speichern" onPress={handleSubmit} loading={loading} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
});
