import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Press, Surface, Txt } from '@/constants/ui';
import { AuthFormCard } from '@/features/auth/components/auth-form-card';
import { EmailVerificationPanel } from '@/features/auth/components/email-verification-panel';
import type { PendingSignUp } from '@/features/auth/forms/sign-up-form';
import { useSession } from '@/features/auth/session-provider';

interface AccountStepFormProps {
  onNext: () => void;
}

const styles = StyleSheet.create((theme, rt) => ({
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.space.lg,
    paddingBottom: 64 + rt.insets.ime,
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
  authLinks: {
    alignItems: 'center',
    gap: theme.space.lg,
    marginTop: theme.space.sm,
  },
  authLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
}));

const ACCOUNT_KEYBOARD_BOTTOM_OFFSET = 180;

export function AccountStepForm({ onNext }: AccountStepFormProps) {
  const { t } = useTranslation();
  const { session } = useSession();

  const [authMode, setAuthMode] = useState<'sign_up' | 'sign_in'>('sign_up');
  const [pendingSignUp, setPendingSignUp] = useState<PendingSignUp | null>(null);
  const [oauthAttempted, setOAuthAttempted] = useState(false);

  useEffect(() => {
    if (session && oauthAttempted) onNext();
  }, [session, oauthAttempted, onNext]);

  return (
    <KeyboardAwareScrollView
      style={styles.scroll}
      // Die Toolbar liegt als Input-Accessory über der Systemtastatur und
      // braucht deshalb zusätzlichen Abstand zum fokussierten Feld.
      bottomOffset={ACCOUNT_KEYBOARD_BOTTOM_OFFSET}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {pendingSignUp ? (
        <EmailVerificationPanel
          email={pendingSignUp.email}
          password={pendingSignUp.password}
          onConfirmed={onNext}
          onChangeEmail={() => setPendingSignUp(null)}
        />
      ) : (
        <>
          <Txt variant="title">
            {t(authMode === 'sign_up' ? 'auth.signUp.title' : 'auth.signIn.title')}
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
            <>
              {authMode === 'sign_up' ? (
                <AuthFormCard
                  mode="sign_up"
                  onSuccess={onNext}
                  onPendingVerification={setPendingSignUp}
                  onAuthAttempt={() => setOAuthAttempted(true)}
                  onSwitchToSignIn={() => setAuthMode('sign_in')}
                />
              ) : (
                <AuthFormCard
                  mode="sign_in"
                  onSuccess={onNext}
                  onAuthAttempt={() => setOAuthAttempted(true)}
                />
              )}

              {authMode === 'sign_in' ? (
                <View style={styles.authLinks}>
                  <Press
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.signIn.registerPrompt')}
                    onPress={() => setAuthMode('sign_up')}
                    style={styles.authLink}>
                    <Txt variant="label" tone="accent">
                      {t('auth.signIn.registerPrompt')}
                    </Txt>
                  </Press>

                  <Press
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.signIn.forgotPassword')}
                    onPress={() =>
                      router.push({ pathname: '/forgot-password', params: { from: 'onboarding' } })
                    }
                    style={styles.authLink}>
                    <Txt variant="label" tone="secondary">
                      {t('auth.signIn.forgotPassword')}
                    </Txt>
                  </Press>
                </View>
              ) : null}
            </>
          )}
        </>
      )}
    </KeyboardAwareScrollView>
  );
}
