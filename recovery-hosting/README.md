# Password recovery hosting

This folder contains the HTTPS app-link handler and association-file source
for password recovery. Mobile requests are forwarded to fam with Supabase's
recovery token hash. Desktop browsers receive a short page that asks the user
to open the same email on a smartphone or enter its one-time code in fam. The
page never verifies, displays, or forwards the recovery token.

## Domain and app configuration

`EXPO_PUBLIC_ACCOUNT_DOMAIN` is the single app-side hostname setting. It must
contain only a hostname, with no scheme, port, or path. The selected Cloudflare
test hostname is `account.test-tozzi.de`; replace it with the production
hostname before release. The app derives
`https://<hostname>/password-recovery`, adds the iOS Associated Domains entry,
and adds the Android App Link filter from that same value.

Set the final hostname in local build environments, EAS build profiles, and
the release environment before producing new native builds. A domain change
requires new iOS/Android builds and matching hosted files; it cannot be
delivered through an OTA update alone. Keep the local Supabase redirect
allow-list in `supabase/config.toml` and the hosted Supabase redirect allow-list
in sync with the selected hostname. The hosted project configuration is
separate from this repository and is not changed by editing local files.

## Worker routes

`worker.mjs` routes mobile requests for `/password-recovery` to
`fam:///password-recovery`, forwarding only `token_hash` and
`type=recovery`. On iOS, a correctly associated app link is opened by iOS
before the request reaches the Worker; the Worker redirect is a fallback for
mobile browsers. Desktop requests receive an accessible German guidance page
with no-store and no-referrer headers. The token query is removed from browser
history, and no auth verification happens on the page.

The Worker serves `/.well-known/apple-app-site-association` and
`/fam-email-icon.png`. The icon is a reduced PNG derived from the app icon and
is used by the Supabase email template. `fam-email-icon.base64.txt` is the
text module imported by the Worker; regenerate it after changing the PNG with:

```sh
base64 < recovery-hosting/fam-email-icon.png | tr -d '\n' > recovery-hosting/fam-email-icon.base64.txt
```

The AASA file uses the existing iOS Team ID and bundle ID from `app.json`.

`worker.mjs` is the small Cloudflare Worker entry point. Its multipart upload
uses `worker.mjs` as the `main_module`, with content type
`application/javascript+module`. Add one `text/plain` module part:
`apple-app-site-association.txt` from `.well-known/apple-app-site-association`.
The Worker returns a 302 for the app-link path, serves the AASA file, and
currently returns 404 for Android's asset-links path. Use compatibility date
`2026-10-25` in the upload metadata.

## Test deployment

The test Worker `fam-password-recovery-test` is deployed in Cloudflare account
`6237d34314fccc45bf5b2522f1660e91`, zone
`8070e990009a0c3b26f658615ad937d5` (`test-tozzi.de`). Its Worker ID is
`id508d95cc08aa482680240a38ca168ed7`. The custom domain
`account.test-tozzi.de` is attached with ID
`id05963fd681b92253827f0c4fbb302ae830f3652`.

The Worker is deployed to the test domain. The recovery endpoint returns a
desktop guidance page to desktop browsers and a `302` app-scheme handoff to
mobile browsers. The [AASA file](https://account.test-tozzi.de/.well-known/apple-app-site-association)
and email icon are served by the same Worker. Android's asset-links URL returns
404 because no real signing fingerprint is available yet. Cloudflare's default Python
`urllib` probe received BIC error 1010; the verification User-Agent
`fam-recovery-verification/1.0` passed. No Cloudflare security settings or
rules were changed.

Generate Android's `.well-known/assetlinks.json` only after retrieving the
actual SHA-256 signing fingerprint from Play App Signing (and any separately
distributed signing certificates). The repository deliberately does not make
up fingerprints:

```sh
ANDROID_SIGNING_CERT_SHA256='<real Play App Signing SHA-256 fingerprint>' \
  bun recovery-hosting/generate-assetlinks.mjs
```

The generator validates and normalizes one or more comma-separated SHA-256
fingerprints, then writes the JSON to stdout for review. Adding that output to
hosting also requires adding it to `worker.mjs` as a text module and serving
`/.well-known/assetlinks.json` with `application/json`; publishing the output
file alone will leave the current Worker response at 404. Upload the updated
Worker with the generated asset-links content as a text module.

## Supabase recovery email

The Supabase dashboard-ready HTML is `supabase/templates/recovery.html`; the
local Supabase config points at the same file. It includes the branded icon,
the HTTPS recovery link built from `{{ .RedirectTo }}` and `{{ .TokenHash }}`,
and `{{ .Token }}` for manual code entry. The hosted project template is
managed separately in the Supabase dashboard; this repository change does not
upload it. The hosted redirect allow-list includes the HTTPS recovery URL.
Existing Resend SMTP settings were not changed.

## Remaining release work

- Retrieve real Android signing fingerprints, generate `assetlinks.json`, add
  it as a Worker text module and route, then deploy the updated Worker.
- Before production release, switch from the test hostname to the production
  hostname and update hosting, Supabase redirect settings, and native builds.
- Build and install signed iOS and Android apps for the chosen release hostname
  and verify cold-start and warm-start links on devices.
