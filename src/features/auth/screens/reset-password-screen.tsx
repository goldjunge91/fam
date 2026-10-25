import { PasswordRecoveryScreen } from '@/features/auth/screens/password-recovery-screen';

/** Keeps previously issued reset links working while using the code-based flow. */
export function ResetPasswordScreen() {
  return <PasswordRecoveryScreen />;
}
