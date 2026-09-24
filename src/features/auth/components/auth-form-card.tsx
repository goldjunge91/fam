import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Card } from '@/components/ui/card';
import { Button } from '@/constants/ui';
import { AuthProviderOptions } from '@/features/auth/components/auth-provider-options';
import { SignInForm } from '@/features/auth/forms/sign-in-form';
import { type PendingSignUp, SignUpForm } from '@/features/auth/forms/sign-up-form';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
  },
}));

type SharedAuthFormProps = {
  onAuthAttempt?: () => void;
  submitLabel?: string;
  testIDPrefix?: string;
};

type AuthFormCardProps =
  | (SharedAuthFormProps & {
      mode: 'sign_in';
      onSuccess: () => void;
    })
  | (SharedAuthFormProps & {
      mode: 'sign_up';
      onSuccess: () => void;
      onPendingVerification: (pendingSignUp: PendingSignUp) => void;
      onSwitchToSignIn: () => void;
    });

/** Shared auth presentation used by the standalone routes and onboarding. */
export function AuthFormCard(props: AuthFormCardProps) {
  const { t } = useTranslation();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Card>
        <View style={styles.form}>
          {props.mode === 'sign_in' ? (
            <SignInForm
              onSuccess={props.onSuccess}
              submitLabel={props.submitLabel}
              testIDPrefix={props.testIDPrefix}
            />
          ) : (
            <SignUpForm
              onSuccess={props.onSuccess}
              onPendingVerification={props.onPendingVerification}
              submitLabel={props.submitLabel}
              testIDPrefix={props.testIDPrefix}
            />
          )}

          <AuthProviderOptions mode={props.mode} onAuthAttempt={props.onAuthAttempt} />

          {props.mode === 'sign_up' ? (
            <Button
              title={t('auth.signUp.existingAccount')}
              variant="secondary"
              onPress={props.onSwitchToSignIn}
            />
          ) : null}
        </View>
      </Card>
    </KeyboardAvoidingView>
  );
}
