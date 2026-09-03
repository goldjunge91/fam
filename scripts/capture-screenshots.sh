#!/usr/bin/env bash
# Dieses Skript nimmt die aktivierte fam-Tour auf einem gestarteten iOS-Simulator auf.
# Es benötigt einen fam-Dev-Build und Metro unter localhost:8081.
# Die eigentliche Screen-Auswahl steht in src/lib/screenshots.ts.
# Strenge Bash-Optionen beenden den Lauf bei Fehlern, fehlenden Variablen und Pipeline-Fehlern.
set -euo pipefail

BUNDLE="com.goldjunge91.fam1"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
OUT="$REPO/docs/screenshots"
# Unvollständige Läufe bleiben in einem temporären Verzeichnis und beschädigen die Galerie nicht.
STAGING="$(mktemp -d "${TMPDIR:-/tmp}/fam-screenshots.XXXXXX")"
# Ein optionales erstes Argument wählt einen bestimmten Simulator aus.
UDID="${1:-}"
# Der Documents-Pfad ist erst bekannt, nachdem der App-Container gefunden wurde.
DOCS=""
# Dieses Flag verhindert einen unnötigen App-Neustart vor dem eigentlichen Capture.
CAPTURE_STARTED=false

# Diese Funktion räumt Steuerdateien und temporäre Bilder bei jedem Ende auf.
cleanup() {
	# Steuerdateien können erst entfernt werden, wenn der App-Container bekannt ist.
	if [ -n "$DOCS" ]; then
		# Alle Tourdateien werden entfernt, damit der nächste App-Start normal verläuft.
		rm -f "$DOCS/shots.json" "$DOCS/shot-current.txt" "$DOCS/shot-expected.txt" "$DOCS/shot-captured.txt"
	fi
	# UDID ist an dieser Stelle immer gesetzt, da das Skript sonst schon vorher beendet hätte.
	if [ "$CAPTURE_STARTED" = true ]; then
		# Ein bereits beendeter Prozess ist hier kein Fehler.
		xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
		# Der Neustart stellt den normalen Entwicklungszustand wieder her; ein Fehlschlag wird
		# gemeldet statt wie zuvor mit `|| true` stillschweigend verworfen zu werden.
		local relaunch_error
		if ! relaunch_error="$(xcrun simctl launch "$UDID" "$BUNDLE" 2>&1 >/dev/null)"; then
			echo "✗ App-Neustart nach dem Capture fehlgeschlagen: $relaunch_error" >&2
		fi
	fi
	# Das Staging-Verzeichnis ist nach Erfolg und Fehler nicht mehr nötig.
	rm -rf "$STAGING"
}

trap cleanup EXIT INT TERM

# Ohne Xcode kann das Skript keinen Simulator steuern.
if ! command -v xcrun >/dev/null 2>&1; then
	echo "✗ xcrun wurde nicht gefunden. Capture benötigt Xcode." >&2
	exit 1
fi
# Curl prüft vor dem App-Start den laufenden Metro-Server.
if ! command -v curl >/dev/null 2>&1; then
	# Ohne Curl kann der Metro-Status nicht zuverlässig geprüft werden.
	echo "✗ curl wurde nicht gefunden." >&2
	exit 1
fi
# Sips skaliert die fertigen PNG-Dateien auf die Galeriebreite.
if ! command -v sips >/dev/null 2>&1; then
	echo "✗ sips wurde nicht gefunden. Das macOS-Bildwerkzeug wird benötigt." >&2
	# Ohne Skalierung wird kein inkonsistenter Teilerfolg veröffentlicht.
	exit 1
fi

# Ohne übergebene UDID wird der erste gestartete Simulator gewählt.
if [ -z "$UDID" ]; then
	UDID="$(xcrun simctl list devices booted | grep -oE '\([0-9A-Fa-f-]{36}\)' | tr -d '()' | head -1 || true)"
fi
if [ -z "$UDID" ]; then
	echo "✗ Kein booteter iOS-Simulator gefunden." >&2
	exit 1
fi

# Der Expo-Packager muss seinen Running-Status auf Port 8081 liefern.
if ! curl --fail --silent http://127.0.0.1:8081/status >/dev/null; then
	# Ohne Metro kann der Dev-Build keine aktuelle JavaScript-Version laden.
	echo "✗ Metro ist auf Port 8081 nicht erreichbar. Starte zuerst den Development-Server." >&2
	# Das Skript beendet sich ohne den laufenden Simulator anzufassen.
	exit 1
fi

if ! APP_CONTAINER="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data 2>/dev/null)"; then
	echo "✗ fam ($BUNDLE) ist auf $UDID nicht installiert." >&2
	# Ohne Container kann das Dateiprotokoll nicht verwendet werden.
	exit 1
fi

DOCS="$APP_CONTAINER/Documents"
mkdir -p "$OUT" "$STAGING"
# Ein alter Screen-Status darf keinen sofortigen Capture auslösen, eine alte Sollzahl
# nicht die Abschlussprüfung verfälschen, eine alte Bestätigung keinen Schritt überspringen.
rm -f "$DOCS/shot-current.txt" "$DOCS/shot-expected.txt" "$DOCS/shot-captured.txt"
# Diese Werte werden unten sowohl in shots.json geschrieben als auch ausgegeben,
# damit die tatsächlich wirkenden Timer beim Tunen sichtbar sind.
CAPTURE_TIMEOUT_MS=3000
SETTLE_MS=1000
FIXTURE_TIMEOUT_MS=1500
ARMED_AT_MS=$(( $(date +%s) * 1000 ))
# Die Datei wird direkt in den für Expo FileSystem sichtbaren Container geschrieben.
printf '%s' "{\"enabled\":true,\"armedAt\":$ARMED_AT_MS,\"captureTimeoutMs\":$CAPTURE_TIMEOUT_MS,\"settleMs\":$SETTLE_MS,\"fixtureTimeoutMs\":$FIXTURE_TIMEOUT_MS}" \
	>"$DOCS/shots.json"

echo "▶ fam-Screenshots werden auf $UDID aufgenommen"
# Diese Meldung zeigt die aktiven Timer, damit "Seiten wechseln zu schnell" gezielt tunbar ist.
echo "  Timer: settleMs=$SETTLE_MS captureTimeoutMs=$CAPTURE_TIMEOUT_MS fixtureTimeoutMs=$FIXTURE_TIMEOUT_MS"
echo "  App wird für den Screenshot-Lauf neu gestartet..."
# Die App wird gestoppt, damit Flag-Datei und native Einstellungen beim Start gelten.
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true

# Expo SDK 57 speichert diese Dev-Menü-Einstellungen in den UserDefaults der App.
# Die Werte werden im gestoppten Zustand gesetzt, damit keine native Entwicklungsoberfläche Bilder verdeckt.
# Diese Einstellung markiert das Dev-Menü-Onboarding als abgeschlossen.
# Diese Einstellung verhindert das automatische Dev-Menü beim App-Start.
# Diese Einstellung versteckt den nativen schwebenden Dev-Menü-Button.
xcrun simctl spawn "$UDID" defaults write "$BUNDLE" EXDevMenuIsOnboardingFinished -bool true
xcrun simctl spawn "$UDID" defaults write "$BUNDLE" EXDevMenuShowsAtLaunch -bool false
xcrun simctl spawn "$UDID" defaults write "$BUNDLE" EXDevMenuShowFloatingActionButton -bool false

# Der neue App-Prozess liest shots.json und startet den unsichtbaren Driver.
# Ein Fehlschlag wird mit der tatsächlichen simctl-Meldung gemeldet statt stumm zu verworfen.
if ! start_error="$(xcrun simctl launch "$UDID" "$BUNDLE" 2>&1 >/dev/null)"; then
	echo "✗ App-Start für den Screenshot-Lauf fehlgeschlagen: $start_error" >&2
	exit 1
fi
echo "  App gestartet; warte auf die ScreenshotTour..."
# Ab jetzt stellt Cleanup nach dem Lauf den normalen App-Zustand wieder her.
CAPTURE_STARTED=true

last=""
count=0
expected=0
deadline=$(($(date +%s) + 600))

# Diese Schleife verarbeitet Statusänderungen bis Done oder zur Deadline.
while [ "$(date +%s)" -lt "$deadline" ]; do
	# Die App veröffentlicht die erwartete Bildanzahl in einer kleinen Textdatei.
	file_expected="$(cat "$DOCS/shot-expected.txt" 2>/dev/null || true)"
	if [[ "$file_expected" =~ ^[1-9][0-9]*$ ]]; then
		expected="$file_expected"
	fi
	current="$(cat "$DOCS/shot-current.txt" 2>/dev/null || true)"
	if [ -n "$current" ] && [ "$current" != "$last" ]; then
		last="$current"
		case "$current" in
		__starting__)
			;;
		__error__)
			echo "✗ Die fam-Screenshot-Tour hat einen Fehler gemeldet." >&2
			exit 1
			;;
		__done__)
			break
			;;
		*)
			# Simctl schreibt den sichtbaren Simulatorinhalt zunächst ins Staging.
			if xcrun simctl io "$UDID" screenshot "$STAGING/$current.png" >/dev/null 2>&1; then
				# Erst nach vollständigem PNG schreibt Bash die Bestätigung für genau diesen Namen.
				printf '%s' "$current" >"$DOCS/shot-captured.txt"
				count=$((count + 1))
				echo "  ✓ $current"
			else
				# Ein simctl-Fehler darf keine unvollständige Galerie veröffentlichen.
				echo "✗ Screenshot für $current konnte nicht aufgenommen werden." >&2
				# Cleanup verwirft anschließend das gesamte Staging-Verzeichnis.
				exit 1
			fi
			;;
		esac
	fi
	# Das kurze Intervall hält CPU-Last niedrig und reagiert trotzdem schnell.
	sleep 0.25
done

# Ein Lauf ohne Done-Status gilt auch bei vorhandenen Teilbildern als fehlgeschlagen.
if [ "$last" != "__done__" ]; then
	echo "✗ Screenshot-Tour ist nicht innerhalb des Zeitlimits beendet worden." >&2
	# Die bestehende Galerie bleibt durch Staging unverändert.
	exit 1
fi
# Soll- und Ist-Anzahl müssen vor jeder Veröffentlichung exakt übereinstimmen.
if [ "$expected" -le 0 ] || [ "$count" -ne "$expected" ]; then
	# Die Meldung zeigt beide Werte für eine schnelle Diagnose.
	echo "✗ Erwartet waren $expected Screenshots, aufgenommen wurden $count." >&2
	# Eine unvollständige Tour ersetzt niemals vorhandene Bilder.
	exit 1
fi

# Jedes erfolgreich aufgenommene PNG wird auf eine einheitliche Breite skaliert.
for file in "$STAGING"/*.png; do
	# Sips erhält das Seitenverhältnis und berechnet die passende Höhe automatisch.
	sips --resampleWidth 480 "$file" >/dev/null
done

# Erst eine vollständig erfolgreiche Tour darf die bestehende Galerie ersetzen.
# Alte generierte PNG-Dateien werden entfernt, damit deaktivierte Screens verschwinden.
find "$OUT" -type f -name '*.png' -delete
# Die fertigen Staging-Dateien werden atomnah in die Galerie verschoben.
find "$STAGING" -maxdepth 1 -type f -name '*.png' -exec mv {} "$OUT"/ \;

# Die Abschlussmeldung nennt Anzahl und absoluten Zielpfad.
echo "▶ $count fam-Screenshots aktualisiert: $OUT"
