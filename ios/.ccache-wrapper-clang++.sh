#!/bin/sh
# Generiert von plugins/withIosCcacheDir.js bei 'expo prebuild' — nicht von Hand
# editieren, wird beim nächsten Prebuild überschrieben. CCACHE_DIR/BINARY sind
# hier hart einprogrammiert statt env-var-basiert wie
# react-native/scripts/xcode/ccache-clang.sh, weil Xcodes Build-System keine
# custom Build-Settings als Env-Vars an Compile-Sources-Subprozesse durchreicht
# (siehe docs/native-fingerprint-drift-debugging.md).
#
# CCACHE_BASEDIR: ohne das blieben eas-build-local-Läufe (TestFlight) bei 0
# Hits, selbst mit identischem Quellcode — 'eas build --local' kopiert das
# ganze Projekt bei JEDEM Lauf in ein neues Temp-Verzeichnis mit neuer UUID
# (verifiziert: 'bun install' lief unter
# /var/folders/.../eas-build-local-nodejs/<uuid>/build). Ein zur Prebuild-Zeit
# fest einprogrammierter Pfad passt deshalb nie — CCACHE_BASEDIR muss bei
# JEDEM Compiler-Aufruf neu ermittelt werden: wir suchen von $PWD aufwärts
# nach dem nächsten Verzeichnis namens 'ios' und nehmen dessen Elternordner.
# Das funktioniert identisch im normalen Projektverzeichnis wie im
# eas-build-local-Temp-Kopie. Erst ab ccache 4.11
# (github.com/ccache/ccache/pull/1567) schreibt ccache die dafür relevanten
# Flags (-fbuild-session-file, -fmodules-cache-path, -ivfsoverlay) überhaupt
# relativ zu CCACHE_BASEDIR um. Siehe docs/native-fingerprint-drift-debugging.md.
_find_basedir() {
  dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ "$(basename "$dir")" = "ios" ]; then
      dirname "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done
  printf '%s' "$PWD"
}
export CCACHE_DIR="/Volumes/Programme/dev-caches/ccache"
export CCACHE_CONFIGPATH="/Users/marco/Github.tmp/family_app/fam/node_modules/react-native/scripts/xcode/ccache.conf"
export CCACHE_BASEDIR="$(_find_basedir)"
exec "/opt/homebrew/bin/ccache" clang++ "$@"
