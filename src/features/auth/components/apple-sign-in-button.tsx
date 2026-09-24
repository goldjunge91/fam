import { useTranslation } from 'react-i18next';

import { AuthProviderIconButton } from '@/features/auth/components/auth-provider-icon-button';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { signInWithApple } from '@/features/auth/oauth-provider-actions';

type AppleSignInButtonProps = {
  onError?: (errorMessage: string | null) => void;
  onAuthStart?: () => void;
};

export function AppleSignInButton({ onError, onAuthStart }: AppleSignInButtonProps) {
  const { t } = useTranslation();

  return (
    <AuthProviderIconButton
      accessibilityLabel={t('auth.providers.appleSignIn')}
      onPress={async () => {
        onError?.(null);
        onAuthStart?.();
        const { error } = await signInWithApple();
        if (error && onError) {
          onError(authErrorMessage(error, t));
        }
      }}
      provider="apple"
      testID="apple-sign-in-button"
    />
  );
}
