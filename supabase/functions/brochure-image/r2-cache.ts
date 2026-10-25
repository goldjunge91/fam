export type R2CacheConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export type CachedObject = { body: ArrayBuffer; contentType: string };

const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
  const keyBuffer = new ArrayBuffer(key.byteLength);
  new Uint8Array(keyBuffer).set(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)));
}

function canonicalHeaders(headers: Record<string, string>): { names: string; value: string } {
  const names = Object.keys(headers).sort();
  return {
    names: names.join(';'),
    value: names.map((name) => `${name}:${headers[name]!.trim()}\n`).join(''),
  };
}

async function signRequest(
  config: R2CacheConfig,
  key: string,
  method: 'GET' | 'PUT',
  contentType?: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${config.bucket}/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(contentType ? { 'content-type': contentType } : {}),
    ...(method === 'PUT' ? { 'if-none-match': '*' } : {}),
  };
  const signed = canonicalHeaders(headers);
  const canonicalRequest = [method, canonicalUri, '', signed.value, signed.names, payloadHash].join(
    '\n',
  );
  const requestHash = hex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))),
  );
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, requestHash].join('\n');
  let signingKey = await hmac(encoder.encode(`AWS4${config.secretAccessKey}`), dateStamp);
  signingKey = await hmac(signingKey, 'auto');
  signingKey = await hmac(signingKey, 's3');
  signingKey = await hmac(signingKey, 'aws4_request');
  const signature = hex(await hmac(signingKey, stringToSign));
  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      ...headers,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signed.names}, Signature=${signature}`,
    },
  };
}

export async function getR2Object(
  config: R2CacheConfig,
  key: string,
): Promise<CachedObject | null> {
  const signed = await signRequest(config, key, 'GET');
  const response = await fetch(signed.url, {
    headers: signed.headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`R2 cache GET failed with ${response.status}`);
  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get('content-type')?.split(';', 1)[0] ?? 'image/jpeg',
  };
}

export async function putR2Object(
  config: R2CacheConfig,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<'stored' | 'already-existed'> {
  const signed = await signRequest(config, key, 'PUT', contentType);
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (response.ok) return 'stored';
  if (response.status === 412) return 'already-existed';
  throw new Error(`R2 cache PUT failed with ${response.status}`);
}

export function cacheKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}
