/**
 * Minimaler AWS-SigV4-Presigner für R2, abgeleitet vom node:crypto-Schema des
 * Crawlers (tools/crawler/brochures/r2-storage.ts), aber mit Web Crypto
 * (HMAC-SHA256) statt Node-Paketen — Edge Functions laufen auf Deno.
 */

const encoder = new TextEncoder();

async function hmac(
  secret: string | Uint8Array,
  message: string,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(
      typeof secret === "string" ? secret : new TextDecoder().decode(secret),
    ),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return new Uint8Array(signature);
}

export type R2SignatureConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export type PresignOptions = {
  key: string;
  expiresSeconds?: number;
  now?: Date;
};

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isR2SignatureConfigured(
  config: Partial<R2SignatureConfig> | null,
): config is R2SignatureConfig {
  return Boolean(
    config?.accountId && config.accessKeyId && config.secretAccessKey &&
      config.bucket,
  );
}

/**
 * Erzeugt eine Presigned-GET-URL mit SigV4-Query-Authentifizierung (X-Amz-*).
 * R2 akzeptiert die Signatur, wenn Bucket, Key, Ablauf und Zugangsdaten exakt
 * stimmen.
 */
export async function presignR2Get(
  config: R2SignatureConfig,
  { key, expiresSeconds = 60, now = new Date() }: PresignOptions,
): Promise<string> {
  const clampedExpiry = Math.min(Math.max(expiresSeconds, 1), 600);
  const host = config.accountId + ".r2.cloudflarestorage.com";
  const canonicalUri = "/" + config.bucket + "/" + key;

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = dateStamp + "/auto/s3/aws4_request";
  const payloadHash = hex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(0))),
  );

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": config.accessKeyId + "/" + scope,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(clampedExpiry),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) =>
      encodeQueryComponent(name) + "=" + encodeQueryComponent(query[name])
    )
    .join("&");
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    "host:" + host + "\n",
    "host",
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hex(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest)),
      ),
    ),
  ].join("\n");

  let signingKey = await hmac("AWS4" + config.secretAccessKey, dateStamp);
  signingKey = await hmac(signingKey, "auto");
  signingKey = await hmac(signingKey, "s3");
  signingKey = await hmac(signingKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));

  return "https://" + host + canonicalUri + "?" + canonicalQuery +
    "&X-Amz-Signature=" + signature;
}
