/**
 * Browser-Landeseite fuer Bestaetigungslinks. Das URL-Fragment wird nur im
 * Browser ausgewertet; Sessions stellt weiterhin die App her. Benoetigt
 * `verify_jwt = false`, da E-Mail-Links keinen Authorization-Header senden.
 */

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>E-Mail-Bestätigung</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f5f5f7; color: #1d1d1f; padding: 24px;
  }
  .card {
    background: #fff; border-radius: 20px; padding: 40px 32px; max-width: 420px;
    width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.08);
  }
  .icon { font-size: 48px; line-height: 1; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 12px; }
  p { margin: 0 0 8px; color: #6e6e73; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #f5f5f7; padding: 2px 6px; border-radius: 6px; color: #1d1d1f;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #000; color: #f5f5f7; }
    .card { background: #1c1c1e; box-shadow: none; }
    p { color: #98989d; }
    code { background: #2c2c2e; color: #f5f5f7; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="icon" id="icon">✓</div>
    <h1 id="title">E-Mail bestätigt</h1>
    <p id="text">Du kannst dieses Fenster schließen und zur App zurückkehren — sie geht von allein weiter.</p>
  </div>
<script>
  // Das Fragment erreicht die Edge Function nicht und wird deshalb im Browser ausgewertet.
  (function () {
    var params = new URLSearchParams(location.hash.slice(1));
    var error = params.get('error_description') || params.get('error_code') || params.get('error');
    if (!error) return;

    document.getElementById('icon').textContent = '!';
    document.getElementById('title').textContent = 'Dieser Link wurde schon benutzt';
    document.getElementById('text').innerHTML =
      'Der Bestätigungslink funktioniert nur ein einziges Mal. Wenn du ihn vorher schon einmal ' +
      'geöffnet hast, ist dein Konto bereits bestätigt — die App merkt das von selbst. ' +
      'Andernfalls gib den <code>6-stelligen Code</code> aus derselben E-Mail in der App ein.';
  })();
</script>
</body>
</html>`;

Deno.serve(() => {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Der Fragmentzustand darf nicht aus einem vorherigen Aufruf gecacht werden.
      'Cache-Control': 'no-store',
    },
  });
});
