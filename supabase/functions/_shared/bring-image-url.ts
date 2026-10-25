const BRING_HOST_SUFFIX = '.bringapi.app';
const BRING_PATH_PREFIX = '/content/';
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function hasValidEncoding(value: string): boolean {
  try {
    decodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

function hasControlOrSpace(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x20 || codePoint === 0x7f;
  });
}

function hasAllowedPath(pathname: string): boolean {
  if (!pathname.startsWith(BRING_PATH_PREFIX) || /%25|[\\]/i.test(pathname)) return false;

  const segments = pathname.slice(BRING_PATH_PREFIX.length).split('/');
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) return false;

  return segments.every((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return decoded !== '.' && decoded !== '..' && !decoded.includes('/') &&
        !decoded.includes('\\') &&
        !hasControlOrSpace(decoded);
    } catch {
      return false;
    }
  });
}

/** Accepts only source URLs safe for a backend fetch; query parameters stay intact. */
export function bringImageUrl(value: unknown): URL | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    hasControlOrSpace(value)
  ) {
    return null;
  }

  const absolute = /^https:\/\/([^/?#]+)(\/[^?#]*)(\?[^#]*)?$/i.exec(value);
  if (
    !absolute ||
    absolute[1]!.includes('@') ||
    absolute[1]!.includes(':') ||
    absolute[1]!.endsWith('.') ||
    !hasAllowedPath(absolute[2]!)
  ) return null;
  if (
    absolute[3] &&
    (!hasValidEncoding(absolute[3]) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(absolute[3]))
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const labels = hostname.split('.');
  const subdomainLabels = labels.slice(0, -2);
  const hasBringHost = hostname.endsWith(BRING_HOST_SUFFIX) &&
    hostname !== 'bringapi.app' &&
    subdomainLabels.length >= 1 &&
    subdomainLabels.every((label) => HOST_LABEL.test(label));

  if (
    url.protocol !== 'https:' ||
    !hasBringHost ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.hash !== '' ||
    absolute[1]!.endsWith('.') ||
    !hasValidEncoding(url.pathname) ||
    !hasValidEncoding(url.search)
  ) {
    return null;
  }

  return url;
}

export function isAllowedBringImageUrl(value: unknown): boolean {
  return bringImageUrl(value) !== null;
}

export function requiredBringImageUrl(value: unknown, field: string): string {
  const url = bringImageUrl(value);
  if (!url) throw new Error(`${field} is not an allowed Bring image URL`);
  return url.toString();
}
