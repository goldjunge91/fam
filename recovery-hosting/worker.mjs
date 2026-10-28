import appleAppSiteAssociation from "./apple-app-site-association.txt";
import famEmailIconBase64 from "./fam-email-icon.base64.txt";

const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i;
const emailIcon = Uint8Array.from(atob(famEmailIconBase64.trim()), (char) => char.charCodeAt(0));

const desktopRecoveryPage = (nonce) => `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="referrer" content="no-referrer">
    <title>Passwort in fam zurücksetzen</title>
    <style>
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #342a34; background: #f7f2ed; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; padding: 32px 20px; display: grid; place-items: center; }
      main { width: min(100%, 440px); padding: 36px 32px; border: 1px solid #e8dfe6; border-radius: 20px; background: #fffdfa; box-shadow: 0 18px 48px rgba(67, 45, 65, .09); text-align: center; }
      img { width: 64px; height: 64px; border-radius: 16px; }
      .brand { margin: 10px 0 28px; color: #6d506b; font-size: 20px; font-weight: 700; letter-spacing: -.04em; }
      h1 { margin: 0; font-size: clamp(25px, 6vw, 32px); line-height: 1.15; letter-spacing: -.04em; }
      p { margin: 16px 0 0; color: #554b55; font-size: 16px; line-height: 1.6; }
      .note { margin-top: 24px; padding: 16px; border-radius: 12px; background: #f3edf3; color: #51424f; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <img src="/fam-email-icon.png" width="64" height="64" alt="">
      <div class="brand">fam</div>
      <h1>Öffne den Link auf deinem Smartphone</h1>
      <p>Dieser Passwortlink funktioniert in der fam-App auf deinem Smartphone. Öffne dieselbe E-Mail dort und tippe erneut auf den Link.</p>
      <p class="note">Du kannst alternativ den Einmalcode aus der E-Mail in der fam-App eingeben. Der Code und der Link sind jeweils eine Stunde gültig.</p>
    </main>
    <script nonce="${nonce}">if (location.search) history.replaceState(null, "", location.pathname);</script>
  </body>
</html>`;

const securityHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export default {
  fetch(request) {
    const url = new URL(request.url);
    const method = request.method;

    if (method !== "GET" && method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    if (url.pathname === "/password-recovery" || url.pathname === "/password-recovery/") {
      const userAgent = request.headers.get("User-Agent") ?? "";
      const isMobile = request.headers.get("Sec-CH-UA-Mobile") === "?1" || mobileUserAgent.test(userAgent);

      if (method === "GET" && isMobile) {
        const appUrl = new URL("fam:///password-recovery");
        const tokenHash = url.searchParams.get("token_hash");
        if (tokenHash && url.searchParams.get("type") === "recovery") {
          appUrl.searchParams.set("token_hash", tokenHash);
          appUrl.searchParams.set("type", "recovery");
        }

        return new Response(null, {
          status: 302,
          headers: {
            ...securityHeaders,
            Location: appUrl.toString(),
          },
        });
      }

      const nonce = crypto.randomUUID().replaceAll("-", "");
      return new Response(method === "HEAD" ? null : desktopRecoveryPage(nonce), {
        status: 200,
        headers: {
          ...securityHeaders,
          "Content-Security-Policy": `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    if (url.pathname === "/fam-email-icon.png") {
      return new Response(method === "HEAD" ? null : emailIcon, {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=604800, immutable",
          "Content-Type": "image/png",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (url.pathname === "/.well-known/apple-app-site-association") {
      return new Response(method === "HEAD" ? null : appleAppSiteAssociation, {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=300",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new Response(null, { status: 404 });
  },
};
