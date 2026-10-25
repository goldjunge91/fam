import recoveryPage from "./password-recovery.html";
import appleAppSiteAssociation from "./apple-app-site-association.txt";

const routes = new Map([
  ["/password-recovery", [recoveryPage, "text/html; charset=utf-8"]],
  ["/password-recovery/", [recoveryPage, "text/html; charset=utf-8"]],
  [
    "/.well-known/apple-app-site-association",
    [appleAppSiteAssociation, "application/json; charset=utf-8"],
  ],
]);

export default {
  fetch(request) {
    const route = routes.get(new URL(request.url).pathname);
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
