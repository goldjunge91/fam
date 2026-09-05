import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button, TextField, Txt } from '@/constants/ui';
import { requestPasswordReset } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { type PasswordResetRequestInput, passwordResetRequestSchema } from '@/lib/db/zod/auth.zod';

export function ForgotPasswordScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = from === 'onboarding';
  const backTarget = fromOnboarding
    ? ({ label: 'Onboarding', href: '/onboarding' } as const)
    : ({ label: 'Anmelden', href: '/sign-in' } as const);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });
  const email = watch('email');

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backTarget.href);
  }

  async function submit(values: PasswordResetRequestInput) {
    setFormError(null);
    const { error } = await requestPasswordReset(values.email);

    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Screen title="E-Mail unterwegs" back={backTarget}>
        {/* Bestätigungskarte nach E-Mail-Versand */}
        <Card>
          {/* Bewusst neutral formuliert: Eine Bestaetigung, dass genau diese
              Adresse ein Konto hat, waere eine Auskunft ueber fremde Nutzer. */}
          <Txt variant="body">
            Falls es zu {email.trim().toLowerCase()} ein Konto gibt, ist eine E-Mail mit einem Link
            zum Zurücksetzen unterwegs.
          </Txt>
        </Card>
        {/* Zurück-Aktion */}
        <Button
          title={fromOnboarding ? 'Zurück zum Onboarding' : 'Zurück zur Anmeldung'}
          variant="secondary"
          onPress={handleBack}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Passwort zurücksetzen" subtitle="Wir schicken dir einen Link" back={backTarget}>
      {/* Formular zur Passworteingabe / Reset-Anfrage */}
      <Card>
        <View className="gap-three">
          {/* E-Mail-Eingabefeld */}
          <TextField
            testID="forgot-password-email"
            label="E-Mail"
            value={email}
            onChangeText={(value) => setValue('email', value, { shouldValidate: true })}
            error={errors.email?.message}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            inputMode="email"
            onSubmitEditing={() => void handleSubmit(submit)()}
            returnKeyType="go"
          />

          {/* Fehlermeldung */}
          {formError ? (
            <Txt variant="body" tone="danger">
              {formError}
            </Txt>
          ) : null}

          {/* Absende-Button */}
          <Button
            title="Link anfordern"
            onPress={() => void handleSubmit(submit)()}
            loading={isSubmitting}
          />
        </View>
      </Card>

      {/* Navigation zurück */}
      <Button title="Zurück" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
