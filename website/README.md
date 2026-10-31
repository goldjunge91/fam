# Scrappy Website

Statische, responsive Website ohne Build-Schritt, JavaScript-Runtime oder externe Schriftarten. Die vorherige warme Creme-/Orange-Palette bleibt auf Marcos Wunsch erhalten; das Betriebssystem steuert Hell-/Dunkeldarstellung.

| Datei | Inhalt |
| --- | --- |
| `index.html` | Produkt und Funktionen |
| `faq.html` | Häufige Fragen mit nativen, per Tastatur bedienbaren Aufklappelementen |
| `support.html` | Kontakt, Fehlerberichte, Kontolöschung und Kaufhilfe |
| `impressum.html` | Anbieterkennzeichnung, derzeit ausdrücklich mit Musterangaben |
| `datenschutz.html` | Datenschutzerklärung für App, Website und Kontakt |
| `agb.html` | Nutzungsbedingungen, keine als Apple-EULA ausgegebene Vereinbarung |
| `styles.css` | Gemeinsames Layout, Hell-/Dunkelmodus, Druckdarstellung |
| `favicon.svg` | Lokales Website-Icon |
| `wrangler.jsonc` | Statische Asset-Konfiguration für Cloudflare Workers Builds |
| `RELEASE-CHECK.md` | Geprüfte Apple-Webanforderungen und offene Veröffentlichungsnachweise |

## Veröffentlichung auf Cloudflare

Das Verzeichnis `website` wird über Cloudflare Workers Builds (Service `fam`) bereitgestellt. Die Konfiguration in `wrangler.jsonc` definiert das aktuelle Verzeichnis als statische Assets (`assets.directory = "."`), sodass sowohl Produktions-Deployments (`wrangler deploy`) als auch Branch-Previews (`wrangler preview`) zuverlässig ausgeliefert werden. Bestehende `.html`-Adressen bleiben erhalten. Die FAQ ist zusätzlich unter `faq.html` erreichbar.

Die Navigation ist absichtlich einfach und auf jeder HTML-Seite enthalten. Änderungen an Navigation oder Footer auf allen Seiten nachziehen. Es ist kein Framework oder Generator nötig.

## App Store Connect

Erst nach Bestätigung der Produktionsdomain und erfolgreicher öffentlicher HTTPS-Prüfung diese Seiten eintragen:

| Feld | Pfad auf der bestätigten Domain |
| --- | --- |
| Marketing URL | `/` |
| Support URL | `/support.html` |
| Privacy Policy URL | `/datenschutz.html` |

Die bisher verwendete Domain `scrappy-app.de` und die Support-Adresse `support@scrappy-app.de` sind noch nicht als betriebsbereit bestätigt. Mustermann-Anbieterangaben müssen vor Veröffentlichung ersetzt werden. Die Website ist deshalb noch nicht zur Store-Einreichung freigegeben. Weitere Nachweise stehen im Prüfbericht.
