import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { AuthProviderOptions } from '@/features/auth/components/auth-provider-options';
import { EmailVerificationPanel } from '@/features/auth/components/email-verification-panel';
import { SignInForm } from '@/features/auth/forms/sign-in-form';
import { type PendingSignUp, SignUpForm } from '@/features/auth/forms/sign-up-form';
import { useSession } from '@/features/auth/session-provider';

interface AccountStepFormProps {
  onNext: () => void;
}

export function AccountStepForm({ onNext }: AccountStepFormProps) {
  const { session } = useSession();

  const [authMode, setAuthMode] = useState<'sign_up' | 'sign_in'>('sign_up');
  const [pendingSignUp, setPendingSignUp] = useState<PendingSignUp | null>(null);
  const [oauthAttempted, setOAuthAttempted] = useState(false);

  useEffect(() => {
    if (session && oauthAttempted) onNext();
  }, [session, oauthAttempted, onNext]);

  if (pendingSignUp) {
    return (
      <View className="gap-three">
        <EmailVerificationPanel
          email={pendingSignUp.email}
          password={pendingSignUp.password}
          onConfirmed={onNext}
          onChangeEmail={() => setPendingSignUp(null)}
        />
      </View>
    );
  }

  return (
    <View className="gap-three">
      <Text className="perm-heading">Dein Account</Text>
      <Text className="perm-subheading">
        Erstelle ein Konto oder melde dich an, um deine Daten zu synchronisieren.
      </Text>

      {session ? (
        <View className="account-active-container">
          <View className="account-active-banner">
            <Text className="account-active-title">✓ Angemeldet als: {session.user.email}</Text>
            <Text className="perm-desc">
              Dein Account ist aktiv. Du kannst jetzt direkt zum nächsten Schritt wechseln.
            </Text>
          </View>

          <Button label="Weiter" onPress={onNext} />
        </View>
      ) : (
        <View className="account-form">
          <View className="account-tab-toggle">
            <Pressable
              onPress={() => setAuthMode('sign_up')}
              className={`account-tab-button ${authMode === 'sign_up' ? 'account-tab-button-active' : ''}`}>
              <Text
                className={`account-tab-text ${authMode === 'sign_up' ? 'text-on-accent' : 'text-text'}`}>
                Registrieren
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthMode('sign_in')}
              className={`account-tab-button ${authMode === 'sign_in' ? 'account-tab-button-active' : ''}`}>
              <Text
                className={`account-tab-text ${authMode === 'sign_in' ? 'text-on-accent' : 'text-text'}`}>
                Anmelden
              </Text>
            </Pressable>
          </View>

          {authMode === 'sign_up' ? (
            <>
              <SignUpForm
                onSuccess={onNext}
                onPendingVerification={setPendingSignUp}
                submitLabel="Konto erstellen & weiter"
                testIDPrefix="onboarding-account"
              />
              <AuthProviderOptions mode="sign_up" onAuthAttempt={() => setOAuthAttempted(true)} />
            </>
          ) : (
            <>
              <SignInForm
                onSuccess={onNext}
                submitLabel="Anmelden & weiter"
                testIDPrefix="onboarding-account"
              />
              <AuthProviderOptions mode="sign_in" onAuthAttempt={() => setOAuthAttempted(true)} />
              <Button
                label="Passwort vergessen"
                variant="link"
                onPress={() =>
                  router.push({ pathname: '/forgot-password', params: { from: 'onboarding' } })
                }
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}
