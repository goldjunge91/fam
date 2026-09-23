import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/components/theme/ThemeProvider';
import { authErrorMessage } from '@/features/auth/domain/auth-error-message';
import { signInWithApple } from '@/features/auth/oauth-provider-actions';

type AppleSignInButtonProps = {
  onError?: (errorMessage: string | null) => void;
  onAuthStart?: () => void;
};

export function AppleSignInButton({ onError, onAuthStart }: AppleSignInButtonProps) {
  const { mode } = useTheme();
  const { t } = useTranslation();

  return (
    <AppleAuthenticationButton
      buttonType={AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        mode === 'dark'
          ? AppleAuthenticationButtonStyle.WHITE
          : AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={12}
      style={{ width: '100%', height: 48 }}
      onPress={async () => {
        onError?.(null);
        onAuthStart?.();
        const { error } = await signInWithApple();
        if (error && onError) {
          onError(authErrorMessage(error, t));
        }
      }}
    />
  );
}
