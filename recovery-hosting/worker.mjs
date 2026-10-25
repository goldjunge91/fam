import appleAppSiteAssociation from "./apple-app-site-association.txt";

const routes = new Map([
  ["/.well-known/apple-app-site-association", [appleAppSiteAssociation, "application/json; charset=utf-8"]],
]);

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/password-recovery" || url.pathname === "/password-recovery/") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        });
      }

      const appUrl = new URL("fam:///password-recovery");
      const tokenHash = url.searchParams.get("token_hash");
      if (tokenHash && url.searchParams.get("type") === "recovery") {
        appUrl.searchParams.set("token_hash", tokenHash);
        appUrl.searchParams.set("type", "recovery");
      }

      return new Response(null, {
        status: 302,
        headers: {
          "Cache-Control": "no-store",
          Location: appUrl.toString(),
          "Referrer-Policy": "no-referrer",
        },
      });
    }

    const route = routes.get(url.pathname);
    if (!route) return new Response(null, { status: 404 });

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const [body, contentType] = route;
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
