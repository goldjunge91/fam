import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Press, Surface, Txt } from '@/constants/ui';
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
  tabToggle: {
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: theme.space.xs,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
  },
  tabContainer: {
    flex: 1,
  },
  tabButton: {
    alignItems: 'center',
    paddingVertical: theme.space.sm,
  },
  tabButtonActive: {
    backgroundColor: theme.accent,
  },
}));

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
          <View
            accessibilityRole="tablist"
            accessibilityLabel="Anmeldeart"
            style={styles.tabToggle}>
            <Press
              onPress={() => setAuthMode('sign_up')}
              accessibilityRole="tab"
              accessibilityLabel="Registrieren"
              accessibilityState={{ selected: authMode === 'sign_up' }}
              haptic="selection"
              containerStyle={styles.tabContainer}
              style={[styles.tabButton, authMode === 'sign_up' && styles.tabButtonActive]}>
              <Txt
                variant="body"
                tone={authMode === 'sign_up' ? 'onAccent' : 'primary'}
                weight="600">
                Registrieren
              </Txt>
            </Press>
            <Press
              onPress={() => setAuthMode('sign_in')}
              accessibilityRole="tab"
              accessibilityLabel="Anmelden"
              accessibilityState={{ selected: authMode === 'sign_in' }}
              haptic="selection"
              containerStyle={styles.tabContainer}
              style={[styles.tabButton, authMode === 'sign_in' && styles.tabButtonActive]}>
              <Txt
                variant="body"
                tone={authMode === 'sign_in' ? 'onAccent' : 'primary'}
                weight="600">
                Anmelden
              </Txt>
            </Press>
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
