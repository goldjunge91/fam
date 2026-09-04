import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { AppleSignInButton } from '@/features/auth/components/apple-sign-in-button';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { signInWithOAuthProvider } from '@/features/auth/provider-auth';

interface AuthProviderOptionsProps {
  mode: 'sign_in' | 'sign_up';
  onAuthAttempt?: () => void;
}

export function AuthProviderOptions({ mode, onAuthAttempt }: AuthProviderOptionsProps) {
  const [oauthError, setOAuthError] = useState<string | null>(null);

  return (
    <View className="gap-three">
      <View className="divider">
        <Txt variant="body" tone="secondary">
          {mode === 'sign_in' ? 'oder anmelden mit' : 'oder weiter mit'}
        </Txt>
      </View>

      <AppleSignInButton onAuthStart={onAuthAttempt} onError={(error) => setOAuthError(error)} />

      <Button
        label="🌐  Mit Google anmelden"
        variant="secondary"
        onPress={async () => {
          setOAuthError(null);
          onAuthAttempt?.();
          const { error } = await signInWithOAuthProvider('google');
          if (error) setOAuthError(authErrorMessage(error));
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
