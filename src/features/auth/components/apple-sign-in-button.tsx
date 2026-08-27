import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { authErrorMessage, signInWithApple } from '@/features/auth/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AppleSignInButtonProps = {
  onError?: (errorMessage: string | null) => void;
  onAuthStart?: () => void;
};

export function AppleSignInButton({ onError, onAuthStart }: AppleSignInButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <AppleAuthenticationButton
      buttonType={AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        isDark ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={12}
      style={{ width: '100%', height: 48 }}
      onPress={async () => {
        onError?.(null);
        onAuthStart?.();
        const { error } = await signInWithApple();
        if (error && onError) {
          onError(authErrorMessage(error));
        }
      }}
    />
  );
}
