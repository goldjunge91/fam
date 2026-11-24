import { APP_ERROR_CODES, isAppError } from '@/lib/errors/app-error';

export function getOnboardingErrorMessage(
  error: unknown,
  translate: (key: string) => string,
): string {
  if (isAppError(error)) {
    switch (error.code) {
      case APP_ERROR_CODES.invalidInvite:
        return translate('onboarding.errors.invalidInvite');
      case APP_ERROR_CODES.missingAuthentication:
        return translate('onboarding.errors.missingAuthentication');
      case APP_ERROR_CODES.saveFailed:
        return translate('onboarding.errors.saveFailed');
    }
  }

  if (error instanceof Error) return error.message;
  return translate('onboarding.errors.saveFailed');
}
