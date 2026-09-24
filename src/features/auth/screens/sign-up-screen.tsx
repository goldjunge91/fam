import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/screen';
import { AuthFormCard } from '@/features/auth/components/auth-form-card';
import { EmailVerificationPanel } from '@/features/auth/components/email-verification-panel';
import type { PendingSignUp } from '@/features/auth/forms/sign-up-form';

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
      <AuthFormCard
        mode="sign_up"
        onSuccess={() => router.replace('/onboarding')}
        onPendingVerification={setPendingSignUp}
        onSwitchToSignIn={() => router.replace('/sign-in')}
      />
    </Screen>
  );
}
