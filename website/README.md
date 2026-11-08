# Scrappy Website

Statische, responsive Website ohne Build-Schritt oder Framework. Die Inhaltsseiten benötigen kein Client-JavaScript; der Adminbereich nutzt JavaScript für Anmeldung und Nutzungsansicht. Externe Schriftarten werden nicht geladen.

| Datei | Inhalt |
| --- | --- |
| `index.html` | Produkt und Funktionen |
| `faq.html` | Häufige Fragen mit nativen, per Tastatur bedienbaren Aufklappelementen |
| `support.html` | Kontakt, Fehlerberichte, Kontolöschung und Kaufhilfe |
| `impressum.html` | Anbieterkennzeichnung, derzeit ausdrücklich mit Musterangaben |
| `datenschutz.html` | Datenschutzerklärung für App, Website und Kontakt |
| `agb.html` | Nutzungsbedingungen, keine als Apple-EULA ausgegebene Vereinbarung |
| `styles.css` | Gemeinsames Layout, Hell-/Dunkelmodus, Druckdarstellung |
| `admin/` | Geschützter Adminbereich mit Nutzer- und KI-Creditübersicht |
| `worker.ts` | Serverendpunkte für Admin-Anmeldung, Rollenprüfung und Nutzungsdaten |
| `favicon.svg` | Lokales Website-Icon |
| `wrangler.jsonc` | Cloudflare-Worker- und Asset-Konfiguration für Workers Builds |
| `RELEASE-CHECK.md` | Geprüfte Apple-Webanforderungen und offene Veröffentlichungsnachweise |

## Veröffentlichung auf Cloudflare

Das Verzeichnis `website` wird über Cloudflare Workers Builds (Service `fam`) bereitgestellt. Die Konfiguration in `wrangler.jsonc` definiert das aktuelle Verzeichnis als statische Assets (`assets.directory = "."`), sodass sowohl Produktions-Deployments (`wrangler deploy`) als auch Branch-Previews (`wrangler preview`) zuverlässig ausgeliefert werden. Bestehende `.html`-Adressen bleiben erhalten. Die FAQ ist zusätzlich unter `faq.html` erreichbar.

Die Navigation ist absichtlich einfach und auf jeder HTML-Seite enthalten. Änderungen an Navigation oder Footer auf allen Seiten nachziehen. Es ist kein Framework oder Generator nötig.

## Adminbereich

Der Adminbereich ist unter `/admin/` erreichbar. Die HTML-, CSS- und JS-Dateien enthalten keine echten Nutzerdaten und keine Secret API Keys. Cloudflare leitet `/api/admin/*` an den Worker; alle anderen Anfragen werden als statische Assets ausgeliefert.

Die Plattformrolle ist von einer Haushaltsrolle getrennt. Supabase Auth speichert sie als `app_metadata.platform_role = "supa-admin"`. Der Worker prüft sie bei der Anmeldung, beim Erneuern einer Sitzung und vor jeder Nutzerdaten-Abfrage. `user_metadata` wird nicht für die Zugriffsentscheidung verwendet.

Für `supa-admin`-Einladungen muss unter Supabase Authentication → URL Configuration `https://fam.tozzi9142.workers.dev/admin/` in `Redirect URLs` freigegeben sein. Beim Erstellen einer Einladung muss diese Adresse außerdem als `redirectTo` gesetzt werden. Die globale `Site URL` bleibt das Ziel für andere Auth-Flows. Diese gehostete Einstellung wurde noch nicht geändert.

Für die Rollenvergabe muss `SUPABASE_URL` und `SUPABASE_SECRET_KEY` in der lokalen Umgebung gesetzt sein. Die User-ID kann in Supabase Auth unter Authentication → Users gefunden werden. Die Bestätigung wiederholt die ID, damit ein Rollenwechsel nicht versehentlich auf ein falsches Konto angewendet wird:

```sh
bun scripts/manage-supa-admin-role.ts grant <user-id> --confirm-user-id=<user-id>
bun scripts/manage-supa-admin-role.ts revoke <user-id> --confirm-user-id=<user-id>
```

Cloudflare Worker Variables und Secrets für den Service `fam`:

| Name | Typ | Verwendung |
| --- | --- | --- |
| `SUPABASE_URL` | Variable | Supabase-Projekt-URL |
| `SUPABASE_PUBLISHABLE_KEY` | Variable | Auth-Anfragen des Workers |
| `SUPABASE_SECRET_KEY` | Secret | Admin API und Datenbankabfragen; nur serverseitig |

`keep_vars` bewahrt die im Cloudflare-Dashboard gesetzten Variablen bei einem Wrangler-Deployment. Der Secret API Key muss als Worker Secret gesetzt sein. Er darf nicht in HTML, Browser-JavaScript, `wrangler.jsonc` oder Git liegen. Die Nutzungsansicht zeigt monatliche Credits nach UTC, keine tatsächlichen Modell-Tokens.

Der Worker liest Profile sowie Buchungen und Erstattungen des ausgewählten Monats. Für die Übersicht braucht es keine Datenbankschemaänderung. `website/.assetsignore` hält den Worker-Quelltext aus der öffentlichen Asset-Auslieferung heraus.

## App Store Connect

Erst nach Bestätigung der Produktionsdomain und erfolgreicher öffentlicher HTTPS-Prüfung diese Seiten eintragen:

| Feld | Pfad auf der bestätigten Domain |
| --- | --- |
| Marketing URL | `/` |
| Support URL | `/support.html` |
| Privacy Policy URL | `/datenschutz.html` |

Die bisher verwendete Domain `scrappy-app.de` und die Support-Adresse `support@scrappy-app.de` sind noch nicht als betriebsbereit bestätigt. Mustermann-Anbieterangaben müssen vor Veröffentlichung ersetzt werden. Die Website ist deshalb noch nicht zur Store-Einreichung freigegeben. Weitere Nachweise stehen im Prüfbericht.
