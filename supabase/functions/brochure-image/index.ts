import { createClient } from "jsr:@supabase/supabase-js@2";

import { type AuthResult, createBrochureImageHandler } from "./handler.ts";
import {
  isR2SignatureConfigured,
  presignR2Get,
  type R2SignatureConfig,
} from "./r2-signature.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const r2Config: Partial<R2SignatureConfig> = {
  accountId: Deno.env.get("R2_ACCOUNT_ID"),
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID"),
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY"),
  bucket: Deno.env.get("R2_BUCKET"),
};
const signedUrlTtl = Number(Deno.env.get("BROCHURE_IMAGE_TTL_SECONDS") ?? 60);

function userClient(request: Request) {
  const authorization = request.headers.get("Authorization");
  return createClient(supabaseUrl, anonKey, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

async function authenticate(request: Request): Promise<AuthResult> {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return { ok: false, status: 401, error: "missing_authorization" };
  }

  const { data, error } = await userClient(request).auth.getUser();
  if (error || !data.user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true, userId: data.user.id };
}

if (!isR2SignatureConfigured(r2Config)) {
  console.error("brochure_image_r2_config_missing");
}

const handler = createBrochureImageHandler({
  authenticate,
  getSignedUrl: async (key) => {
    if (!isR2SignatureConfigured(r2Config)) {
      return { ok: false, status: 503, error: "r2_not_configured" };
    }
    try {
      const url = await presignR2Get(r2Config, {
        key,
        expiresSeconds: Number.isFinite(signedUrlTtl) ? signedUrlTtl : 60,
      });
      const expiresAt = new Date(
        Date.now() + (Number.isFinite(signedUrlTtl) ? signedUrlTtl : 60) * 1000,
      ).toISOString();
      return { ok: true, url, expiresAt };
    } catch (error) {
      console.error("brochure_image_presign_failed", error);
      return { ok: false, status: 502, error: "presign_failed" };
    }
  },
});

Deno.serve(async (request) => {
  try {
    return await handler(request);
  } catch (error) {
    console.error("brochure_image_unhandled_error", error);
    return new Response(
      JSON.stringify({ error: "brochure_image_unavailable" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
});
