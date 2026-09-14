import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, SegmentedControl, Surface, Txt } from '@/constants/ui';
import { AuthProviderOptions } from '@/features/auth/components/auth-provider-options';
import { EmailVerificationPanel } from '@/features/auth/components/email-verification-panel';
import { SignInForm } from '@/features/auth/forms/sign-in-form';
import { type PendingSignUp, SignUpForm } from '@/features/auth/forms/sign-up-form';
import { useSession } from '@/features/auth/session-provider';

interface AccountStepFormProps {
  onNext: () => void;
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.lg,
  },
  activeContainer: {
    gap: theme.space.xl + theme.space.xs,
    marginTop: theme.space.sm,
  },
  activeBanner: {
    gap: theme.space.xs,
    padding: theme.space.lg,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
  },
  form: {
    gap: theme.space.lg,
    marginTop: theme.space.sm,
  },
}));

const AUTH_MODE_OPTIONS = [
  { value: 'sign_up', label: 'Registrieren', accessibilityLabel: 'Registrieren' },
  { value: 'sign_in', label: 'Anmelden', accessibilityLabel: 'Anmelden' },
] as const;

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
      <View style={styles.root}>
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
    <View style={styles.root}>
      <Txt variant="subheading" weight="700">
        Dein Account
      </Txt>
      <Txt variant="body" tone="secondary">
        Erstelle ein Konto oder melde dich an, um deine Daten zu synchronisieren.
      </Txt>

      {session ? (
        <View style={styles.activeContainer}>
          <Surface tone="surface" style={styles.activeBanner}>
            <Txt variant="label" tone="accent" weight="700">
              ✓ Angemeldet als: {session.user.email}
            </Txt>
            <Txt variant="label" tone="secondary">
              Dein Account ist aktiv. Du kannst jetzt direkt zum nächsten Schritt wechseln.
            </Txt>
          </Surface>

          <Button title="Weiter" onPress={onNext} />
        </View>
      ) : (
        <View style={styles.form}>
          <SegmentedControl
            label="Anmeldeart"
            options={AUTH_MODE_OPTIONS}
            selected={authMode}
            onSelect={setAuthMode}
            selectionRole="tab"
          />

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
                title="Passwort vergessen"
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
