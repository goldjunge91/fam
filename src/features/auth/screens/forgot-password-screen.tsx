import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { ContentCard } from '@/components/ui/content-card';
import { Button, TextField, Txt } from '@/constants/ui';
import { requestPasswordReset } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import {
  type PasswordResetRequestInput,
  passwordResetRequestSchema,
  translateAuthValidationMessage,
} from '@/lib/db/zod/auth.zod';
import { useRozeniteRHFDevTools } from '@/lib/optionals/RozeniteDevTools';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = from === 'onboarding';
  const backTarget = fromOnboarding
    ? ({ label: t('auth.passwordReset.onboarding'), href: '/onboarding' } as const)
    : ({ label: t('auth.signIn.title'), href: '/sign-in' } as const);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    control,
    setValue,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });
  useRozeniteRHFDevTools({ control, id: 'forgot-password' });
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
      setFormError(authErrorMessage(error, t));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Screen title={t('auth.passwordReset.sentTitle')} back={backTarget}>
        {/* Bestätigungskarte nach E-Mail-Versand */}
        <ContentCard>
          {/* Bewusst neutral formuliert: Eine Bestaetigung, dass genau diese
              Adresse ein Konto hat, waere eine Auskunft ueber fremde Nutzer. */}
          <Txt variant="body">
            {t('auth.passwordReset.sentBody', { email: email.trim().toLowerCase() })}
          </Txt>
        </ContentCard>
        {/* Zurück-Aktion */}
        <Button
          title={
            fromOnboarding
              ? t('auth.passwordReset.backToOnboarding')
              : t('auth.passwordReset.backToSignIn')
          }
          variant="secondary"
          onPress={handleBack}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('auth.passwordReset.title')}
      subtitle={t('auth.passwordReset.subtitle')}
      back={backTarget}>
      {/* Formular zur Passworteingabe / Reset-Anfrage */}
      <ContentCard>
        <View style={styles.form}>
          {/* E-Mail-Eingabefeld */}
          <TextField
            testID="forgot-password-email"
            label={t('auth.fields.email')}
            value={email}
            onChangeText={(value) => setValue('email', value, { shouldValidate: true })}
            error={translateAuthValidationMessage(errors.email?.message, t)}
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
            title={t('auth.passwordReset.requestLink')}
            onPress={() => void handleSubmit(submit)()}
            loading={isSubmitting}
          />
        </View>
      </ContentCard>

      {/* Navigation zurück */}
      <Button
        title={t('auth.passwordReset.back')}
        variant="secondary"
        onPress={() => router.back()}
      />
    </Screen>
  );
}
