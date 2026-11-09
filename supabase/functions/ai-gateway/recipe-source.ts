type RecipeImportDraft = {
  kind: 'recipe_import_draft.v1';
  title: string;
  servings: number | null;
  ingredients: Array<{ text: string; confidence: 'high' | 'medium' | 'low' }>;
  steps: string[];
  notes: string | null;
  warnings: string[];
};

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const [a = 0, b = 0, c = 0] = octets;
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113);
}

function isPublicAddress(address: string): boolean {
  if (!address.includes(':')) return !isPrivateIpv4(address);
  const firstSegment = Number.parseInt(address.split(':')[0] ?? '', 16);
  return Number.isInteger(firstSegment) &&
    firstSegment >= 0x2000 &&
    firstSegment <= 0x3fff &&
    !address.toLowerCase().startsWith('2001:db8:') &&
    !address.toLowerCase().startsWith('2001:0000:') &&
    !address.toLowerCase().startsWith('2002:');
}

export async function isPublicHttpsUrl(value: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  const authority = value.trim().match(/^https:\/\/([^\/?#]*)/i)?.[1] ?? '';
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1);
  const hasExplicitPort = hostPort.startsWith('[')
    ? hostPort.includes(']:')
    : hostPort.includes(':');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    hasExplicitPort ||
    !hostname.includes('.') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.startsWith('[') ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  ) return false;

  const records = await Promise.allSettled([
    Deno.resolveDns(hostname, 'A'),
    Deno.resolveDns(hostname, 'AAAA'),
  ]);
  const addresses = records.flatMap((record) => record.status === 'fulfilled' ? record.value : []);
  return addresses.length > 0 && addresses.every(isPublicAddress);
}

function textContentFromHtml(html: string): string {
  const withoutInactive = html.replace(
    /<(script|style|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ' ',
  );
  const withLineBreaks = withoutInactive.replace(
    /<\/?(?:p|div|li|br|h[1-6]|article|section|tr|td)[^>]*>/gi,
    '\n',
  );
  return withLineBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 35_000);
}

function recipeType(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some((type) =>
    typeof type === 'string' &&
    type.toLowerCase().split(/[\/#]/).at(-1) === 'recipe'
  );
}

function findRecipe(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (recipeType(record['@type'])) return record;
  if (Array.isArray(record['@graph'])) return findRecipe(record['@graph']);
  return null;
}

function instructionLines(value: unknown): string[] {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (Array.isArray(value)) return value.flatMap(instructionLines);
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return instructionLines(record.text);
  if (Array.isArray(record.itemListElement)) return instructionLines(record.itemListElement);
  return [];
}

function structuredRecipeFromHtml(html: string): RecipeImportDraft | null {
  const scripts = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi,
  );
  for (const script of scripts) {
    const json = script[1];
    if (!json) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      continue;
    }
    const recipe = findRecipe(parsed);
    if (!recipe || typeof recipe.name !== 'string') continue;
    const ingredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((text) => ({ text: text.trim(), confidence: 'high' as const }))
      : [];
    const steps = instructionLines(recipe.recipeInstructions);
    const yieldText = Array.isArray(recipe.recipeYield)
      ? String(recipe.recipeYield[0] ?? '')
      : String(recipe.recipeYield ?? '');
    const servingsMatch = yieldText.match(/\d+/);
    const draft: RecipeImportDraft = {
      kind: 'recipe_import_draft.v1',
      title: recipe.name.trim(),
      servings: servingsMatch ? Number(servingsMatch[0]) || null : null,
      ingredients,
      steps,
      notes: typeof recipe.description === 'string' ? recipe.description.trim() : null,
      warnings: [],
    };
    if (draft.title && draft.ingredients.length > 0 && draft.steps.length > 0) return draft;
  }
  return null;
}

function tagAttribute(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(
    new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value?.replace(/&amp;/gi, '&').replace(/&#x26;/gi, '&') ?? null;
}

/** Instagram's public Reel page exposes the downloadable CDN source as Open Graph metadata. */
export function extractPublicVideoUrl(html: string, pageUrl: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const property = (tagAttribute(tag, 'property') ?? tagAttribute(tag, 'name'))?.toLowerCase();
    if (!property || !['og:video', 'og:video:url', 'og:video:secure_url'].includes(property)) {
      continue;
    }
    const rawUrl = tagAttribute(tag, 'content');
    if (!rawUrl) continue;
    try {
      const mediaUrl = new URL(rawUrl.replace(/\\u0026/gi, '&').replace(/\\\//g, '/'), pageUrl);
      const hostname = mediaUrl.hostname.toLowerCase();
      const instagramCdn = hostname === 'cdninstagram.com' ||
        hostname.endsWith('.cdninstagram.com');
      const facebookCdn = hostname === 'fbcdn.net' || hostname.endsWith('.fbcdn.net');
      if (mediaUrl.protocol === 'https:' && (instagramCdn || facebookCdn)) return mediaUrl.href;
    } catch {
      // Ignore malformed metadata and continue to the next recognized tag.
    }
  }
  return null;
}

async function readLimitedText(response: Response): Promise<string | null> {
  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > 1_500_000) return null;
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > 1_500_000) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function loadRecipePage(url: string): Promise<
  | { ok: true; text: string; draft: RecipeImportDraft | null; videoUrl: string | null }
  | { ok: false; status: number; error: string }
> {
  let currentUrl = url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!await isPublicHttpsUrl(currentUrl)) {
      return { ok: false, status: 400, error: 'unsafe_source_url' };
    }

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
          'User-Agent': 'fam-recipe-import/1.0',
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { ok: false, status: 422, error: 'source_unavailable' };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === 3) {
        return { ok: false, status: 422, error: 'source_redirect_failed' };
      }
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        return { ok: false, status: 422, error: 'source_redirect_failed' };
      }
      continue;
    }
    if (!response.ok) return { ok: false, status: 422, error: 'source_unavailable' };
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { ok: false, status: 415, error: 'source_not_a_webpage' };
    }
    const html = await readLimitedText(response);
    if (html === null) return { ok: false, status: 413, error: 'source_too_large' };
    return {
      ok: true,
      text: textContentFromHtml(html),
      draft: structuredRecipeFromHtml(html),
      videoUrl: extractPublicVideoUrl(html, currentUrl),
    };
  }
  return { ok: false, status: 422, error: 'source_redirect_failed' };
}
