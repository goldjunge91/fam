# Diagnose: langsame Synchronisierung / verdoppelter Poll-Traffic

**Status:** Untersuchung laeuft — zwei neue Diagnose-Werte im Sync-Diagnose-
Screen eingebaut, warten auf Messdaten aus einem laengeren Idle-Test.
**Created:** 2026-08-11

## Ausgangsbefunde (vom Nutzer gemeldet)

1. "Normales Synchronisieren dauert extrem lange" — Aenderung auf Gerät A,
   sichtbar auf Gerät B nach gefuehlt 5-10s statt nahezu instant.
2. Mehrere HAR-Exports (`network-log*.har`, aus dem React-Native/Expo
   Netzwerk-Inspector) zeigen einen wiederkehrenden Doppel-Pull: Der volle
   Satz haushalts-gescopter Entities (`storage_locations`, `stores`,
   `fridge_items`, `shopping_list_items`) wird nicht sauber alle 20s
   (`useSyncEngine`s codierter Poll-Intervall) angefragt, sondern in
   Zweier-Gruppen mit ca. 2s Abstand zueinander, wobei sich die Gruppen im
   ~20s-Rhythmus wiederholen — z. B.
   `01:51:09.819`, `01:51:27.495`, `01:51:29.807`, `01:51:47.498`,
   `01:51:49.976`, ... (aus `network-log_after_poll_1.har`).

## Bereits ausgeschlossen (mit Beleg)

- **Zwei physische Geraete als Ursache:** Nutzer hat per Netzwerk-Tab-Reload
  bestaetigt, dass der HAR-Export nur ein Geraet zeigt.
- **Doppeltes `useSyncEngine`-Intervall (Leak beim Effect-Cleanup):**
  Neuer Zaehler `getActiveSyncEngineIntervalCount()`
  (`src/lib/sync/sync-runner.ts`) zeigt konstant `1`, auch im HAR-Export mit
  weiterhin vorhandenem Doppel-Pull-Muster (`network-log_after_poll_1.har`).
  Das schliesst einen ausstehenden `clearInterval`-Bug aus.
- **Excessive Auth-Traffic (Token-Refresh-Churn):** Nutzer-Hypothese
  geprueft — `network-log_after_poll_1.har` enthaelt keinen einzigen
  `/auth/*`-Request. Der fruehere `network-log_long.har` zeigt genau zwei
  `POST /auth/v1/token?grant_type=refresh_token` ueber eine mehrminuetige
  Aufnahme — normales, seltenes Token-Refresh-Verhalten, keine Haeufung.
- **HAR zeigt keine WebSocket-Verbindung → Realtime nicht verbunden:**
  Widerlegt. In keinem der drei HAR-Exports taucht ein
  `/realtime/v1/websocket`-Eintrag auf — aber der Nutzer hat den
  `Realtime-Verbindung`-Status (neu im Sync-Diagnose-Screen, siehe unten)
  live als `SUBSCRIBED` gesehen (daher der Dateiname
  `network-log_SUBSCRIBED.har`). Der React-Native/Expo Netzwerk-Inspector
  zeichnet offenbar grundsaetzlich keine WebSocket-Frames auf — das ist eine
  Einschraenkung des Aufnahme-Tools, kein Befund ueber den Verbindungsstatus.

## Aktuelle Arbeitshypothese

Der Realtime-Kanal verbindet sich erfolgreich (`SUBSCRIBED` bestaetigt),
trennt sich aber vermutlich periodisch wieder (z. B. alle ~20s) und baut neu
auf. Jeder solche Reconnect loest ueber
`onReconnectResyncNeeded` (`src/lib/sync/realtime.ts`) einen **zusaetzlichen**
vollen `triggerHouseholdSync()`-Lauf aus — obendrauf auf den regulaeren
20s-Poll aus `useSyncEngine`. Das ergaebe genau das beobachtete Muster
(zwei Pulls kurz hintereinander, dann ~20s Pause), **ohne** dass ein zweites
Intervall existieren muss — passt also zusammen mit dem bereits
ausgeschlossenen Interval-Leak.

Falls das zutrifft, erklaert es vermutlich auch Befund 1 (gefuehlt langsame
Sync): Ein staendig ab- und wieder aufbauender Kanal liefert `postgres_changes`-
Events nicht zuverlaessig in Echtzeit — manche Aenderungen kommen sofort an
(waehrend verbunden), andere erst nach dem naechsten Reconnect oder dem
naechsten 20s-Poll-Tick.

### Technischer Hintergrund (verifiziert im installierten Paket)

`@supabase/realtime-js@2.112.1` (Dependency von `@supabase/supabase-js@2.112.1`):

- Nutzt fuer den Transport `WebSocketFactory.getWebSocketConstructor()`
  (`node_modules/@supabase/realtime-js/dist/main/lib/websocket-factory.js`),
  die schlicht das global verfuegbare `WebSocket` sucht (`typeof WebSocket
  !== 'undefined'`). React Native stellt das nativ zur Verfuegung — es wird
  keine zusaetzliche Bibliothek oder ein Polyfill gebraucht, und es gibt
  keinen React-Native-spezifischen Sonderpfad, der hier fehlschlagen koennte.
- Default-Konfiguration
  (`node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js`):
  `HEARTBEAT_INTERVAL = 25000` (25s), `DEFAULT_TIMEOUT = 10000` (10s).
  Das Client-Protokoll ist Phoenix-Channels-basiert (`@supabase/phoenix`).
- Kein `transport`/`heartbeatIntervalMs`/`timeout` wird in diesem Projekt
  explizit an `createClient()` uebergeben (`src/lib/supabase.ts`) — es laufen
  ueberall die Bibliotheks-Defaults.
- Die 25s-Heartbeat-Periode liegt nahe am beobachteten ~20s-Rhythmus, aber
  nicht exakt genug fuer eine sichere Kausalitaetsaussage allein daraus —
  das ist eine Beobachtung, kein Beweis.

### Warum die vom Nutzer verlinkten Ressourcen hier nicht direkt greifen

Die verlinkten Quellen (Expo+Spring-Boot-WebSocket-Tutorial, generische
Expo-WebSocket-Bibliotheksuebersicht mit Pusher/ActionCable/TinyBase) drehen
sich um **eigene** WebSocket-Server/-Bibliotheken, die man selbst in eine
Expo-App einbindet. Dieses Projekt nutzt keine davon — `@supabase/realtime-js`
bringt seinen eigenen, in `supabase-js` eingebetteten WebSocket-Client mit,
der lediglich das RN-native `WebSocket`-Global braucht (siehe oben). Die
Bibliotheksuebersicht bestaetigt aber indirekt einen relevanten Punkt: "Fuer
einfache WebSocket-Beduerfnisse funktioniert React Natives eingebaute
`WebSocket`-API von Haus aus auf iOS" — also genau der Pfad, den
`realtime-js` auch nimmt. Keine der Quellen liefert Hinweise auf ein
bekanntes Problem mit `@supabase/realtime-js` selbst.

## Neue Diagnose-Werte (Sync-Diagnose-Screen, `src/features/settings/sync-debug-screen.tsx`)

Alle vier Werte aktualisieren sich alle 2s automatisch, ohne manuelle
Aktion:

- **Realtime-Verbindung** — aktueller `SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`/
  `CLOSED`-Status (`getLastRealtimeStatus()` in `sync-runner.ts`).
- **Aktive Poll-Intervalle** — sollte immer `1` sein (`getActiveSyncEngineIntervalCount()`).
- **Realtime Status-Wechsel gesamt** — Zaehler ueber die gesamte App-Sitzung
  (`getRealtimeDiagnostics().statusChangeCount`). Ein hoher, stetig
  wachsender Wert bei ansonsten unveraendertem WLAN deutet auf einen
  instabilen Kanal hin.
- **Realtime Reconnects gesamt** — Zaehler nur fuer echte Reconnects (Uebergang
  zurueck zu `SUBSCRIBED` nach einer Stoerung, loest zusaetzlichen vollen
  Resync aus) UND Netzwerk-Reconnect-Events (`getRealtimeDiagnostics().reconnectCount`).
  Waechst dieser Wert waehrend eines mehrminuetigen Idle-Tests staendig,
  ist die Reconnect-Flapping-Hypothese bestaetigt.

## Update 2026-08-11: Reconnect-Flapping-Hypothese widerlegt

Mit den neuen Zaehlern gemessen (`network-log_latest.har`, gleichzeitig
`Sync-Diagnose` abgelesen): **Aktive Poll-Intervalle: 1, Realtime
Status-Wechsel gesamt: 1, Reconnects gesamt: 0.** Die Verbindung war die
ganze Zeit stabil — ein einziger Connect, kein einziger Reconnect. Damit ist
die Reconnect-Flapping-Hypothese **widerlegt**.

Passend dazu zeigt `network-log_latest.har` den vollen Pull-Zyklus
(`storage_locations?select=*`) sauber im codierten 20s-Takt, OHNE das
fruehere Doppel-Pull-Muster: `02:09:21.466`, `02:09:41.234`,
`02:10:01.244` (19.77s, 20.01s Abstand).

**Docker-Logs des lokalen Realtime-Containers** (`supabase_realtime_fam`)
zeigen zwei Eintraege im Abstand von genau 10 Minuten:

```
01:59:38.164 [info] Killing 3 transport pids with no channels open
02:09:38.165 [info] Killing 4 transport pids with no channels open
```

Das ist ein periodischer Aufraeum-Sweep des Realtime-Servers (alle 10min),
der verwaiste WebSocket-Transports ohne angehaengte Channels beendet — bei
0 gemessenen Reconnects der aktuellen Session koennen diese 3-4 Prozesse
nicht von der aktuell aktiven Verbindung stammen. Wahrscheinlichste Erklaerung:
Reste fruehere App-Starts/Fast-Refresh-Zyklen waehrend der Entwicklung, die
nie sauber geschlossen wurden (siehe `subscribeHouseholdRealtime()`s eigene
Kommentare zu genau diesem Fast-Refresh-Fall in `realtime.ts`) und irgendwann
vom periodischen Sweep eingesammelt werden — keine aktive Stoerung der
laufenden Verbindung.

**Schlussfolgerung:** Das fruehere Doppel-Pull-Muster war vermutlich ein
Uebergangszustand (z. B. waehrend/kurz nach mehreren App-Reloads waehrend
der Entwicklung dieser Session), nicht ein dauerhafter Bug. Mit einer sauber
durchgestarteten, stabilen Verbindung tritt es nicht mehr auf. Die
gefuehlten 5-10s Sync-Latenz sind damit noch nicht erklaert — dafuer braucht
es jetzt eine gezielte Messung bei bestaetigt stabiler Verbindung (siehe
naechste Schritte).

## Naechste Schritte

Reconnect-Flapping ist widerlegt (s.o.) — der Fokus verschiebt sich von
"warum trennt die Verbindung" zu "wie schnell kommt eine Aenderung bei
bestaetigt stabiler Verbindung tatsaechlich an":

1. **Gezielte Latenzmessung:** Bei weiterhin `Reconnects: 0` auf beiden
   Geraeten — auf Geraet A einen Artikel anlegen/aendern, auf Geraet B mit
   Stoppuhr messen, wann er erscheint. Mehrfach wiederholen (Einzelmessung
   ist anfaellig fuer Zufallsstreuung). Erwartungswert laut Supabase-Doku
   fuer `postgres_changes` (Cloud, p95): 184-1310ms — deutlich unter den
   gefuehlten 5-10s.
2. **Falls weiterhin spuerbar langsam bei bestaetigt 0 Reconnects:** naechster
   Verdaechtiger ist die lokale Docker-Realtime-Instanz selbst (Ressourcen,
   WAL-Publication-Latenz) statt der App — testweise gegen ein echtes
   (nicht-lokales) Supabase-Projekt vergleichen, um lokale Dev-Stack-Grenzen
   von einem Code-Bug zu trennen.
3. **Die "Killing N transport pids"-Logzeilen** (alle 10 Minuten) sind
   voraussichtlich harmlos (Cleanup alter Verbindungen), aber nicht
   abschliessend bewiesen — falls die Anzahl ueber laengere Nutzung staendig
   waechst statt stabil zu bleiben, waere das ein Hinweis auf tatsaechlich
   leckende Verbindungen (z. B. durch haeufige Fast-Refresh-Zyklen im
   Dev-Build) und mit `docker logs supabase_realtime_fam` weiter zu
   beobachten.
4. **mitmproxy** (vom Nutzer bereits installiert) bleibt das richtige
   Werkzeug, falls doch wieder Instabilitaet auftritt — zeigt WebSocket-
   Frames direkt, was kein HAR-Export dieses Projekts bisher konnte.
