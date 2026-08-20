import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { Card } from '@/components/ui/card';
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
      {/* Formular für neues Passwort */}
      <Card>
        <View className="gap-three">
          {/* Eingabe neues Passwort */}
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
          {/* Eingabe Passwort-Bestätigung */}
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

          {/* Formularfehler */}
          {formError ? <ThemedText type="smallDanger">{formError}</ThemedText> : null}

          {/* Absende-Button */}
          <Button label="Passwort speichern" onPress={handleSubmit} loading={loading} />
        </View>
      </Card>
    </Screen>
  );
}
