#!/usr/bin/env bash
# Kopiert Testbilder in den fam-App-Container oder importiert sie in Fotos.
set -euo pipefail

BUNDLE="com.goldjunge91.fam1"
DEVICE="booted"
SOURCE=""
PHOTOS=false

usage() {
	cat <<'EOF'
Verwendung:
  bun run simulator:testbilder -- [Optionen] <Datei-oder-Ordner>

Optionen:
  --device <UDID>  Ziel-iOS-Simulator (Standard: booted)
  --photos         Bilder in die Fotos-Mediathek importieren
  --no-photos      Bilder in Documents/testbilder der fam-App kopieren (Standard)
  -h, --help       Diese Hilfe anzeigen

Beispiele:
  bun run simulator:testbilder -- --device 4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D testbilder/
  bun run simulator:testbilder -- --device 4B293FA5-24E8-4BF4-8295-3EF2D6C50F7D --photos testbilder/
  bun run simulator:testbilder -- --photos testbilder/IMG_4218.jpeg
EOF
}

fail() {
	echo "✗ $*" >&2
	exit 1
}

is_image() {
	case "${1##*.}" in
	jpg|jpeg|png|heic|heif|JPG|JPEG|PNG|HEIC|HEIF) return 0 ;;
	*) return 1 ;;
	esac
}

while [ "$#" -gt 0 ]; do
	case "$1" in
	--device)
		[ "$#" -ge 2 ] || fail "--device benötigt eine UDID."
		DEVICE="$2"
		shift 2
		;;
	--photos)
		PHOTOS=true
		shift
		;;
	--no-photos)
		PHOTOS=false
		shift
		;;
	-h|--help)
		usage
		exit 0
		;;
	--*)
		fail "Unbekannte Option: $1"
		;;
	*)
		[ -z "$SOURCE" ] || fail "Bitte genau eine Datei oder einen Ordner angeben."
		SOURCE="$1"
		shift
		;;
	esac
done

[ -n "$SOURCE" ] || { usage >&2; exit 2; }
[ -e "$SOURCE" ] || fail "Quelle nicht gefunden: $SOURCE"
command -v xcrun >/dev/null 2>&1 || fail "xcrun wurde nicht gefunden. Installiere Xcode bzw. die Xcode Command Line Tools."

if [ "$DEVICE" = "booted" ]; then
	if ! xcrun simctl list devices booted | grep -q '(Booted)'; then
		fail "Kein booteter iOS-Simulator gefunden."
	fi
else
	if ! xcrun simctl list devices booted | grep -Fq "($DEVICE) (Booted)"; then
		fail "Simulator $DEVICE ist nicht booted oder wurde nicht gefunden."
	fi
fi

FILES=()
if [ -d "$SOURCE" ]; then
	shopt -s nullglob
	for candidate in "$SOURCE"/*; do
		if [ -f "$candidate" ] && is_image "$candidate"; then
			FILES+=("$candidate")
		fi
	done
else
	is_image "$SOURCE" || fail "Keine unterstützte Bilddatei: $SOURCE"
	FILES+=("$SOURCE")
fi

[ "${#FILES[@]}" -gt 0 ] || fail "Keine Bilddateien in $SOURCE gefunden."

if [ "$PHOTOS" = true ]; then
	xcrun simctl addmedia "$DEVICE" "${FILES[@]}"
	echo "▶ ${#FILES[@]} Bild(er) in Fotos auf $DEVICE importiert."
	exit 0
fi

APP_CONTAINER="$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data 2>/dev/null)" || \
	fail "fam ($BUNDLE) ist auf $DEVICE nicht installiert. Für --no-photos wird der App-Container benötigt."

TARGET_DIR="$APP_CONTAINER/Documents/testbilder"
mkdir -p "$TARGET_DIR"
for file in "${FILES[@]}"; do
	cp "$file" "$TARGET_DIR/$(basename "$file")"
done

echo "▶ ${#FILES[@]} Bild(er) nach $TARGET_DIR kopiert (nicht in Fotos)."
