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

function hasHtmlClass(tag: string, className: string): boolean {
  return tagAttribute(tag, 'class')?.split(/\s+/).includes(className) ?? false;
}

/** Extracts the visible caption block rendered by Instagram's captioned embed page. */
export function extractInstagramEmbedCaption(html: string): string | null {
  const visibleHtml = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  let depth = 0;
  let contentStart = -1;
  for (const match of visibleHtml.matchAll(/<\/?div\b[^>]*>/gi)) {
    const tag = match[0];
    const index = match.index ?? -1;
    if (index < 0) continue;
    if (/^<\//.test(tag)) {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0) {
        const caption = textContentFromHtml(visibleHtml.slice(contentStart, index))
          .replace(/[ \t]+\n/g, '\n')
          .trim();
        return caption || null;
      }
      continue;
    }
    if (depth > 0) {
      depth += 1;
      continue;
    }
    if (!hasHtmlClass(tag, 'Caption')) continue;
    depth = 1;
    contentStart = index + tag.length;
  }
  return null;
}

function instagramCaptionedEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'instagram.com' && !hostname.endsWith('.instagram.com')) return null;
    const reel = url.pathname.match(/^\/reel\/([a-z0-9_-]+)\/?$/i);
    if (!reel) return null;
    const embedUrl = new URL(url.origin);
    embedUrl.pathname = `/reel/${reel[1]}/embed/captioned/`;
    return embedUrl.href;
  } catch {
    return null;
  }
}

function isInstagramPageUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'instagram.com' || hostname.endsWith('.instagram.com') ||
      hostname === 'instagr.am' || hostname.endsWith('.instagr.am');
  } catch {
    return false;
  }
}

function safeCdnVideoUrl(rawUrl: string, pageUrl: string, requireMp4 = false): URL | null {
  try {
    const mediaUrl = new URL(
      rawUrl
        .replace(/&amp;|&#x26;|&#38;/gi, '&')
        .replace(/\\u0026/gi, '&')
        .replace(/\\\//g, '/'),
      pageUrl,
    );
    const hostname = mediaUrl.hostname.toLowerCase();
    const instagramCdn = hostname === 'cdninstagram.com' ||
      hostname.endsWith('.cdninstagram.com');
    const facebookCdn = hostname === 'fbcdn.net' || hostname.endsWith('.fbcdn.net');
    if (
      mediaUrl.protocol !== 'https:' ||
      mediaUrl.username ||
      mediaUrl.password ||
      mediaUrl.port ||
      (!instagramCdn && !facebookCdn) ||
      (requireMp4 && !mediaUrl.pathname.toLowerCase().endsWith('.mp4'))
    ) return null;
    return mediaUrl;
  } catch {
    return null;
  }
}

const MAX_VIDEO_VERSION_ARRAYS = 20;
const MAX_VIDEO_VERSION_ARRAY_LENGTH = 100_000;

function jsonArrayAt(source: string, start: number): string | null {
  if (source[start] !== '[') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    if (index - start > MAX_VIDEO_VERSION_ARRAY_LENGTH) return null;
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '[') depth += 1;
    else if (character === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

function hydratedVideoUrl(html: string, pageUrl: string): string | null {
  if (!isInstagramPageUrl(pageUrl)) return null;
  let bestCandidate: { url: string; pixels: number } | null = null;
  let arraysSeen = 0;

  for (const match of html.matchAll(/"video_versions"\s*:/g)) {
    if (arraysSeen >= MAX_VIDEO_VERSION_ARRAYS) break;
    arraysSeen += 1;
    let valueStart = (match.index ?? 0) + match[0].length;
    while (/\s/.test(html[valueStart] ?? '')) valueStart += 1;
    const arraySource = jsonArrayAt(html, valueStart);
    if (!arraySource) continue;

    let versions: unknown;
    try {
      versions = JSON.parse(arraySource);
    } catch {
      continue;
    }
    if (!Array.isArray(versions)) continue;
    for (const version of versions) {
      if (typeof version !== 'object' || version === null || Array.isArray(version)) continue;
      const record = version as Record<string, unknown>;
      if (typeof record.url !== 'string') continue;
      const mediaUrl = safeCdnVideoUrl(record.url, pageUrl, true);
      if (!mediaUrl) continue;
      const width = typeof record.width === 'number' && Number.isFinite(record.width)
        ? Math.max(record.width, 0)
        : 0;
      const height = typeof record.height === 'number' && Number.isFinite(record.height)
        ? Math.max(record.height, 0)
        : 0;
      const candidate = { url: mediaUrl.href, pixels: width * height };
      if (!bestCandidate || candidate.pixels > bestCandidate.pixels) bestCandidate = candidate;
    }
  }

  return bestCandidate?.url ?? null;
}

/** Resolves public Reel media without credentials, persistence, or a third-party downloader. */
export function extractPublicVideoUrl(html: string, pageUrl: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const property = (tagAttribute(tag, 'property') ?? tagAttribute(tag, 'name'))?.toLowerCase();
    if (!property || !['og:video', 'og:video:url', 'og:video:secure_url'].includes(property)) {
      continue;
    }
    const rawUrl = tagAttribute(tag, 'content');
    if (!rawUrl) continue;
    const mediaUrl = safeCdnVideoUrl(rawUrl, pageUrl);
    if (mediaUrl) return mediaUrl.href;
  }
  return hydratedVideoUrl(html, pageUrl);
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

type PublicHtmlResult =
  | { ok: true; url: string; html: string }
  | { ok: false; status: number; error: string };

async function loadPublicHtml(url: string): Promise<PublicHtmlResult> {
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
    return { ok: true, url: currentUrl, html };
  }
  return { ok: false, status: 422, error: 'source_redirect_failed' };
}

export async function loadRecipePage(url: string): Promise<
  | {
    ok: true;
    text: string;
    draft: RecipeImportDraft | null;
    videoUrl: string | null;
    instagramCaption?: string;
  }
  | { ok: false; status: number; error: string }
> {
  const page = await loadPublicHtml(url);
  if (!page.ok) return page;

  let instagramCaption: string | null = null;
  let instagramTitle: string | null = null;
  if (isInstagramPageUrl(page.url)) {
    for (const match of page.html.matchAll(/<meta\b[^>]*>/gi)) {
      const tag = match[0];
      const property = (tagAttribute(tag, 'property') ?? tagAttribute(tag, 'name'))
        ?.toLowerCase();
      const content = tagAttribute(tag, 'content');
      if (!content) continue;
      if (property === 'og:description') instagramCaption = textContentFromHtml(content);
      else if (property === 'og:title') instagramTitle = textContentFromHtml(content);
    }
    instagramCaption ||= instagramTitle;
    if (!instagramCaption) {
      const embedUrl = instagramCaptionedEmbedUrl(page.url);
      if (embedUrl) {
        const embedPage = await loadPublicHtml(embedUrl);
        if (embedPage.ok) instagramCaption = extractInstagramEmbedCaption(embedPage.html);
      }
    }
  }
  return {
    ok: true,
    text: textContentFromHtml(page.html),
    draft: structuredRecipeFromHtml(page.html),
    videoUrl: extractPublicVideoUrl(page.html, page.url),
    ...(instagramCaption ? { instagramCaption } : {}),
  };
}
