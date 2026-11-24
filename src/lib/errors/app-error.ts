export const APP_ERROR_CODES = {
  invalidInvite: 'invalid_invite',
  missingAuthentication: 'missing_authentication',
  saveFailed: 'save_failed',
} as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES];

export class AppError extends Error {
  constructor(readonly code: AppErrorCode) {
    super(code);
    this.name = 'AppError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
