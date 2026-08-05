#!/usr/bin/env bash
#
# seed-issues.sh — legt Milestones, Labels und die komplette NutriTrack-Taskliste
# als GitHub Issues an.
#
# Voraussetzungen:  gh auth login  ·  ein konfiguriertes origin-Remote
# Aufruf:           bash scripts/seed-issues.sh
#
# Das Skript ist NICHT idempotent für Issues — ein zweiter Lauf legt Duplikate an.
# Milestones und Labels werden übersprungen, wenn sie schon existieren.

set -euo pipefail

# ---------------------------------------------------------------- key -> number
MAP="$(mktemp)"
LATE="$(mktemp)"
trap 'rm -f "$MAP" "$LATE"' EXIT

reg() { printf '%s\t%s\n' "$1" "$2" >>"$MAP"; }
num() { awk -F'\t' -v k="$1" '$1 == k { print $2 }' "$MAP"; }

# deps 1.2 1.9  ->  "Blocked by #12, #19"
# Ein noch nicht angelegter Key waere still verschwunden — deshalb laut warnen.
deps() {
  local out="" k n
  for k in "$@"; do
    n="$(num "$k")"
    if [ -z "$n" ]; then
      echo "WARNUNG: Vorwaertsreferenz auf $k — 'later' verwenden" >&2
      continue
    fi
    out="${out:+$out, }#$n"
  done
  [ -n "$out" ] && printf 'Blocked by %s' "$out"
}

# later <key> <dep-key> — Abhaengigkeit auf ein Issue, das erst spaeter
# angelegt wird. Wird nach dem Durchlauf per 'gh issue edit' nachgetragen.
later() { printf '%s\t%s\n' "$1" "$2" >>"$LATE"; }

# partof E1  ->  "Part of #3"
partof() {
  local n
  n="$(num "$1")"
  [ -n "$n" ] && printf 'Part of #%s' "$n"
}

# mk <key> <milestone> <labels> <title> <body> [trailer...]
mk() {
  local key="$1" ms="$2" labels="$3" title="$4" body="$5"
  shift 5
  local trailer=""
  for t in "$@"; do [ -n "$t" ] && trailer="${trailer}${t}"$'\n'; done

  local full url n
  full="$body"
  [ -n "$trailer" ] && full="$body"$'\n\n'"---"$'\n'"$trailer"

  url="$(gh issue create --title "$title" --body "$full" --milestone "$ms" --label "$labels")"
  n="${url##*/}"
  reg "$key" "$n"
  printf '  #%-4s %s\n' "$n" "$title"
  sleep 1 # GitHub secondary rate limit für Content-Erstellung
}

# ----------------------------------------------------------------- milestones
echo "==> Milestones"
for m in \
  "Phase 0 - Foundation|Setup, Datenmodell, RLS und Offline-Sync. Blockiert alle Features." \
  "Phase 1 - MVP|Auth, Haushalt, Kuehlschrank, Basis-Kalorien, Dashboard." \
  "Phase 2 - Core|Einkaufsliste, Rezepte, Fortschritt, Push." \
  "Phase 3 - Advanced|Meal-Planner, Preisvergleich, Health-Integration, Fasten." \
  "Phase 4 - Community|Gamification, Sharing, Analytics, Monetarisierung."; do
  title="${m%%|*}"
  desc="${m##*|}"
  if gh api repos/:owner/:repo/milestones --jq '.[].title' | grep -qxF "$title"; then
    echo "  = $title (existiert)"
  else
    gh api repos/:owner/:repo/milestones -f title="$title" -f description="$desc" >/dev/null
    echo "  + $title"
  fi
done

# --------------------------------------------------------------------- labels
echo "==> Labels"
for l in \
  "epic|6f42c1|Sammel-Issue fuer einen Themenblock" \
  "setup|0e8a16|Tooling, Build, Konfiguration" \
  "backend|1d76db|Supabase, SQL, Edge Functions" \
  "rls|b60205|Row Level Security / Zugriffskontrolle" \
  "offline-sync|fbca04|expo-sqlite, Outbox, Konfliktaufloesung" \
  "feature|0075ca|Fachliche Funktion" \
  "ui|c2e0c6|Screens und Komponenten" \
  "test|d4c5f9|Tests und Testinfrastruktur" \
  "docs|cfd3d7|Dokumentation" \
  "risk|e99695|Technisches oder rechtliches Risiko" \
  "native|5319e7|Braucht Development Build, laeuft nicht in Expo Go"; do
  name="${l%%|*}"
  rest="${l#*|}"
  color="${rest%%|*}"
  desc="${rest##*|}"
  if gh label list --limit 100 --json name --jq '.[].name' | grep -qxF "$name"; then
    echo "  = $name"
  else
    gh label create "$name" --color "$color" --description "$desc" >/dev/null
    echo "  + $name"
  fi
done

P0="Phase 0 - Foundation"
P1="Phase 1 - MVP"
P2="Phase 2 - Core"
P3="Phase 3 - Advanced"
P4="Phase 4 - Community"

# ==========================================================================
echo "==> Epics"
# ==========================================================================

mk E0 "$P0" "epic,setup" "Epic 0 — Foundation: Tooling, Supabase, EAS" "$(
  cat <<'EOF'
Alles, was stehen muss, bevor die erste Zeile Feature-Code sinnvoll ist.

Das Repo ist aktuell ein unveraendertes Expo-SDK-57-Default-Template. Von dem
im README beschriebenen Stack ist nichts installiert: kein Supabase, kein
expo-sqlite, kein Biome, keine Tests, kein eas.json.

**Styling-Entscheidung:** Es wird KEIN NativeWind eingefuehrt. Stable 4.2.6 ist
nicht fuer RN 0.86 / React 19 gebaut, und die SDK-57-Variante gaebe es nur als
`nativewind@5.0.0-preview.4`. Wir bleiben bei `StyleSheet` +
`src/constants/theme.ts`, wie das Template es vorgibt.

**Done, wenn:** `bun run check` und `bun test` gruen sind, ein Development
Build auf iOS und Android laeuft und die App eine authentifizierte
Supabase-Session ueber einen Neustart hinweg haelt.
EOF
)"

mk E1 "$P0" "epic,backend,rls" "Epic 1 — Datenmodell & Row Level Security" "$(
  cat <<'EOF'
Das Schema in `supabase/migrations/` ist Source of Truth — nicht das Dashboard.

Kern der Anforderung: **geteilte Haushaltsdaten** (Kuehlschrank, Einkaufsliste)
gegenueber **strikt privaten Nutzerdaten** (Kalorien, Gewicht, Ziele) auf
DB-Ebene trennen. Das ist keine UI-Frage — es muss in den Policies stehen.

**Done, wenn:** die RLS-Integrationssuite (#1.10) gegen eine echte lokale
Postgres-Instanz gruen ist und nachweist, dass ein Haushaltsmitglied die
`food_entries` eines anderen Mitglieds weder lesen noch schreiben kann.
EOF
)"

mk E2 "$P0" "epic,offline-sync" "Epic 2 — Offline-Layer & Sync-Engine" "$(
  cat <<'EOF'
Der technisch riskanteste Teil des Projekts. Zwei Anforderungen aus dem README
kollidieren miteinander und muessen zusammen geloest werden:

1. Aenderungen im Offline-Modus werden lokal gespeichert und spaeter synchronisiert.
2. Aenderungen an geteilten Daten erscheinen bei allen Mitgliedern in Echtzeit.

Ansatz: `expo-sqlite` als lokale Wahrheit, eine Outbox-Queue fuer ausgehende
Mutationen, Last-Write-Wins ueber `updated_at` mit Soft-Delete-Tombstones, und
eine Realtime-Subscription, die eingehende Aenderungen in SQLite spiegelt.

**Bewusste Vereinfachung:** LWW, kein CRDT. Bei gleichzeitiger Bearbeitung
gewinnt der spaetere Schreibzugriff. Undo ist Aufgabe der UI, nicht der Engine.
EOF
)"

mk E3 "$P1" "epic,feature" "Epic 3 — Auth & Onboarding" "$(
  cat <<'EOF'
Supabase Auth mit E-Mail/Passwort. Social Login ist bewusst spaeter.

Achtung auf die Session-Persistenz: `expo-secure-store` hat auf iOS ein Limit
von rund 2048 Byte pro Wert, eine Supabase-Session ueberschreitet das
regelmaessig. Ohne chunkenden Storage-Adapter (#0.6) ist der Nutzer nach jedem
App-Neustart still ausgeloggt.
EOF
)"

mk E4 "$P1" "epic,feature" "Epic 4 — Haushalt & Familie (Multi-Account)" "$(
  cat <<'EOF'
Der gemeinsame Haushalt ist das strukturelle Herzstueck: er bestimmt, wer welche
Daten sieht. Rollen Admin/Mitglied, Einladung per Link und QR-Code,
Kinder-Profile ohne eigenen Account, Mitgliedschaft in mehreren Haushalten.

Setzt Epic 1 vollstaendig voraus — insbesondere die rekursionsfreien
`household_members`-Policies.
EOF
)"

mk E5 "$P1" "epic,feature" "Epic 5 — Kuehlschrank-Tracker" "$(
  cat <<'EOF'
Digitaler Bestand fuer Kuehlschrank, Gefrierfach und Vorratsschrank — fuer alle
Haushaltsmitglieder in Echtzeit sichtbar, mit MHD-Tracking und Erinnerungen.

Erstes Feature, das Epic 2 (Offline) und Epic 4 (Haushalt) gleichzeitig
belastet, und damit der eigentliche Integrationstest der Architektur.
EOF
)"

mk E6 "$P1" "epic,feature" "Epic 6 — Lebensmittel-Datenbank & Barcode" "$(
  cat <<'EOF'
Open Food Facts als Datenquelle, gespiegelt in eine eigene `products`-Tabelle,
damit Suche und Offline-Zugriff nicht von einem fremden Dienst abhaengen.

Kann parallel zu Epic 3 und 4 laufen — beruehrt keine Haushaltsdaten.
EOF
)"

mk E7 "$P1" "epic,feature" "Epic 7 — Kalorienziele & Ernaehrungstagebuch" "$(
  cat <<'EOF'
Zielberechnung (Mifflin-St Jeor, Harris-Benedict), Makro-Verteilung und das
taegliche Tagebuch. Alle Daten hier sind **privat pro Account** und werden
nicht mit dem Haushalt geteilt.

Die Formeln werden als reine Funktionen ohne I/O implementiert, damit sie
mock-frei gegen bekannte Referenzwerte getestet werden koennen.
EOF
)"

mk E8 "$P1" "epic,ui" "Epic 8 — Dashboard & Navigation" "$(
  cat <<'EOF'
Tab-Struktur, Tagesuebersicht, Fortschrittsringe und die Modul-Aktivierung aus
der modularen Architektur des README.

**Wichtig:** Jede Aenderung an bestehender UI bekommt einen eigenen Commit
(Vorgabe aus CLAUDE.md). `src/components/ui/` wird nicht angefasst.
EOF
)"

mk E9 "$P1" "epic,docs" "Epic 9 — Datenschutz & Compliance" "$(
  cat <<'EOF'
Datenexport, Loeschrecht, Store-Privacy-Labels.

**Korrektur zur README-Vision:** Das README verspricht
"End-to-End-Verschluesselung sensibler Gesundheitsdaten bei der
Cloud-Synchronisation". Das ist mit Supabase nicht einloesbar — E2EE und
serverseitige Queries/RLS schliessen sich gegenseitig aus. Wir formulieren
ehrlich: RLS + TLS in transit + Verschluesselung at rest.
EOF
)"

# ------------------------------------------------ Platzhalter-Epics Phase 2-4

mk E_P2_SHOP "$P2" "epic,feature" "Epic — Einkaufsliste & Uebernahme in den Bestand" "$(
  cat <<'EOF'
Gemeinsame Einkaufsliste mit Echtzeit-Abhaken. Der Button "Einkauf abschliessen"
uebertraegt alle abgehakten Artikel als neuen Bestand in den Kuehlschrank —
inklusive Mengen und, falls vorhanden, MHD aus der Produktdatenbank.

Nicht abgehakte Artikel bleiben ausdruecklich auf der Liste stehen.

Wird aufgeschluesselt, sobald Epic 5 steht.
EOF
)"

mk E_P2_RECIPE "$P2" "epic,feature" "Epic — Rezept-Manager & Rezept-Builder" "$(
  cat <<'EOF'
Eigene Rezeptsammlung, im Haushalt geteilt, mit automatischer
Naehrwertberechnung aus den Zutaten und Portionsskalierung.

Wird aufgeschluesselt, sobald Epic 6 und 7 stehen.
EOF
)"

mk E_P2_PROGRESS "$P2" "epic,feature" "Epic — Fortschritts-Tracking & Charts" "$(
  cat <<'EOF'
Gewichtsverlauf, Koerpermasse, Kalorienbilanz-Historie mit Trendlinien.

Chart-Library ist noch offen: `victory-native` (v41, Skia-basiert, braucht
@shopify/react-native-skia) gegen eine eigene Loesung auf `react-native-svg`,
das ohnehin fuer die Fortschrittsringe gebraucht wird.

Hinweis aus dem README: detaillierte Fortschritts-Diagramme wurden dort als
moeglicher Frustfaktor markiert ("spaeter oder gar nicht"). Vor der Umsetzung
bewusst entscheiden.
EOF
)"

mk E_P2_PUSH "$P2" "epic,feature,native" "Epic — Push-Benachrichtigungen" "$(
  cat <<'EOF'
Remote Push ueber expo-notifications und Supabase Edge Functions als Trigger.
Lokale Benachrichtigungen (MHD, Streaks) kommen bereits frueher in Epic 5.
EOF
)"

mk E_P3_MEALPLAN "$P3" "epic,feature" "Epic — Meal-Planner (Wochenplanung)" "$(
  cat <<'EOF'
Wochenplanung fuer den ganzen Haushalt, Zuordnung einzelner Mahlzeiten zu
Mitgliedern, Drag & Drop ueber react-native-gesture-handler,
wiederverwendbare Plaene.
EOF
)"

mk E_P3_PRICE "$P3" "epic,feature,risk" "Epic — Supermarkt-Preisvergleich (PriceProvider)" "$(
  cat <<'EOF'
**Risiko — Abweichung von der README-Vision.**

Das README nennt "REWE-API/EDEKA-API bzw. Produktdaten-Scraper". Beide Ketten
bieten keine oeffentliche Produkt-/Preis-API an, und das Scrapen ihrer
Storefronts verstoesst gegen deren Nutzungsbedingungen. Ein Scraper im
Produktivbetrieb ist ein rechtliches und ein Betriebsrisiko (Layout-Aenderungen,
IP-Sperren).

**Stattdessen:** ein `PriceProvider`-Interface definieren

    interface PriceProvider {
      id: string
      lookup(barcode: string, storeId?: string): Promise<PriceQuote | null>
    }

und mit zwei risikofreien Implementierungen starten:
- `ManualPriceProvider` — der Nutzer traegt Preise selbst ein, sie werden pro
  Produkt und Filiale gecacht
- `OpenFoodFactsProvider` — Produktdaten ohne Preise

Eine Kette wird erst angebunden, wenn ein offizieller Partner-/API-Zugang
vorliegt. Das Interface stellt sicher, dass das dann eine additive Aenderung ist.

**Vor Umsetzung entscheiden:** ist der Preisvergleich ohne offizielle
Anbindung ueberhaupt genug wert, um gebaut zu werden?
EOF
)"

mk E_P3_HEALTH "$P3" "epic,feature,native,risk" "Epic — Aktivitaetstracking & Health-Integration" "$(
  cat <<'EOF'
Schrittzaehler ueber `expo-sensors` (Pedometer), manuelle Aktivitaetseingabe mit
MET-Werten, Kalorienverbrauch fliesst ins Tagesbudget.

**Korrektur zur README-Vision:** Das dort genannte `expo-apple-healthkit`
existiert nicht auf npm. Realistische Optionen:
- iOS: `@kingstinct/react-native-healthkit`
- Android: Health Connect ueber ein Community-Modul oder ein eigenes Expo-Modul

Beides braucht einen Development Build und eine Begruendung der
Health-Datennutzung im App-Store-Review.
EOF
)"

mk E_P3_FASTING "$P3" "epic,feature" "Epic — Intervallfasten-Tracker" "$(
  cat <<'EOF'
Voreingestellte Protokolle (16:8, 18:6, 20:4, 5:2, OMAD), visueller Countdown,
Phasenanzeige, Historie.

Der Timer muss ueber App-Neustarts hinweg korrekt bleiben: Start-Timestamp
persistieren und die Restzeit ableiten — kein laufender In-Memory-Timer.
Hintergrund-Erinnerungen ueber geplante lokale Notifications.
EOF
)"

mk E_P3_COOK "$P3" "epic,feature" "Epic — Kochmodus & 'Was kann ich kochen?'" "$(
  cat <<'EOF'
Rezeptvorschlaege auf Basis des tatsaechlichen Kuehlschrank-Bestands
(Matching-Score ueber vorhandene Zutaten), plus Schritt-fuer-Schritt-Kochmodus
mit Timern und `expo-keep-awake`.
EOF
)"

mk E_P4_GAME "$P4" "epic,feature" "Epic — Gamification (XP, Level, Streaks, Achievements)" "$(
  cat <<'EOF'
Streaks, XP, Kategorie-Level, gestufte Achievements, Konfetti und Haptik.

Bewusst spaet: Gamification auf einem Fundament, das noch wackelt, erzeugt nur
falsche Anreize. Die dafuer noetigen Ereignisse (Mahlzeit geloggt, Gewicht
eingetragen) sollten aber schon in Epic 5/7 sauber als Events anfallen.
EOF
)"

mk E_P4_SOCIAL "$P4" "epic,feature" "Epic — Rezept-Sharing & Community" "$(
  cat <<'EOF'
Rezepte ueber die native Share-Sheet teilen, optionale Freunde-Challenges,
anonyme Leaderboards.
EOF
)"

mk E_P4_ANALYTICS "$P4" "epic,feature" "Epic — Erweiterte Analytics & Report-Generator" "$(
  cat <<'EOF'
Langzeit-Trends, Naehrstoff-Analysen, Report-Export als CSV/PDF.
EOF
)"

mk E_P4_IAP "$P4" "epic,risk" "Epic — Premium-Features & Monetarisierung" "$(
  cat <<'EOF'
**Korrektur zur README-Vision:** `expo-in-app-purchases` ist deprecated, die
letzte Version (14.5.0) hat keinen SDK-57-Build. Nicht verwenden.

Realistisch: RevenueCat (`react-native-purchases`) mit Development Build, oder
`expo-iap`. Vorher inhaltlich klaeren, was ueberhaupt hinter der Paywall liegt —
die Datenschutz-Versprechen des README vertragen sich schlecht mit einem
Modell, das Kernfunktionen einschraenkt.
EOF
)"

mk E_P4_WIDGET "$P4" "epic,native,risk" "Epic — Homescreen-Widgets" "$(
  cat <<'EOF'
**Korrektur zur README-Vision:** Ein Paket `expo-widgets` gibt es offiziell
nicht. Widgets erfordern native Targets — WidgetKit (Swift) auf iOS,
Glance/AppWidgetProvider (Kotlin) auf Android — angebunden ueber ein
Config-Plugin und einen Development Build.

Datenaustausch laeuft ueber App Groups (iOS) bzw. SharedPreferences (Android),
nicht ueber die JS-Runtime.
EOF
)"

# ==========================================================================
echo "==> Epic 0 — Foundation"
# ==========================================================================

mk 0.1 "$P0" "setup" "Biome als Linter und Formatter einrichten" "$(
  cat <<'EOF'
`@biomejs/biome@2` installieren und `expo lint` als Standard-Lint-Pfad abloesen.

**Aufgaben**
- `biome.json` mit aktivierten Recommended-Rules, 2-Space-Indent, Single Quotes
  (passend zum bestehenden Code in `src/`)
- `src/components/ui/` in der Konfiguration ignorieren — dieser Ordner wird laut
  CLAUDE.md nicht angefasst
- Scripts ergaenzen: `check` (lint + format check), `format` (write), `typecheck`

**Akzeptanzkriterien**
- [ ] `bun run check` laeuft ohne Fehler auf dem bestehenden Code
- [ ] `bun run typecheck` ist gruen (tsconfig hat bereits `strict: true`)
- [ ] Kein Format-Diff auf bereits existierenden Dateien in `src/`
EOF
)" "$(partof E0)"

mk 0.2 "$P0" "setup,test" "Test-Setup: jest-expo + Testing Library" "$(
  cat <<'EOF'
`jest-expo@~57` und `@testing-library/react-native` einrichten.

Hintergrund zur Abweichung von CLAUDE.md: dort stehen Vitest und Playwright.
Beide sind fuer React Native nicht praktikabel — Playwright steuert keine
native App, und `jest-expo` bringt das noetige RN-Preset mit. E2E laeuft
stattdessen ueber Maestro (siehe #0.9).

**Aufgaben**
- `jest.config.js` mit `preset: 'jest-expo'`, `transformIgnorePatterns` fuer
  RN-Pakete, Modul-Alias `@/*` -> `src/*` passend zur tsconfig
- Smoke-Test, der eine bestehende Komponente rendert

**Akzeptanzkriterien**
- [ ] `bun test` laeuft gruen durch
- [ ] Der Alias `@/components/themed-text` ist im Test aufloesbar
- [ ] Keine Mocks im Setup — Testdoubles sind laut CLAUDE.md nicht erwuenscht
EOF
)" "$(partof E0)"

mk 0.3 "$P0" "setup,native" "EAS konfigurieren und Development Build erstellen" "$(
  cat <<'EOF'
**Blocker fuer praktisch alles Native.** `expo-sqlite`, `expo-camera`,
`expo-notifications` und `expo-secure-store` laufen nicht in Expo Go. Ohne
Development Build ist ab Epic 2 kein Fortschritt moeglich.

**Aufgaben**
- `eas.json` mit den Profilen `development` (developmentClient, internal),
  `preview` und `production`
- `expo-dev-client` installieren
- Build fuer iOS Simulator und Android laufen lassen, App installieren
- README um den Abschnitt "Development Build" ergaenzen

**Akzeptanzkriterien**
- [ ] `eas build --profile development --platform ios` erfolgreich
- [ ] `eas build --profile development --platform android` erfolgreich
- [ ] Beide Builds starten und verbinden sich mit dem lokalen Metro
EOF
)" "$(partof E0)"

mk 0.4 "$P0" "setup,backend" "Supabase CLI und lokale Instanz aufsetzen" "$(
  cat <<'EOF'
Die Supabase CLI ist auf dieser Maschine noch nicht installiert.

**Aufgaben**
- CLI installieren (`brew install supabase/tap/supabase`)
- `supabase init` — legt `supabase/config.toml` und `supabase/migrations/` an
- `supabase start` — lokales Postgres, Auth, Realtime und Studio
- `supabase/config.toml` committen; `supabase/.temp/` in `.gitignore`

**Akzeptanzkriterien**
- [ ] `supabase status` zeigt alle Services healthy
- [ ] Studio unter http://localhost:54323 erreichbar
- [ ] `supabase db reset` laeuft fehlerfrei durch
EOF
)" "$(partof E0)"

mk 0.5 "$P0" "setup,docs" "Env-Variablen dokumentieren" "$(
  cat <<'EOF'
Benoetigt werden `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Nur das `EXPO_PUBLIC_`-Praefix macht Variablen im Client-Bundle sichtbar.

**Wichtig:** `.env`-Dateien werden in diesem Projekt nicht automatisiert
angelegt oder veraendert. Dieses Issue liefert ausschliesslich Dokumentation;
die eigentliche `.env` legt der Entwickler selbst an.

**Aufgaben**
- README-Abschnitt "Umgebungsvariablen" mit Variablennamen, Herkunft
  (`supabase status` fuer lokal, Dashboard fuer Remote) und Beispielwerten
- Pruefen, dass `.env*` in `.gitignore` steht
- Fail-fast beim App-Start, wenn eine Variable fehlt — mit klarer Meldung
  statt eines kryptischen Netzwerkfehlers spaeter

**Akzeptanzkriterien**
- [ ] README erklaert beide Variablen und wo die Werte herkommen
- [ ] App bricht beim Start mit lesbarer Meldung ab, wenn eine Variable fehlt
- [ ] Keine Secrets im Repo
EOF
)" "$(partof E0)" "$(deps 0.4)"

mk 0.6 "$P0" "setup,backend" "Supabase-Client mit chunkendem SecureStore-Adapter" "$(
  cat <<'EOF'
Zentraler Client in `src/lib/supabase.ts`, app-weit verwendet.

**Der eigentliche Fallstrick:** `expo-secure-store` erlaubt auf iOS nur rund
2048 Byte pro Wert. Eine Supabase-Session (Access- plus Refresh-JWT, dazu
User-Metadaten) ueberschreitet das regelmaessig. Der Schreibvorgang schlaegt
still fehl, und der Nutzer ist nach jedem App-Neustart ausgeloggt — ein Bug,
der sich sonst erst spaet und schwer reproduzierbar zeigt.

**Loesung:** ein `SupabaseStorage`-Adapter, der Werte oberhalb eines
Schwellwerts in Chunks aufteilt (`key.0`, `key.1`, ...) und unter `key` nur die
Chunk-Anzahl ablegt. `removeItem` muss alle Chunks aufraeumen.

**Aufgaben**
- `@supabase/supabase-js`, `react-native-url-polyfill`, `expo-secure-store`
- `import 'react-native-url-polyfill/auto'` ganz oben
- Client-Optionen: `autoRefreshToken: true`, `persistSession: true`,
  `detectSessionInUrl: false` (letzteres ist RN-spezifisch zwingend)
- `AppState`-Listener: `startAutoRefresh` / `stopAutoRefresh`

**Akzeptanzkriterien**
- [ ] Unit-Test schreibt einen 8-KB-String und liest ihn identisch zurueck
- [ ] Unit-Test: nach `removeItem` sind keine verwaisten Chunk-Keys uebrig
- [ ] Manuell: Login, App komplett beenden, neu starten -> weiterhin eingeloggt
EOF
)" "$(partof E0)" "$(deps 0.4 0.5)"

mk 0.7 "$P0" "setup,backend" "TypeScript-Typen aus dem DB-Schema generieren" "$(
  cat <<'EOF'
`supabase gen types typescript --local > src/lib/database.types.ts`, damit der
Client vollstaendig typsicher ist (`createClient<Database>`).

**Aufgaben**
- npm-Script `db:types`
- Generierte Datei committen (nicht ignorieren) — sonst bricht der Typecheck
  auf frischen Checkouts
- CI-Schritt, der neu generiert und auf ein leeres Diff prueft

**Akzeptanzkriterien**
- [ ] `bun run db:types` erzeugt ein reproduzierbares Ergebnis
- [ ] CI schlaegt fehl, wenn Migration und generierte Typen auseinanderlaufen
EOF
)" "$(partof E0)" "$(deps 0.4)"

mk 0.8 "$P0" "setup" "TanStack Query einrichten inkl. AppState-Anbindung" "$(
  cat <<'EOF'
`@tanstack/react-query` v5 als Server-State-Layer; Zustand bleibt fuer reinen
Client-State reserviert.

**RN-spezifisch:** Es gibt kein `window`-Focus-Event. Ohne manuelle Anbindung
an `AppState` findet kein Refetch statt, wenn die App aus dem Hintergrund
zurueckkehrt. Ebenso muss `onlineManager` an den Netzwerkstatus gebunden werden.

**Aufgaben**
- `QueryClientProvider` in `src/app/_layout.tsx` (bestehende `ThemeProvider`-
  Struktur beibehalten, nur umschliessen)
- `focusManager` an `AppState` binden
- Sinnvolle Defaults: `staleTime`, `retry`, kein `refetchOnWindowFocus` auf Web

**Akzeptanzkriterien**
- [ ] Provider aktiv, bestehende Screens rendern unveraendert
- [ ] Wechsel in den Hintergrund und zurueck loest einen Refetch aus
EOF
)" "$(partof E0)"

mk 0.9 "$P0" "setup,test" "GitHub Actions CI-Pipeline" "$(
  cat <<'EOF'
**Aufgaben**
- Workflow `ci.yml`: Bun-Setup, Install, `typecheck`, `check` (Biome), `test`
- Zweiter Job mit `supabase start` fuer die RLS-Integrationstests aus #1.10
- Typen-Drift-Check aus #0.7

**Akzeptanzkriterien**
- [ ] CI laeuft auf Push und Pull Request
- [ ] Rote Tests blockieren den Merge
EOF
)" "$(partof E0)" "$(deps 0.1 0.2 0.7)"

# ==========================================================================
echo "==> Epic 1 — Datenmodell & RLS"
# ==========================================================================

mk 1.1 "$P0" "backend,rls" "Migration: profiles + Trigger auf auth.users" "$(
  cat <<'EOF'
**Schema**
- `profiles`: `id uuid pk references auth.users on delete cascade`,
  `display_name`, `avatar_url`, `birth_date`, `sex`, `height_cm`,
  `activity_level`, `created_at`, `updated_at`

**Trigger:** `on_auth_user_created` (`security definer`) legt bei jeder
Registrierung automatisch eine `profiles`-Zeile an. Ohne diesen Trigger muss
der Client den Datensatz nachtraeglich erzeugen, was bei Abbruch mitten im
Onboarding verwaiste Auth-User hinterlaesst.

**RLS:** select/update/insert nur fuer `id = auth.uid()`. Kein delete —
Loeschung laeuft ueber die Kaskade von `auth.users` (#9.3).

**Akzeptanzkriterien**
- [ ] Nach `supabase auth signup` existiert automatisch ein Profil
- [ ] User A kann Profil von User B weder lesen noch aendern
EOF
)" "$(partof E1)" "$(deps 0.4)"

mk 1.2 "$P0" "backend,rls,risk" "Migration: households + household_members (rekursionsfreie Policies)" "$(
  cat <<'EOF'
**Der zentrale Fallstrick des gesamten Datenmodells.**

Eine naiv formulierte Policy auf `household_members` fragt zur Pruefung einer
Zeile wieder `household_members` ab ("darf ich diese Zeile sehen? -> bin ich
Mitglied dieses Haushalts? -> SELECT auf household_members"). Postgres bricht
das mit `infinite recursion detected in policy for relation
"household_members"` ab. Das passiert zuverlaessig und kostet erfahrungsgemaess
Stunden, weil die Fehlermeldung erst zur Laufzeit auftaucht.

**Loesung:** Zugehoerigkeit ausschliesslich ueber `SECURITY DEFINER`-Funktionen
pruefen, die RLS umgehen:

```sql
create function public.is_household_member(hid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create function public.is_household_admin(hid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid() and role = 'admin'
  );
$$;
```

`set search_path = public` ist dabei kein Detail, sondern Pflicht — ohne das
ist eine `security definer`-Funktion ueber manipulierte Suchpfade angreifbar.

**Schema**
- `households`: `id`, `name`, `created_by`, `created_at`, `updated_at`
- `household_members`: `household_id`, `user_id`, `role ('admin'|'member')`,
  `joined_at`; Primaerschluessel `(household_id, user_id)`

**Policies:** alle Haushalts-Tabellen rufen nur `is_household_member(...)` bzw.
`is_household_admin(...)` auf — nie direkte Subqueries auf `household_members`.

**Akzeptanzkriterien**
- [ ] Ersteller eines Haushalts ist automatisch `admin`
- [ ] Keine Recursion-Fehler bei `select * from household_members`
- [ ] Nur Admins koennen Rollen aendern oder Mitglieder entfernen
- [ ] Ein Nicht-Mitglied sieht den Haushalt gar nicht
EOF
)" "$(partof E1)" "$(deps 1.1)"

mk 1.3 "$P0" "backend,rls" "Migration: household_invites + redeem_invite RPC" "$(
  cat <<'EOF'
**Schema**
- `household_invites`: `id`, `household_id`, `token uuid default gen_random_uuid()`,
  `created_by`, `expires_at`, `max_uses`, `uses`, `revoked_at`

**Einloesung ueber RPC, nicht ueber direktes INSERT.** Ein Beitretender ist per
Definition noch kein Mitglied und darf den Haushalt daher nicht sehen — er kann
also auch keine Zeile in `household_members` schreiben. Ein `security definer`
RPC `redeem_invite(token uuid)` loest das: es validiert Token, Ablaufdatum,
Nutzungszaehler und Widerruf und legt die Mitgliedschaft an.

Das RPC darf zurueckmelden, ob ein Token gueltig ist, aber keine Details des
Haushalts preisgeben, bevor der Beitritt erfolgt ist.

**Akzeptanzkriterien**
- [ ] Gueltiges Token -> Mitgliedschaft mit Rolle `member`
- [ ] Abgelaufenes, widerrufenes oder aufgebrauchtes Token -> Fehler, kein Beitritt
- [ ] Doppeltes Einloesen erzeugt keine zweite Mitgliedschaft
- [ ] Nur Admins koennen Einladungen erstellen und widerrufen
EOF
)" "$(partof E1)" "$(deps 1.2)"

mk 1.4 "$P0" "backend,rls" "Migration: child_profiles" "$(
  cat <<'EOF'
Vereinfachte Profile fuer Kinder ohne eigenen Auth-Account, verwaltet durch ein
Elternteil.

**Schema**
- `child_profiles`: `id`, `household_id`, `managed_by references profiles`,
  `display_name`, `birth_date`, `sex`, `height_cm`

**Designentscheidung:** Kinder-Profile haengen am Haushalt, nicht an `auth.users`.
Alle Tracking-Tabellen brauchen deshalb ein optionales `child_profile_id`
alternativ zu `user_id` — das muss in #1.8 beruecksichtigt werden, sonst wird es
spaeter eine schmerzhafte Migration.

**Akzeptanzkriterien**
- [ ] Alle Haushaltsmitglieder sehen die Kinder-Profile
- [ ] Nur `managed_by` oder ein Admin kann sie bearbeiten oder loeschen
EOF
)" "$(partof E1)" "$(deps 1.2)"

mk 1.5 "$P0" "backend" "Migration: products (Lebensmittel-Cache)" "$(
  cat <<'EOF'
Eigene Produkttabelle als Spiegel von Open Food Facts, damit Suche und
Offline-Zugriff nicht von einem fremden Dienst abhaengen.

**Schema**
- `products`: `id`, `barcode text unique`, `name`, `brand`, `serving_size_g`,
  Naehrwerte je 100 g (`kcal`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`,
  `sugar_g`, `salt_g`), `source ('off'|'manual')`, `created_by`, `updated_at`

**RLS:** global lesbar fuer alle authentifizierten Nutzer; Insert erlaubt
(Nutzer duerfen unbekannte Produkte anlegen), Update nur fuer selbst angelegte
Produkte mit `source = 'manual'`.

**Akzeptanzkriterien**
- [ ] Barcode ist eindeutig, doppeltes Anlegen schlaegt fehl
- [ ] Ein Nutzer kann ein von Open Food Facts importiertes Produkt nicht aendern
EOF
)" "$(partof E1)" "$(deps 1.1)"

mk 1.6 "$P0" "backend,rls" "Migration: storage_locations + fridge_items" "$(
  cat <<'EOF'
**Schema**
- `storage_locations`: `id`, `household_id`, `name`,
  `kind ('fridge'|'freezer'|'pantry')`, `sort_order`.
  Beim Anlegen eines Haushalts werden die drei Standard-Lagerorte automatisch
  erzeugt.
- `fridge_items`: `id`, `household_id`, `location_id`, `product_id` (nullable —
  es muss auch "Reste vom Sonntag" ohne Produktbezug gehen), `name`,
  `quantity numeric`, `unit`, `expiry_date`, `added_by`, `created_at`,
  `updated_at`, `deleted_at`

**RLS:** vollstaendig ueber `is_household_member(household_id)`.

**Akzeptanzkriterien**
- [ ] Neuer Haushalt hat sofort drei Lagerorte
- [ ] Jedes Mitglied kann Artikel anlegen, aendern und (soft-)loeschen
- [ ] Ein Nicht-Mitglied bekommt bei einem SELECT eine leere Menge, keinen Fehler
EOF
)" "$(partof E1)" "$(deps 1.2 1.5)"

mk 1.7 "$P0" "backend,rls" "Migration: shopping_list_items" "$(
  cat <<'EOF'
**Schema**
- `shopping_list_items`: `id`, `household_id`, `product_id` (nullable), `name`,
  `quantity`, `unit`, `category`, `sort_index`, `checked_at`, `checked_by`,
  `added_by`, `created_at`, `updated_at`, `deleted_at`

`checked_at` als Zeitstempel statt eines Booleans — damit ist beim
"Einkauf abschliessen" (Phase 2) rekonstruierbar, was zu diesem Einkauf gehoerte,
und das Abhaken laesst sich sauber per LWW mergen.

**RLS:** ueber `is_household_member(household_id)`.

**Akzeptanzkriterien**
- [ ] Jedes Mitglied kann Artikel hinzufuegen und abhaken
- [ ] `checked_by` haelt fest, wer abgehakt hat
EOF
)" "$(partof E1)" "$(deps 1.2 1.5)"

mk 1.8 "$P0" "backend,rls,risk" "Migration: private Tracking-Tabellen (strikt getrennt vom Haushalt)" "$(
  cat <<'EOF'
**Die Datenschutz-Kernzusage des Projekts.** Das README sagt zu: Kalorien,
Gewicht, Koerpermasse und Gesundheitsdaten bleiben pro Account privat und werden
nicht automatisch mit anderen Haushaltsmitgliedern geteilt. Das muss in den
Policies stehen, nicht in der UI.

**Schema**
- `food_entries`: `id`, `user_id`, `child_profile_id` (nullable, siehe #1.4),
  `product_id`, `logged_on date`, `meal_type
  ('breakfast'|'lunch'|'dinner'|'snack')`, `quantity`, `unit`, plus
  denormalisierte Naehrwerte zum Zeitpunkt der Erfassung
- `weight_entries`: `id`, `user_id`, `measured_on`, `weight_kg`,
  Koerpermasse (nullable)
- `user_goals`: `id`, `user_id`, `goal_type ('lose'|'maintain'|'gain')`,
  `target_weight_kg`, `rate_kg_per_week`, `daily_kcal`, Makro-Ziele,
  `valid_from`

**Denormalisierung ist Absicht:** Naehrwerte werden in `food_entries` kopiert.
Korrigiert jemand spaeter das Produkt, darf sich die Vergangenheit nicht
rueckwirkend aendern.

**RLS:** ausschliesslich `user_id = auth.uid()`. Fuer Kinder-Profile zusaetzlich
Zugriff fuer den verwaltenden Elternteil — und ausdruecklich **kein**
`is_household_member`-Zugriff.

**Akzeptanzkriterien**
- [ ] Mitglied B im selben Haushalt sieht `food_entries` von A nicht
- [ ] Mitglied B sieht `weight_entries` von A nicht
- [ ] Der verwaltende Elternteil sieht die Eintraege des eigenen Kinder-Profils
- [ ] Selbst ein Haushalts-Admin hat keinen Zugriff auf fremde private Daten
EOF
)" "$(partof E1)" "$(deps 1.1 1.4 1.5)"

mk 1.9 "$P0" "backend,offline-sync" "Sync-Metadaten auf allen synchronisierten Tabellen" "$(
  cat <<'EOF'
Voraussetzung fuer die Sync-Engine (#2.3). Nachtraeglich einzufuehren ist
deutlich teurer, deshalb frueh.

**Aufgaben**
- `updated_at timestamptz not null default now()` plus `before update`-Trigger
  auf allen synchronisierten Tabellen
- `deleted_at timestamptz` als Soft-Delete. Harte Deletes sind fuer Offline-Sync
  unbrauchbar: ein Client, der waehrend des Loeschens offline war, kann sonst
  nicht unterscheiden zwischen "geloescht" und "noch nie gesehen" — und legt
  den Datensatz beim naechsten Push wieder an.
- Index auf `(household_id, updated_at)` fuer inkrementelle Pulls
- Alle Queries und Policies filtern `deleted_at is null`

**Akzeptanzkriterien**
- [ ] Jedes Update setzt `updated_at` neu
- [ ] Soft-geloeschte Zeilen tauchen in normalen Queries nicht auf
- [ ] Ein Pull mit `updated_at > x` liefert auch die Tombstones
EOF
)" "$(partof E1)" "$(deps 1.6 1.7 1.8)"

mk 1.10 "$P0" "test,rls,backend" "RLS-Integrationstests gegen echtes Postgres" "$(
  cat <<'EOF'
**Der wichtigste Test im ganzen Projekt.** RLS-Policies sind die einzige
Instanz, die private Gesundheitsdaten von geteilten Haushaltsdaten trennt. Ein
Fehler hier ist ein Datenleck, kein Bug.

Bewusst **ohne Mocks** (CLAUDE.md) und ohne Service-Role-Key im Testpfad:
getestet wird gegen die lokale Instanz aus #0.4 mit echten Nutzern und echten
Anon-Clients — nur so werden die Policies wirklich ausgefuehrt.

**Testaufbau**
- Zwei echte Nutzer A und B ueber `signUp` anlegen
- A erstellt Haushalt H, B tritt ueber ein Invite bei
- Dritter Nutzer C bleibt ausserhalb

**Faelle**
- [ ] B liest `fridge_items` aus H (erlaubt)
- [ ] C liest `fridge_items` aus H -> leere Menge
- [ ] C schreibt in `fridge_items` von H -> Fehler
- [ ] B liest `food_entries` von A -> leere Menge
- [ ] B liest `weight_entries` von A -> leere Menge
- [ ] B (kein Admin) entfernt ein Mitglied -> Fehler
- [ ] Kein `infinite recursion`-Fehler bei irgendeiner Query auf `household_members`
- [ ] Abgelaufenes Invite -> `redeem_invite` schlaegt fehl

**Akzeptanzkriterium:** Suite laeuft in CI gegen `supabase start` und ist gruen.
EOF
)" "$(partof E1)" "$(deps 1.2 1.3 1.6 1.7 1.8)"

mk 1.11 "$P0" "backend" "Realtime-Publication fuer geteilte Tabellen aktivieren" "$(
  cat <<'EOF'
Nur `fridge_items` und `shopping_list_items` in die `supabase_realtime`-
Publication aufnehmen. Private Tabellen bleiben bewusst draussen — sie werden
nie geteilt, und jede zusaetzliche Publication ist unnoetige Angriffsflaeche
und Last.

**Wichtig:** Realtime respektiert RLS nur, wenn die Tabelle `REPLICA IDENTITY
FULL` hat und die Policies fuer den empfangenden Nutzer greifen. Sonst
verschickt Postgres Change-Events an Clients, die die Zeile gar nicht sehen
duerften.

**Akzeptanzkriterien**
- [ ] Aenderung an `fridge_items` erreicht ein zweites Geraet desselben Haushalts
- [ ] Ein Client eines fremden Haushalts erhaelt kein Event
EOF
)" "$(partof E1)" "$(deps 1.6 1.7 1.9)"

# ==========================================================================
echo "==> Epic 2 — Offline-Layer & Sync"
# ==========================================================================

mk 2.1 "$P0" "offline-sync,native" "expo-sqlite einrichten + lokales Schema" "$(
  cat <<'EOF'
`expo-sqlite` als lokale Wahrheit fuer alle Haushaltsdaten. Die UI liest
ausschliesslich aus SQLite, nie direkt von Supabase — nur so ist die App
offline vollstaendig funktionsfaehig.

**Aufgaben**
- `src/lib/db/` mit Verbindungsaufbau ueber `openDatabaseAsync` und WAL-Modus
- Migrations-Runner ueber `PRAGMA user_version` (nummerierte, vorwaerts
  gerichtete Migrationen)
- Spiegeltabellen fuer `fridge_items`, `shopping_list_items`,
  `storage_locations`, `products` — jeweils mit `updated_at`, `deleted_at` und
  einem `_dirty`-Flag

**Akzeptanzkriterien**
- [ ] DB wird beim ersten Start angelegt, Migrationen laufen genau einmal
- [ ] Erneuter App-Start migriert nicht erneut
- [ ] Braucht einen Development Build (#0.3)
EOF
)" "$(partof E2)" "$(deps 0.3)"

mk 2.2 "$P0" "offline-sync" "Outbox-Queue fuer ausgehende Mutationen" "$(
  cat <<'EOF'
Jede schreibende Operation geht ausnahmslos ueber die Outbox — nie direkt gegen
Supabase. Das ist die Regel, die Offline-Faehigkeit ueberhaupt erst moeglich
macht, und sie muss von Anfang an ohne Ausnahme gelten, sonst entstehen genau
die Zustaende, die sich spaeter nicht mehr rekonstruieren lassen.

**Schema (lokal)**
- `outbox`: `id`, `entity`, `entity_id`, `op ('insert'|'update'|'delete')`,
  `payload json`, `created_at`, `attempts`, `last_error`

**Ablauf:** lokal schreiben und Outbox-Eintrag anlegen in **einer** Transaktion.
UI aktualisiert sofort (optimistisch), Netzwerk passiert spaeter.

**Akzeptanzkriterien**
- [ ] Mutation im Flugmodus landet in SQLite und in der Outbox
- [ ] UI zeigt die Aenderung sofort
- [ ] Abbruch mitten in der Transaktion hinterlaesst keinen halben Zustand
EOF
)" "$(partof E2)" "$(deps 2.1)"

mk 2.3 "$P0" "offline-sync,risk" "Sync-Engine: Pull, Push und Konfliktaufloesung" "$(
  cat <<'EOF'
Herzstueck von Epic 2.

**Pull:** je Tabelle `updated_at > lastSyncedAt` inklusive Tombstones,
seitenweise, `lastSyncedAt` erst nach erfolgreichem Commit fortschreiben.

**Push:** Outbox in Erstellungsreihenfolge abarbeiten, bei Erfolg loeschen, bei
Fehler `attempts` erhoehen und mit Backoff erneut versuchen. Nach n Versuchen
in einen Fehlerzustand ueberfuehren, der in der UI sichtbar ist — still
verschluckte Fehler sind hier die schlimmste Variante.

**Konflikte: Last-Write-Wins ueber `updated_at`.** Bewusste Vereinfachung
gegenueber einem CRDT. Zwei Details, die leicht uebersehen werden:
- **Delete schlaegt Update.** Ein Tombstone gewinnt gegen ein gleichzeitiges
  Update, sonst taucht ein geloeschter Artikel wieder auf.
- **Geraeteuhren gehen falsch.** Fuer den Vergleich zaehlt die Server-Zeit, nicht
  die lokale. Lokale Eintraege bekommen ihren endgueltigen `updated_at`-Wert
  erst beim Push vom Server.

**Akzeptanzkriterien**
- [ ] Offline erstellte Artikel erscheinen nach Reconnect auf dem zweiten Geraet
- [ ] Gleichzeitige Bearbeitung endet auf beiden Geraeten im selben Zustand
- [ ] Ein offline geloeschter Artikel bleibt nach dem Sync geloescht
- [ ] Doppelter Sync-Lauf erzeugt keine Duplikate (idempotent)
EOF
)" "$(partof E2)" "$(deps 2.2 1.9)"

mk 2.4 "$P0" "offline-sync" "Realtime -> SQLite Bridge" "$(
  cat <<'EOF'
Postgres-Changes-Subscription je aktivem Haushalt; eingehende Events werden in
SQLite geschrieben und invalidieren gezielt den Query-Cache.

**Zu beachten**
- Beim Haushaltswechsel alte Subscription sauber abmelden (sonst Memory-Leak
  und Events aus dem falschen Haushalt)
- Nach Verbindungsabbruch reicht Realtime allein nicht — verpasste Events
  muessen ueber einen vollen Pull (#2.3) nachgeholt werden
- Eigene Aenderungen kommen als Echo zurueck und duerfen keinen Update-Loop
  ausloesen

**Akzeptanzkriterien**
- [ ] Aenderung auf Geraet A erscheint auf Geraet B in unter einer Sekunde
- [ ] Nach Reconnect ist der Bestand vollstaendig, ohne Duplikate
- [ ] Haushaltswechsel hinterlaesst keine aktive alte Subscription
EOF
)" "$(partof E2)" "$(deps 2.3 1.11)"

mk 2.5 "$P0" "test,offline-sync" "Unit-Tests fuer die Konfliktaufloesung (mock-frei)" "$(
  cat <<'EOF'
Die Konfliktaufloesung wird als reine Funktion implementiert —
`resolve(local, remote) -> 'local' | 'remote'` — ohne DB, ohne Netzwerk, ohne
Zeitabhaengigkeit. Dadurch ist sie vollstaendig und ohne Mocks testbar; genau
das ist der Grund fuer diesen Zuschnitt.

**Faelle**
- [ ] Remote neuer -> remote gewinnt
- [ ] Local neuer -> local gewinnt
- [ ] Identischer Timestamp -> deterministischer Tiebreak (z. B. ueber id)
- [ ] Remote-Tombstone gegen lokales Update -> Delete gewinnt
- [ ] Lokaler Tombstone gegen neueres Remote-Update -> Delete gewinnt
- [ ] Lokaler Timestamp liegt in der Zukunft (Uhr falsch) -> kein Deadlock

Zusaetzlich die Outbox-Reduktion testen: drei Updates am selben Feld vor dem
Sync duerfen zu einem Push zusammenfallen.
EOF
)" "$(partof E2)" "$(deps 2.3)"

mk 2.6 "$P0" "offline-sync,native" "Netzwerkstatus + Hintergrund-Synchronisation" "$(
  cat <<'EOF'
**Aufgaben**
- `expo-network` fuer den Verbindungsstatus, Sync bei Reconnect anstossen
- `expo-background-task` fuer periodischen Sync (loest das alte
  `expo-background-fetch` ab)
- Exponentieller Backoff, kein Dauerfeuer bei fehlender Verbindung

**Realistische Erwartung:** Beide Plattformen entscheiden selbst, wann
Hintergrundarbeit ausgefuehrt wird. iOS kann Intervalle stark strecken oder
ganz aussetzen. Hintergrund-Sync ist eine Optimierung, kein Verlass — die App
muss beim Oeffnen immer selbst synchronisieren.

**Akzeptanzkriterien**
- [ ] Reconnect loest innerhalb weniger Sekunden einen Sync aus
- [ ] Ohne Verbindung wird nicht dauerhaft erfolglos gepollt
EOF
)" "$(partof E2)" "$(deps 2.3)"

mk 2.7 "$P0" "ui,offline-sync" "Offline-Indikator und Sync-Status in der UI" "$(
  cat <<'EOF'
Dezenter Hinweis, wenn die App offline ist oder Aenderungen ausstehen —
"Offline, n Aenderungen ausstehend". Bei dauerhaft fehlgeschlagenen
Outbox-Eintraegen ein antippbarer Fehlerzustand mit Retry.

Styling ueber `Colors`/`Spacing` aus `src/constants/theme.ts`, kein NativeWind.
Der Indikator darf keinen Inhalt verdecken.

**Akzeptanzkriterien**
- [ ] Flugmodus -> Indikator erscheint, Zaehler stimmt
- [ ] Nach erfolgreichem Sync verschwindet er wieder
- [ ] Dark und Light Mode korrekt
EOF
)" "$(partof E2)" "$(deps 2.3)"

# ==========================================================================
echo "==> Epic 3 — Auth & Onboarding"
# ==========================================================================

mk 3.1 "$P1" "feature,ui" "(auth)-Route-Group und Auth-Guard" "$(
  cat <<'EOF'
`src/app/(auth)/` fuer Login/Registrierung, `src/app/(tabs)/` fuer den
angemeldeten Bereich. Session-Kontext in `src/app/_layout.tsx` (bestehende
`ThemeProvider`/`AnimatedSplashOverlay`-Struktur beibehalten).

**Detail, das oft schiefgeht:** Erst navigieren, wenn der Root-Layout wirklich
gemountet ist — sonst laeuft die Weiterleitung ins Leere. Und der Splash Screen
darf erst ausgeblendet werden, wenn die Session geladen ist, sonst blitzt der
Login-Screen bei bereits angemeldeten Nutzern kurz auf.

**Akzeptanzkriterien**
- [ ] Ohne Session landet man in `(auth)`
- [ ] Mit Session direkt in `(tabs)`, ohne sichtbaren Login-Flash
- [ ] `typedRoutes` bleibt fehlerfrei
EOF
)" "$(partof E3)" "$(deps 0.6 0.8)"

mk 3.2 "$P1" "feature,ui" "Registrierung (E-Mail/Passwort)" "$(
  cat <<'EOF'
Formular mit Zod-Validierung: E-Mail-Format, Passwortlaenge, Bestaetigungsfeld.
Eingaben werden validiert, bevor sie den Client verlassen.

**Akzeptanzkriterien**
- [ ] Gueltige Daten -> Account plus automatisch erzeugtes Profil (#1.1)
- [ ] Bereits vergebene E-Mail -> verstaendliche Meldung
- [ ] Fehler werden pro Feld angezeigt, nicht als Sammelmeldung
- [ ] Ladezustand, Doppel-Submit ausgeschlossen
EOF
)" "$(partof E3)" "$(deps 3.1 1.1)"

mk 3.3 "$P1" "feature,ui" "Login mit sauberen Fehlerzustaenden" "$(
  cat <<'EOF'
**Akzeptanzkriterien**
- [ ] Korrekte Daten -> Weiterleitung in `(tabs)`
- [ ] Falsches Passwort -> klare Meldung, ohne preiszugeben, ob die E-Mail existiert
- [ ] Ohne Netz -> Hinweis auf die Verbindung statt eines rohen Fehlertexts
- [ ] Tastatur verdeckt die Eingabefelder nicht
EOF
)" "$(partof E3)" "$(deps 3.1)"

mk 3.4 "$P1" "feature" "Passwort-Reset per Deep Link" "$(
  cat <<'EOF'
`resetPasswordForEmail` mit Redirect auf das App-Scheme `fam://` (bereits in
`app.json` gesetzt). Empfangsroute setzt das neue Passwort.

**Akzeptanzkriterien**
- [ ] Reset-Mail wird zugestellt, Link oeffnet die App
- [ ] Neues Passwort funktioniert, altes nicht mehr
- [ ] Abgelaufener Link -> verstaendliche Meldung
EOF
)" "$(partof E3)" "$(deps 3.3)"

mk 3.5 "$P1" "test,feature" "Session-Persistenz und Auto-Refresh verifizieren" "$(
  cat <<'EOF'
Ausdruecklich als eigener Task, weil genau hier der SecureStore-Fallstrick aus
#0.6 zuschlaegt und der Fehler sonst erst spaet auffaellt.

**Akzeptanzkriterien**
- [ ] Login, App komplett beenden, neu starten -> weiterhin angemeldet
- [ ] Auf iOS und Android geprueft
- [ ] Abgelaufener Access-Token wird automatisch erneuert, ohne Logout
- [ ] Nach laengerer Hintergrundzeit ist die Session beim Zurueckkehren gueltig
EOF
)" "$(partof E3)" "$(deps 3.3 0.6)"

mk 3.6 "$P1" "feature,ui" "Profil-Onboarding" "$(
  cat <<'EOF'
Nach der Registrierung: Anzeigename, Geburtsdatum, Geschlecht, Groesse,
Aktivitaetslevel — die Eingaben, die #7.1 fuer die Kalorienberechnung braucht.

Schritte sind ueberspringbar; die App muss auch mit unvollstaendigem Profil
funktionieren und die Kalorienberechnung dann sauber als "nicht verfuegbar"
melden statt zu raten.

**Akzeptanzkriterien**
- [ ] Daten landen in `profiles`
- [ ] Ueberspringen ist moeglich, spaeteres Nachtragen im Profil ebenfalls
- [ ] Plausibilitaetspruefung (Groesse, Datum) mit klaren Meldungen
EOF
)" "$(partof E3)" "$(deps 3.2 1.1)"

mk 3.7 "$P1" "feature" "Logout inklusive lokaler Datenloeschung" "$(
  cat <<'EOF'
Beim Abmelden muessen die lokalen SQLite-Daten geloescht werden. Sonst sieht ein
zweiter Nutzer auf demselben Geraet den Kuehlschrank des ersten — ein echtes
Datenleck, das bei lokaler Persistenz leicht uebersehen wird.

**Akzeptanzkriterien**
- [ ] Session, SecureStore-Chunks und Query-Cache werden geleert
- [ ] Lokale SQLite-Tabellen sind geleert
- [ ] Ausstehende Outbox-Eintraege: Nutzer wird gewarnt, bevor sie verworfen werden
- [ ] Anschliessend landet man in `(auth)`
EOF
)" "$(partof E3)" "$(deps 3.3 2.1)"

# ==========================================================================
echo "==> Epic 4 — Haushalt"
# ==========================================================================

mk 4.1 "$P1" "feature,ui" "Haushalt erstellen" "$(
  cat <<'EOF'
Screen unter `src/app/household/`. Ersteller wird automatisch Admin, die drei
Standard-Lagerorte werden angelegt (#1.6).

Beides sollte in einem `security definer` RPC `create_household(name)` passieren
— sonst kann ein Abbruch zwischen den Schritten einen Haushalt ohne Admin
hinterlassen.

**Akzeptanzkriterien**
- [ ] Haushalt entsteht mit dem Ersteller als Admin
- [ ] Drei Lagerorte sind sofort vorhanden
- [ ] Nutzer ohne Haushalt bekommt die Erstellung angeboten
EOF
)" "$(partof E4)" "$(deps 1.2 1.6 3.1)"

mk 4.2 "$P1" "feature,ui" "Mitgliederliste mit Rollen" "$(
  cat <<'EOF'
**Akzeptanzkriterien**
- [ ] Alle Mitglieder mit Name, Avatar und Rolle
- [ ] Eigener Eintrag ist erkennbar markiert
- [ ] Admin-Aktionen erscheinen nur fuer Admins
EOF
)" "$(partof E4)" "$(deps 4.1)"

mk 4.3 "$P1" "feature,ui" "Einladung erzeugen (Link + QR-Code)" "$(
  cat <<'EOF'
Admin erzeugt ein Invite (#1.3) mit waehlbarer Gueltigkeit. Ausgabe als
Deep Link `fam://join?token=...`, als QR-Code (`react-native-svg`, bereits
installiert) und teilbar ueber die native Share-Sheet.

**Akzeptanzkriterien**
- [ ] Link und QR-Code fuehren zum selben Token
- [ ] Bestehende Einladungen sind widerrufbar
- [ ] Nur Admins sehen die Funktion
EOF
)" "$(partof E4)" "$(deps 4.1 1.3)"

mk 4.4 "$P1" "feature,ui" "Haushalt beitreten (Deep Link oder Code)" "$(
  cat <<'EOF'
Beitritt ueber `redeem_invite` (#1.3), sowohl per Deep Link als auch ueber
manuelle Code-Eingabe als Rueckfallweg.

**Zu bedenken:** Der Link kann geoeffnet werden, bevor der Nutzer angemeldet ist.
Dann muss das Token ueber Login oder Registrierung hinweg erhalten bleiben und
danach eingeloest werden.

**Akzeptanzkriterien**
- [ ] Deep Link bei laufender App und bei Kaltstart
- [ ] Nicht angemeldet -> Login/Registrierung, danach automatischer Beitritt
- [ ] Ungueltiges oder abgelaufenes Token -> klare Meldung
- [ ] Bereits Mitglied -> Hinweis statt Fehler
EOF
)" "$(partof E4)" "$(deps 4.3 3.3)"

mk 4.5 "$P1" "feature,ui" "Rollenverwaltung und Mitglieder entfernen" "$(
  cat <<'EOF'
**Akzeptanzkriterien**
- [ ] Admin kann ernennen, degradieren und entfernen
- [ ] Der letzte Admin kann sich nicht selbst degradieren
- [ ] Entferntes Mitglied verliert sofort den Datenzugriff (RLS greift serverseitig)
- [ ] Aktion wird bestaetigt, bevor sie ausgefuehrt wird
EOF
)" "$(partof E4)" "$(deps 4.2)"

mk 4.6 "$P1" "feature,ui" "Haushalt verlassen und loeschen" "$(
  cat <<'EOF'
**Akzeptanzkriterien**
- [ ] Verlassen entfernt die Mitgliedschaft und die lokalen Haushaltsdaten
- [ ] Der letzte Admin muss vorher jemanden ernennen oder den Haushalt loeschen
- [ ] Loeschen ist Admins vorbehalten, mit deutlicher Warnung
- [ ] Loeschen kaskadiert auf Bestand, Einkaufsliste und Lagerorte
EOF
)" "$(partof E4)" "$(deps 4.5)"

mk 4.7 "$P1" "feature,ui" "Kinder-Profile anlegen und verwalten" "$(
  cat <<'EOF'
Profile ohne eigenen Account (#1.4), verwaltet durch ein Elternteil.

**Akzeptanzkriterien**
- [ ] Anlegen, bearbeiten, entfernen durch den Verwalter
- [ ] Alle Mitglieder sehen die Kinder-Profile
- [ ] Beim Loggen einer Mahlzeit ist das Kinder-Profil als Ziel waehlbar
EOF
)" "$(partof E4)" "$(deps 4.2 1.4)"

mk 4.8 "$P1" "feature,ui" "Haushalts-Wechsler (Mitgliedschaft in mehreren Haushalten)" "$(
  cat <<'EOF'
Ein Account kann in mehreren Haushalten sein (eigener Haushalt plus
Eltern-Haushalt). Der aktive Haushalt bestimmt, welche Daten angezeigt und
synchronisiert werden.

**Zu beachten:** Beim Wechsel muessen Realtime-Subscription (#2.4) umgehaengt,
der Query-Cache invalidiert und die aktive Haushalts-ID persistiert werden.

**Akzeptanzkriterien**
- [ ] Wechsel laedt Bestand und Einkaufsliste des Zielhaushalts
- [ ] Die Auswahl ueberlebt einen App-Neustart
- [ ] Keine Datenvermischung zwischen Haushalten
- [ ] Nach dem Wechsel ist genau eine Subscription aktiv
EOF
)" "$(partof E4)" "$(deps 4.1 2.4)"

# ==========================================================================
echo "==> Epic 5 — Kuehlschrank-Tracker"
# ==========================================================================

mk 5.1 "$P1" "feature,ui" "Bestandsliste gruppiert nach Lagerort" "$(
  cat <<'EOF'
Hauptscreen des Kuehlschrank-Tabs. Daten kommen aus SQLite (#2.1), nicht direkt
aus Supabase.

**Akzeptanzkriterien**
- [ ] Gruppierung nach Kuehlschrank, Gefrierfach, Vorrat
- [ ] Menge, Einheit und MHD je Artikel
- [ ] Leerzustand mit Handlungsaufforderung
- [ ] Funktioniert vollstaendig im Flugmodus
EOF
)" "$(partof E5)" "$(deps 2.3 4.1 1.6)"

mk 5.2 "$P1" "feature,ui" "Artikel manuell hinzufuegen" "$(
  cat <<'EOF'
Formular mit Name (oder Produktsuche aus #6.2), Menge, Einheit, Lagerort und
optionalem MHD.

**Akzeptanzkriterien**
- [ ] Schreibt ueber die Outbox (#2.2), erscheint sofort in der Liste
- [ ] Funktioniert offline
- [ ] Einheiten-Auswahl passend zum Produkttyp
- [ ] MHD ist optional
EOF
)" "$(partof E5)" "$(deps 5.1 2.2)"

mk 5.3 "$P1" "feature,ui" "Artikel bearbeiten, verbrauchen, entfernen" "$(
  cat <<'EOF'
Teilverbrauch reduziert die Menge, vollstaendiger Verbrauch setzt den
Soft-Delete.

**Akzeptanzkriterien**
- [ ] Menge aendern per Schnellaktion (+/-)
- [ ] Entfernen setzt `deleted_at`, kein harter Delete (#1.9)
- [ ] Undo direkt nach dem Entfernen
- [ ] Alles offline nutzbar
EOF
)" "$(partof E5)" "$(deps 5.2)"

mk 5.4 "$P1" "test,offline-sync" "Realtime-Sync zwischen zwei Geraeten verifizieren" "$(
  cat <<'EOF'
Der eigentliche Integrationstest der Architektur — hier treffen Epic 1, 2 und 4
zum ersten Mal aufeinander.

**Aufbau:** iOS-Simulator und Android-Emulator parallel, zwei verschiedene
Accounts im selben Haushalt (per Argent MCP steuerbar).

**Akzeptanzkriterien**
- [ ] Artikel auf A angelegt erscheint auf B in unter einer Sekunde
- [ ] Mengenaenderung auf B erscheint auf A
- [ ] A offline aendern, wieder online -> B sieht die Aenderung
- [ ] Beide gleichzeitig denselben Artikel aendern -> beide enden gleich
- [ ] Gleichzeitiges Loeschen und Aendern -> Artikel bleibt geloescht
EOF
)" "$(partof E5)" "$(deps 5.3 2.4 1.11)"

mk 5.5 "$P1" "feature,ui" "Ablauf-Ampel und Sortierung nach MHD" "$(
  cat <<'EOF'
Visuelle Einstufung: abgelaufen, laeuft in 3 Tagen ab, in 7 Tagen, unkritisch.

Die Einstufung als reine Funktion `expiryBucket(date, today)` implementieren —
ohne `new Date()` im Inneren, damit sie deterministisch testbar ist.

**Akzeptanzkriterien**
- [ ] `expiryBucket` ist unit-getestet inklusive Grenzfaellen (heute, gestern,
      genau in 3 Tagen, kein MHD)
- [ ] Sortierung nach Ablaufdatum ist umschaltbar
- [ ] Farben funktionieren in Dark und Light Mode
- [ ] Farbe ist nicht der einzige Traeger der Information (Barrierefreiheit)
EOF
)" "$(partof E5)" "$(deps 5.1)"

mk 5.6 "$P1" "feature,native" "Lokale Benachrichtigungen fuer ablaufende Artikel" "$(
  cat <<'EOF'
`expo-notifications` mit geplanten lokalen Benachrichtigungen — keine
Server-Pushes, damit es offline funktioniert und keine Gesundheitsdaten das
Geraet verlassen.

**Aufgaben**
- Permission-Flow mit Fallback-UI, wenn abgelehnt (die App muss ohne
  Benachrichtigungen voll nutzbar bleiben)
- Benachrichtigung n Tage vor Ablauf, Vorlaufzeit einstellbar
- Beim Entfernen eines Artikels die geplante Benachrichtigung wieder abbestellen
- Taegliche Zusammenfassung statt einer Meldung pro Artikel

**Akzeptanzkriterien**
- [ ] Permission wird zum sinnvollen Zeitpunkt erfragt, nicht beim ersten Start
- [ ] Ablehnung fuehrt zu einem klaren Hinweis, nicht zu einem Blocker
- [ ] Entfernter Artikel erzeugt keine Benachrichtigung mehr
- [ ] Auf iOS und Android geprueft (Development Build noetig)
EOF
)" "$(partof E5)" "$(deps 5.5 0.3)"

mk 5.7 "$P1" "feature,ui" "Dashboard-Widget 'laeuft bald ab'" "$(
  cat <<'EOF'
Kompakte Karte auf dem Dashboard mit den naechsten ablaufenden Artikeln,
priorisiert zur Verwendung — der direkte Beitrag zum Ziel, Lebensmittel-
verschwendung zu reduzieren.

**Akzeptanzkriterien**
- [ ] Zeigt die naechsten drei bis fuenf Artikel
- [ ] Tippen fuehrt in den gefilterten Kuehlschrank-Screen
- [ ] Ohne ablaufende Artikel wird die Karte ausgeblendet, nicht leer angezeigt
EOF
)" "$(partof E5)" "$(deps 5.5)"
later 5.7 8.5

# ==========================================================================
echo "==> Epic 6 — Lebensmittel-DB & Barcode"
# ==========================================================================

mk 6.1 "$P1" "feature,backend" "Open-Food-Facts-Client und Mapping auf products" "$(
  cat <<'EOF'
Client fuer die Open-Food-Facts-API mit Mapping auf das eigene `products`-Schema
(#1.5). Gefundene Produkte werden in die eigene Tabelle uebernommen, damit
Suche und Offline-Zugriff nicht vom fremden Dienst abhaengen.

**Realistische Erwartung an die Datenqualitaet:** Open Food Facts ist
crowdsourced. Felder fehlen, Einheiten sind uneinheitlich, Naehrwerte sind
teils offensichtlich falsch. Das Mapping braucht Plausibilitaetspruefungen
(negative Werte, kcal weit ausserhalb des Moeglichen) statt blindem Vertrauen.

**Pflicht:** Die Nutzungsbedingungen verlangen einen aussagekraeftigen
User-Agent mit App-Name und Kontakt.

**Akzeptanzkriterien**
- [ ] Barcode-Lookup liefert ein gemapptes Produkt oder sauber `null`
- [ ] Unplausible Naehrwerte werden verworfen, nicht uebernommen
- [ ] Ergebnis wird in `products` gespeichert
- [ ] Zeitueberschreitung und Netzwerkfehler brechen die UI nicht ab
EOF
)" "$(partof E6)" "$(deps 1.5)"

mk 6.2 "$P1" "feature,ui" "Produktsuche mit Debounce" "$(
  cat <<'EOF'
Sucht zuerst lokal in SQLite, dann in `products`, dann bei Open Food Facts.

**Akzeptanzkriterien**
- [ ] Debounce von etwa 300 ms, keine Anfrage je Tastendruck
- [ ] Lokale Treffer erscheinen sofort, Remote-Treffer werden nachgeladen
- [ ] Offline werden lokale Ergebnisse geliefert, mit Hinweis
- [ ] Lade-, Leer- und Fehlerzustand sind unterscheidbar
EOF
)" "$(partof E6)" "$(deps 6.1)"

mk 6.3 "$P1" "feature,native,ui" "Barcode-Scanner" "$(
  cat <<'EOF'
`expo-camera` mit Barcode-Scanning (EAN-13, EAN-8, UPC-A).

**Aufgaben**
- Kamera-Permission mit Fallback-UI: bei Ablehnung muss die manuelle Suche
  angeboten werden, kein Sackgassen-Screen
- Haptisches Feedback bei erfolgreichem Scan (`expo-haptics`)
- Entprellung, damit ein Barcode nicht mehrfach hintereinander erfasst wird
- Unbekannter Barcode -> direkt zum manuellen Anlegen (#6.7)

**Akzeptanzkriterien**
- [ ] Scan erkennt gaengige Lebensmittel-Barcodes
- [ ] Permission-Ablehnung fuehrt zu einem nutzbaren Alternativweg
- [ ] Offline funktionieren bereits gecachte Barcodes
- [ ] Kamera wird beim Verlassen des Screens freigegeben
- [ ] Braucht einen Development Build (#0.3)
EOF
)" "$(partof E6)" "$(deps 6.1 0.3)"

mk 6.4 "$P1" "feature,ui" "Produktdetail mit Portionsauswahl" "$(
  cat <<'EOF'
**Akzeptanzkriterien**
- [ ] Naehrwerte skalieren live mit der eingegebenen Menge
- [ ] Einheitenwechsel (g, ml, Stueck, Portion) rechnet korrekt um
- [ ] Uebernahme ins Tagebuch (#7.6) oder in den Kuehlschrank (#5.2)
EOF
)" "$(partof E6)" "$(deps 6.2)"
later 6.4 6.5

mk 6.5 "$P1" "feature,test" "Einheiten-Umrechnung als reine Funktion" "$(
  cat <<'EOF'
Umrechnung zwischen g, kg, ml, l, Stueck und Portion. Bewusst als reine
Funktion ohne I/O, damit sie mock-frei testbar ist.

**Ehrlich zu den Grenzen:** ml nach g ist ohne Dichte nicht allgemein loesbar.
Die Funktion darf hier nicht raten, sondern muss "nicht umrechenbar" liefern —
bei Produkten mit hinterlegter Dichte oder Portionsgewicht wird gerechnet,
sonst nicht.

**Akzeptanzkriterien**
- [ ] Unit-Tests fuer g<->kg, ml<->l, Stueck<->g (mit Portionsgewicht)
- [ ] Ohne Portionsgewicht liefert Stueck<->g explizit "nicht umrechenbar"
- [ ] ml<->g ohne Dichte ebenso
- [ ] Keine Praezisionsfehler bei typischen Werten
EOF
)" "$(partof E6)" "$(deps 0.2)"

mk 6.6 "$P1" "feature,ui" "Liste haeufig verwendeter Lebensmittel" "$(
  cat <<'EOF'
Personalisierte Schnellauswahl aus der lokalen Nutzungshistorie — laut README
einer der Haupthebel fuer eine kurze Time-to-first-log.

Auswertung rein lokal in SQLite: kein Serverzugriff noetig, funktioniert
offline, und die Ernaehrungsgewohnheiten verlassen das Geraet nicht.

**Akzeptanzkriterien**
- [ ] Sortiert nach Haeufigkeit, bei Gleichstand nach Aktualitaet
- [ ] Auf die Mahlzeitart eingeschraenkt (Fruehstueck zeigt Fruehstuecks-Produkte)
- [ ] Funktioniert offline
EOF
)" "$(partof E6)"
later 6.6 7.6

mk 6.7 "$P1" "feature,ui" "Produkt manuell anlegen" "$(
  cat <<'EOF'
Fuer Barcodes ohne Treffer und fuer unverpackte Lebensmittel.

**Akzeptanzkriterien**
- [ ] Naehrwerteingabe je 100 g mit Plausibilitaetspruefung
- [ ] Wird mit `source = 'manual'` gespeichert und ist sofort suchbar
- [ ] Optional mit Barcode verknuepfbar
- [ ] Der Anleger kann sein Produkt spaeter korrigieren (#1.5)
EOF
)" "$(partof E6)" "$(deps 6.3 1.5)"

# ==========================================================================
echo "==> Epic 7 — Kalorien & Tagebuch"
# ==========================================================================

mk 7.1 "$P1" "feature,test" "Grundumsatz-Formeln als reine Funktionen" "$(
  cat <<'EOF'
Mifflin-St Jeor und Harris-Benedict (Revision Roza/Shizgal) als reine
Funktionen ohne I/O — deshalb vollstaendig mock-frei testbar.

**Mifflin-St Jeor** (heute der Standard, praeziser als Harris-Benedict):
- Maennlich: `10*kg + 6.25*cm - 5*Alter + 5`
- Weiblich:  `10*kg + 6.25*cm - 5*Alter - 161`

**Fachlich zu klaeren:** Beide Formeln kennen nur zwei Geschlechter. Fuer
Nutzer, die weder "maennlich" noch "weiblich" angeben, gibt es keine validierte
Formel. Sauberste Loesung: ein separates Feld "Berechnungsbasis" neben der
Geschlechtsidentitaet, oder das Kalorienziel wird manuell gesetzt. Nicht
stillschweigend auf einen Wert defaulten.

**Akzeptanzkriterien**
- [ ] Beide Formeln gegen publizierte Referenzwerte getestet
- [ ] Grenzfaelle: sehr jung, sehr alt, extreme Groesse/Gewicht
- [ ] Unvollstaendiges Profil -> explizit "nicht berechenbar", kein Ratewert
- [ ] Keine Datums- oder Zeitzonenabhaengigkeit in der Funktion selbst
EOF
)" "$(partof E7)" "$(deps 0.2)"

mk 7.2 "$P1" "feature,test" "TDEE und Zielkalorien berechnen" "$(
  cat <<'EOF'
Gesamtumsatz aus Grundumsatz mal Aktivitaetsfaktor (sedentary 1.2 bis
very active 1.9), daraus das Kalorienziel je nach Ziel und Tempo
(0,25 bis 1 kg pro Woche; 1 kg Koerperfett entspricht rund 7700 kcal).

**Sicherheitsgrenze, die nicht fehlen darf:** Das berechnete Ziel darf nie
unter den Grundumsatz fallen und nicht unter allgemein anerkannte Mindestwerte
(rund 1200 kcal fuer Frauen, 1500 fuer Maenner). Bei aggressiven Zielen wird
gekappt und der Nutzer darauf hingewiesen — eine Ernaehrungsapp, die zu einem
gefaehrlichen Defizit raet, ist ein echtes Risiko und auch ein
App-Store-Review-Thema.

**Akzeptanzkriterien**
- [ ] Alle Aktivitaetsstufen getestet
- [ ] Kappung greift und ist im Ergebnis erkennbar (nicht still)
- [ ] Zunehmen erzeugt einen Ueberschuss, Halten das Gesamtumsatz-Niveau
- [ ] Unrealistisches Tempo -> Warnung statt Kommentarlos-Rechnung
EOF
)" "$(partof E7)" "$(deps 7.1)"

mk 7.3 "$P1" "feature,test" "Makro-Verteilung mit Presets" "$(
  cat <<'EOF'
Aufteilung der Zielkalorien auf Protein, Kohlenhydrate und Fett
(4/4/9 kcal je Gramm). Presets: ausgewogen 30/40/30, Low-Carb 40/20/40,
High-Protein 40/30/30, dazu frei anpassbar.

**Akzeptanzkriterien**
- [ ] Prozente ergeben immer 100, Rundungsreste werden sauber verteilt
- [ ] Gramm-Werte passen zu den Zielkalorien
- [ ] Anpassung eines Makros verteilt den Rest nachvollziehbar
EOF
)" "$(partof E7)" "$(deps 7.2)"

mk 7.4 "$P1" "feature,ui" "Ziel-Setup-Screen" "$(
  cat <<'EOF'
UI fuer #7.1 bis #7.3: aktuelles Gewicht, Wunschgewicht, Tempo, Aktivitaetslevel,
Makro-Preset. Ergebnis wird in `user_goals` (#1.8) gespeichert.

**Akzeptanzkriterien**
- [ ] Live-Vorschau des Kalorienziels waehrend der Eingabe
- [ ] Kappung aus #7.2 wird sichtbar erklaert, nicht still angewandt
- [ ] Manuelles Ueberschreiben des Ziels ist moeglich
- [ ] Aenderungen werden historisiert (`valid_from`), nicht ueberschrieben
EOF
)" "$(partof E7)" "$(deps 7.3 3.6)"

mk 7.5 "$P1" "feature,ui" "Tagebuch-Screen nach Mahlzeiten" "$(
  cat <<'EOF'
Tagesansicht gruppiert nach Fruehstueck, Mittag, Abendessen und Snack, mit
Summen je Mahlzeit.

**Akzeptanzkriterien**
- [ ] Vier Abschnitte, jeweils mit Kalorien-Zwischensumme
- [ ] Leere Mahlzeiten zeigen eine Hinzufuegen-Aktion
- [ ] Daten sind privat (#1.8) und im aktiven Kinder-Profil-Kontext korrekt
EOF
)" "$(partof E7)" "$(deps 1.8 3.1)"

mk 7.6 "$P1" "feature,ui" "Eintrag hinzufuegen, bearbeiten, loeschen" "$(
  cat <<'EOF'
Ueber Produktsuche (#6.2), Barcode (#6.3) oder haeufig verwendete Produkte
(#6.6). Naehrwerte werden beim Speichern in den Eintrag kopiert (#1.8).

**Akzeptanzkriterien**
- [ ] Optimistisches Update, Summen aktualisieren sich sofort
- [ ] Bearbeiten der Menge rechnet die Naehrwerte neu
- [ ] Loeschen mit Undo
- [ ] Time-to-first-log fuer ein bekanntes Produkt unter 15 Sekunden
EOF
)" "$(partof E7)" "$(deps 7.5 6.4)"

mk 7.7 "$P1" "feature,ui" "Tagessummen und Restkalorien" "$(
  cat <<'EOF'
Aufgenommene Kalorien, Rest zum Ziel, Makro-Fortschritt. Aktivitaetskalorien
kommen erst in Phase 3 dazu — die Berechnung sollte den Platz dafuer bereits
vorsehen.

**Akzeptanzkriterien**
- [ ] Summen stimmen mit den Einzeleintraegen ueberein
- [ ] Ueberschreitung wird deutlich, aber ohne wertende Sprache dargestellt
- [ ] Ohne gesetztes Ziel wird die reine Aufnahme angezeigt, kein Platzhalterziel
EOF
)" "$(partof E7)" "$(deps 7.6 7.4)"

mk 7.8 "$P1" "feature,ui" "Datumsnavigation im Tagebuch" "$(
  cat <<'EOF'
Vor- und Zurueckblaettern zwischen Tagen, Sprung zu heute, Datumsauswahl.

**Zeitzonen-Detail:** `logged_on` ist ein reines Datum in der lokalen Zeitzone
des Nutzers, kein UTC-Zeitstempel. Wer die Umrechnung falsch macht, sieht
abends Eintraege am Folgetag — ein klassischer, spaet auffallender Fehler.

**Akzeptanzkriterien**
- [ ] Wischen oder Pfeile wechseln den Tag
- [ ] Ein um 23:30 Uhr geloggter Eintrag steht am selben lokalen Tag
- [ ] Zukuenftige Tage sind nicht bearbeitbar
- [ ] Vergangene Tage funktionieren offline aus dem lokalen Cache
EOF
)" "$(partof E7)" "$(deps 7.5)"

# ==========================================================================
echo "==> Epic 8 — Dashboard & Navigation"
# ==========================================================================

mk 8.1 "$P1" "ui" "Tab-Struktur erweitern" "$(
  cat <<'EOF'
`src/components/app-tabs.tsx` von Home/Explore auf Dashboard, Kuehlschrank,
Einkauf, Rezepte und Profil erweitern. Verwendet `NativeTabs` aus
`expo-router/unstable-native-tabs` — die bestehende Struktur mit
`NativeTabs.Trigger` und Template-Icons beibehalten.

**Aufgaben**
- Tab-Icons in `assets/images/tabIcons/` in @1x/@2x/@3x ergaenzen
- Farben weiterhin aus `Colors` in `src/constants/theme.ts`

**Akzeptanzkriterien**
- [ ] Fuenf Tabs auf iOS und Android
- [ ] Icons in Dark und Light Mode korrekt (`renderingMode="template"`)
- [ ] Eigener Commit fuer die UI-Aenderung (CLAUDE.md)
EOF
)" "$(partof E8)" "$(deps 3.1)"

mk 8.2 "$P1" "ui" "Template-Screens durch echte Screens ersetzen" "$(
  cat <<'EOF'
`src/app/index.tsx` und `src/app/explore.tsx` sind noch die Expo-Willkommens-
Screens und werden durch Dashboard und die Feature-Screens ersetzt.

**Vorgehen laut CLAUDE.md**
- Eigener, isolierter Commit nur fuer diesen Austausch
- `src/components/ui/` wird nicht angefasst
- Wiederverwendbare Bausteine (`ThemedText`, `ThemedView`, `HintRow`) bleiben
  erhalten und werden weiterverwendet, nicht neu gebaut

**Akzeptanzkriterien**
- [ ] Keine Expo-Template-Inhalte mehr sichtbar
- [ ] `AnimatedSplashOverlay` funktioniert unveraendert
- [ ] Web-Build laeuft weiterhin (`app-tabs.web.tsx` beachten)
EOF
)" "$(partof E8)" "$(deps 8.1)"

mk 8.3 "$P1" "ui" "Animierter Kalorien-Fortschrittsring" "$(
  cat <<'EOF'
Kreisdiagramm mit Fuellanimation auf Basis von `react-native-svg` und
`react-native-reanimated` (beide bereits installiert).

**Akzeptanzkriterien**
- [ ] Animiert weich auf den aktuellen Wert
- [ ] Ueberschreitung wird sichtbar dargestellt (Ring laeuft nicht still voll)
- [ ] Respektiert "Bewegung reduzieren" aus den Systemeinstellungen
- [ ] Keine Ruckler beim Scrollen (Reanimated auf dem UI-Thread)
EOF
)" "$(partof E8)" "$(deps 7.7)"

mk 8.4 "$P1" "ui" "Makro-Fortschrittsbalken" "$(
  cat <<'EOF'
Protein, Kohlenhydrate und Fett gegen die Zielwerte aus #7.3.

**Akzeptanzkriterien**
- [ ] Ist- und Zielwert je Makro in Gramm
- [ ] Barrierefrei beschriftet, Farbe nicht als einzige Information
- [ ] Dark und Light Mode
EOF
)" "$(partof E8)" "$(deps 7.7)"

mk 8.5 "$P1" "ui" "Dashboard-Tagesuebersicht" "$(
  cat <<'EOF'
Zentraler Screen: Kalorienring (#8.3), Makro-Balken (#8.4), ablaufende Artikel
(#5.7) und Schnellaktionen.

Bewusst zurueckhaltend: Streaks, XP und Level kommen erst in Phase 4. Ein
Dashboard, das Gamification zeigt, bevor die Datenbasis stimmt, erzeugt falsche
Anreize.

**Akzeptanzkriterien**
- [ ] Laedt in unter einer Sekunde aus dem lokalen Cache
- [ ] Funktioniert offline vollstaendig
- [ ] Leerzustand fuer neue Nutzer ist hilfreich, nicht leer
- [ ] Pull-to-Refresh stoesst einen Sync an
EOF
)" "$(partof E8)" "$(deps 8.3 8.4 8.2)"

mk 8.6 "$P1" "ui,feature" "Profil- und Einstellungs-Screen" "$(
  cat <<'EOF'
Profil bearbeiten, Ziele anpassen (#7.4), Haushalt verwalten (Epic 4),
Benachrichtigungen, Datenschutz (Epic 9), Logout (#3.7).

**Akzeptanzkriterien**
- [ ] Alle Bereiche erreichbar
- [ ] Aktiver Haushalt sichtbar, Wechsel moeglich (#4.8)
- [ ] App-Version und Build-Nummer werden angezeigt
EOF
)" "$(partof E8)" "$(deps 8.1 3.7 4.8)"

mk 8.7 "$P1" "feature,ui" "Modul-Aktivierung (Feature-Flags pro Nutzer)" "$(
  cat <<'EOF'
Die modulare Architektur aus dem README: Nutzer aktivieren nur die Module, die
sie brauchen; nicht aktivierte Module verschwinden aus der Navigation.

**Umsetzung**
- `enabled_modules text[]` im Profil, lokal gespiegelt
- `app-tabs.tsx` rendert Tabs bedingt
- Core-Module (Dashboard, Profil) sind nicht abwaehlbar
- Onboarding schlaegt anhand der Ziele ein sinnvolles Startset vor

**Akzeptanzkriterien**
- [ ] Aktivieren und Deaktivieren wirkt sofort, ohne App-Neustart
- [ ] Deaktivierte Module verlieren keine Daten
- [ ] Mindestens Dashboard und Profil bleiben immer sichtbar
EOF
)" "$(partof E8)" "$(deps 8.1 8.6)"

# ==========================================================================
echo "==> Epic 9 — Datenschutz"
# ==========================================================================

mk 9.1 "$P1" "docs,risk" "Datenschutzerklaerung mit korrekter Verschluesselungsaussage" "$(
  cat <<'EOF'
**Korrektur einer Zusage aus dem README.** Dort steht
"End-to-End-Verschluesselung sensibler Gesundheitsdaten bei der
Cloud-Synchronisation". Das ist mit der gewaehlten Architektur nicht einloesbar:
Bei echter E2EE koennte der Server die Daten nicht lesen — damit waeren
RLS-Filterung, serverseitige Aggregation und Realtime-Filter unmoeglich. Eine
falsche Verschluesselungszusage ist zudem ein Compliance-Risiko und ein
Ablehnungsgrund im App-Store-Review.

**Korrekte Formulierung:** Transportverschluesselung (TLS), Verschluesselung at
rest auf Datenbankebene, Zugriffstrennung ueber Row Level Security, sensible
Tokens im geraetegebundenen Keychain/Keystore. Persoenliche Gesundheitsdaten
sind fuer andere Haushaltsmitglieder technisch nicht zugaenglich.

**Akzeptanzkriterien**
- [ ] Datenschutztext beschreibt exakt, was tatsaechlich implementiert ist
- [ ] Verarbeitete Datenkategorien und Zwecke sind aufgefuehrt
- [ ] Open Food Facts als Drittdienst ist genannt
- [ ] README-Formulierung wird entsprechend korrigiert
EOF
)" "$(partof E9)"

mk 9.2 "$P1" "feature" "Datenexport" "$(
  cat <<'EOF'
Vollstaendiger Export aller Nutzerdaten als JSON ueber die native Share-Sheet
(`expo-sharing`) — Datenportabilitaet nach DSGVO Art. 20.

**Akzeptanzkriterien**
- [ ] Enthaelt Profil, Ziele, Tagebuch, Gewicht und Haushaltsmitgliedschaften
- [ ] Enthaelt keine Daten anderer Nutzer
- [ ] Funktioniert auch bei mehreren tausend Eintraegen ohne Absturz
- [ ] Datei ist ohne die App lesbar (dokumentiertes JSON)
EOF
)" "$(partof E9)" "$(deps 7.6)"

mk 9.3 "$P1" "feature,backend" "Account- und Datenloeschung" "$(
  cat <<'EOF'
Vollstaendige Loeschung ueber eine Edge Function mit Service-Role — der Client
kann `auth.users` nicht selbst loeschen.

**Kantenfall, der bedacht werden muss:** Ist der Nutzer letzter Admin eines
Haushalts mit weiteren Mitgliedern, darf der Haushalt nicht einfach
mitgeloescht werden. Vorher Admin uebertragen oder den Haushalt explizit
mitloeschen lassen — mit klarer Ansage.

**Akzeptanzkriterien**
- [ ] Loescht Auth-User, Profil und alle privaten Daten kaskadierend
- [ ] Haushalte mit weiteren Mitgliedern bleiben bestehen
- [ ] Letzter Admin wird zur Entscheidung aufgefordert
- [ ] Lokale SQLite-Daten werden ebenfalls geloescht
- [ ] Zwei-Schritt-Bestaetigung
EOF
)" "$(partof E9)" "$(deps 3.7 4.6)"

mk 9.4 "$P1" "docs" "App-Store-Privacy-Labels vorbereiten" "$(
  cat <<'EOF'
Apple "App Privacy" und Google "Data Safety" ausfuellen.

**Akzeptanzkriterien**
- [ ] Alle erhobenen Datenkategorien erfasst (Gesundheit, Kontakt, Kennungen)
- [ ] Kamera-, Standort- und Benachrichtigungs-Zwecke begruendet
- [ ] Alle `NS*UsageDescription`-Texte in `app.json` gepflegt und aussagekraeftig
- [ ] Angaben decken sich mit #9.1 — keine Widersprueche
EOF
)" "$(partof E9)" "$(deps 9.1)"

# ------------------------------------------- Nachtrag: Vorwaertsabhaengigkeiten
if [ -s "$LATE" ]; then
  echo "==> Vorwaertsabhaengigkeiten nachtragen"
  while IFS=$'\t' read -r k d; do
    kn="$(num "$k")"
    dn="$(num "$d")"
    if [ -z "$kn" ] || [ -z "$dn" ]; then
      echo "  ! konnte $k -> $d nicht aufloesen" >&2
      continue
    fi
    body="$(gh issue view "$kn" --json body --jq .body)"
    gh issue edit "$kn" --body "${body}"$'\n'"Blocked by #${dn}" >/dev/null
    echo "  #$kn  Blocked by #$dn"
    sleep 1
  done <"$LATE"
fi

# ------------------------------------------------------------------- Abschluss
echo
echo "Fertig. Angelegte Issues:"
wc -l <"$MAP" | tr -d ' ' | sed 's/$/ Stueck/'
echo
echo "Naechste Schritte:"
echo "  gh issue list --limit 120"
echo "  gh issue list --milestone \"$P0\""
echo "  gh issue list --label epic"
