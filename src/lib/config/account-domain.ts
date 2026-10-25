const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i;

/** Accepts one public DNS hostname, without a scheme, port, or path. */
export function normalizeAccountDomain(value: string | undefined | null): string | undefined {
  const hostname = value?.trim().toLowerCase();
  if (!hostname) return undefined;

  if (!HOSTNAME_PATTERN.test(hostname) || /^\d+(?:\.\d+){3}$/.test(hostname)) {
    throw new Error('EXPO_PUBLIC_ACCOUNT_DOMAIN must be a DNS hostname without a URL path.');
  }

  return hostname;
}

export function getPasswordRecoveryUrl(domain: string): string {
  return `https://${domain}/password-recovery`;
}
