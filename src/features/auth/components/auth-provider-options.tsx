import { useState } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { authErrorMessage, signInWithOAuthProvider } from '@/features/auth/api';
import { AppleSignInButton } from '@/features/auth/components/apple-sign-in-button';

interface AuthProviderOptionsProps {
  mode: 'sign_in' | 'sign_up';
  onAuthAttempt?: () => void;
}

export function AuthProviderOptions({ mode, onAuthAttempt }: AuthProviderOptionsProps) {
  const [oauthError, setOAuthError] = useState<string | null>(null);

  return (
    <View className="gap-three">
      <View className="divider">
        <ThemedText type="smallMuted">
          {mode === 'sign_in' ? 'oder anmelden mit' : 'oder weiter mit'}
        </ThemedText>
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

      {oauthError ? <ThemedText type="smallDanger">{oauthError}</ThemedText> : null}
    </View>
  );
}
