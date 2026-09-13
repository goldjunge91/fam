import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, Txt } from '@/constants/ui';
import { AppleSignInButton } from '@/features/auth/components/apple-sign-in-button';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { signInWithOAuthProvider } from '@/features/auth/provider-auth';

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.space.lg,
  },
  divider: {
    alignItems: 'center',
    marginVertical: theme.space.xs,
  },
}));

interface AuthProviderOptionsProps {
  mode: 'sign_in' | 'sign_up';
  onAuthAttempt?: () => void;
}

export function AuthProviderOptions({ mode, onAuthAttempt }: AuthProviderOptionsProps) {
  const { t } = useTranslation();
  const [oauthError, setOAuthError] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <Txt variant="body" tone="secondary">
          {t(mode === 'sign_in' ? 'auth.providers.signInDivider' : 'auth.providers.signUpDivider')}
        </Txt>
      </View>

      <AppleSignInButton onAuthStart={onAuthAttempt} onError={(error) => setOAuthError(error)} />

      <Button
        title={t('auth.providers.googleSignIn')}
        variant="secondary"
        onPress={async () => {
          setOAuthError(null);
          onAuthAttempt?.();
          const { error } = await signInWithOAuthProvider('google');
          if (error) setOAuthError(authErrorMessage(error, t));
        }}
      />

      {oauthError ? (
        <Txt variant="body" tone="danger">
          {oauthError}
        </Txt>
      ) : null}
    </View>
  );
}
