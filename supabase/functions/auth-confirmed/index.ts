/**
 * Landeseite des E-Mail-Bestaetigungslinks.
 *
 * Warum eine Edge Function und keine Route in der App: Der Link wird per
 * Definition ausserhalb der App geoeffnet — im Browser auf dem Rechner, im
 * Mailclient auf einem fremden Geraet. Dort gibt es kein React Native, und ein
 * `fam://`-Ziel laesst sich nicht aufloesen. Ein Expo-Web-Build kaeme dafuer
 * ebenfalls in Frage, ist hier aber bewusst nicht im Spiel. Die Function liegt
 * dagegen im selben Supabase-Projekt wie GoTrue und ist lokal wie remote unter
 * derselben Adresse erreichbar.
 *
 * Vorher zeigte der Browser nach dem Klick "Die Website ist nicht erreichbar" —
 * `site_url` war `http://127.0.0.1:3000` und dort lauscht nichts. Die
 * Bestaetigung hatte trotzdem stattgefunden, aber das war der Seite nicht
 * anzusehen.
 *
 * Wichtig: GoTrue haengt das Ergebnis als **Fragment** an (`#access_token=…`
 * bzw. `#error=…`). Ein Fragment wird nie an den Server geschickt — diese
 * Function sieht es also nicht und darf den Ausgang nicht raten. Deshalb
 * entscheidet ein kleines Skript im Browser, was angezeigt wird.
 *
 * Die Tokens werden bewusst NICHT eingeloest: Die App holt sich die Session
 * selbst (Polling in PendingAuthBanner bzw. der 6-stellige Code). Diese Seite
 * informiert nur.
 *
 * Braucht `verify_jwt = false` (supabase/config.toml) — ein Browser, der einem
 * Link aus einer E-Mail folgt, schickt keinen Authorization-Header.
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
  // Das Fragment erreicht den Server nie, deshalb entscheidet sich hier, was
  // die Seite zeigt. Ohne diese Unterscheidung meldete sie auch dann Erfolg,
  // wenn der Link bereits verbraucht war.
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
      // Die Seite ist statisch, aber der Zustand steckt im Fragment. Kein
      // Caching, damit ein zweiter Aufruf nicht aus dem Cache kommt.
      'Cache-Control': 'no-store',
    },
  });
});
