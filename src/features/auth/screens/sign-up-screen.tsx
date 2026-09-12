import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Button, Txt } from '@/constants/ui';
import { AuthProviderOptions } from '@/features/auth/components/auth-provider-options';
import { EmailVerificationPanel } from '@/features/auth/components/email-verification-panel';
import { type PendingSignUp, SignUpForm } from '@/features/auth/forms/sign-up-form';

export function SignUpScreen() {
  const { t } = useTranslation();
  const [pendingSignUp, setPendingSignUp] = useState<PendingSignUp | null>(null);

  if (pendingSignUp) {
    return (
      <Screen
        title={t('auth.signUp.pendingTitle')}
        subtitle={t('auth.signUp.pendingSubtitle')}
        back={{ label: t('auth.signIn.title'), href: '/sign-in' }}>
        {/* Banner/Hinweis für ausstehende E-Mail-Bestätigung */}
        <EmailVerificationPanel
          email={pendingSignUp.email}
          password={pendingSignUp.password}
          onConfirmed={() => router.replace('/onboarding')}
          onChangeEmail={() => setPendingSignUp(null)}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('auth.signUp.title')}
      subtitle={t('auth.signUp.subtitle')}
      back={{ label: t('auth.signIn.title'), href: '/sign-in' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Haupt-Registrierungsformular */}
        <Card>
          <View className="gap-three">
            <SignUpForm
              onSuccess={() => router.replace('/onboarding')}
              onPendingVerification={setPendingSignUp}
            />
            <AuthProviderOptions mode="sign_up" />

            {/* Datenschutz- & Haushalts-Hinweis */}
            <Txt variant="body" tone="secondary">
              {t('auth.signUp.privacyNote')}
            </Txt>
          </View>
        </Card>

        {/* Wechsel zur Anmeldung */}
        <Button
          title={t('auth.signUp.existingAccount')}
          variant="secondary"
          onPress={() => router.replace('/sign-in')}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
