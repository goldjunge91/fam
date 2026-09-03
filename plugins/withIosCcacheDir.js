const { execSync } = require('child_process');
const { existsSync, readFileSync, writeFileSync, chmodSync } = require('fs');
const os = require('os');
const path = require('path');
const { withXcodeProject, withPodfile, withDangerousMod } = require('expo/config-plugins');

/**
 * ccache für iOS-Builds — Root Cause zweier gescheiterter Anläufe, siehe
 * docs/native-fingerprint-drift-debugging.md ("ccache zeigte 0 Hits"):
 *
 * 1. react-native/scripts/xcode/ccache-clang.sh liest CCACHE_BINARY/
 *    CCACHE_DIR aus der Prozessumgebung (`exec $CCACHE_BINARY clang "$@"`).
 * 2. Xcodes Build-System reicht selbst gesetzte Build-Settings NICHT als
 *    Env-Vars an die einzelnen "Compile Sources"-Subprozesse durch — nur CC/
 *    CXX selbst werden von Xcode interpretiert (als "welche Datei ausführen"),
 *    alles andere (auch CCACHE_BINARY, obwohl offizielles RN-Feature!) kam
 *    dort nachweislich leer an (per Debug-Wrapper-Skript verifiziert: echter
 *    xcodebuild-Lauf, `CCACHE_BINARY=[] CCACHE_DIR=[]`).
 *
 * Ergebnis: RNs eigener ccache-Mechanismus lief in diesem Projekt vermutlich
 * noch nie wirklich, unabhängig von allem vorherigen USE_CCACHE-Wiring.
 *
 * Fix: eigene Wrapper-Skripte in ios/, die CCACHE_DIR/CCACHE_BINARY nicht aus
 * der Umgebung lesen, sondern zur Prebuild-Zeit fest hineinschreiben. CC/CXX
 * (die Xcode selbst interpretiert, das funktioniert nachweislich) zeigen auf
 * diese Skripte statt auf RNs env-var-abhängige Variante.
 */
function resolveCcacheDir() {
  if (process.env.CCACHE_DIR) return process.env.CCACHE_DIR;
  const configPath = path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
    'ccache/ccache.conf',
  );
  if (!existsSync(configPath)) return undefined;
  const match = readFileSync(configPath, 'utf8').match(/^\s*cache_dir\s*=\s*(.+?)\s*$/mu);
  return match?.[1];
}

function resolveCcacheBinary() {
  if (process.env.CCACHE_BINARY) return process.env.CCACHE_BINARY;
  try {
    return execSync('command -v ccache', { encoding: 'utf8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

const WRAPPER_CLANG = '.ccache-wrapper-clang.sh';
const WRAPPER_CLANGPP = '.ccache-wrapper-clang++.sh';

function wrapperScript(ccacheBinary, ccacheDir, rnCcacheConfPath, compiler) {
  return `#!/bin/sh
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
export CCACHE_DIR="${ccacheDir}"
export CCACHE_CONFIGPATH="${rnCcacheConfPath}"
export CCACHE_BASEDIR="$(_find_basedir)"
exec "${ccacheBinary}" ${compiler} "$@"
`;
}

module.exports = function withIosCcacheDir(config) {
  const ccacheDir = resolveCcacheDir();
  const ccacheBinary = resolveCcacheBinary();
  if (!ccacheDir || !ccacheBinary) return config;

  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const iosDir = config.modRequest.platformProjectRoot;
      const rnCcacheConf = path.join(
        config.modRequest.projectRoot,
        'node_modules/react-native/scripts/xcode/ccache.conf',
      );
      for (const [file, compiler] of [
        [WRAPPER_CLANG, 'clang'],
        [WRAPPER_CLANGPP, 'clang++'],
      ]) {
        const target = path.join(iosDir, file);
        writeFileSync(target, wrapperScript(ccacheBinary, ccacheDir, rnCcacheConf, compiler));
        chmodSync(target, 0o755);
      }
      return config;
    },
  ]);

  // Haupt-Target (fam.xcodeproj): CC/CXX/LD/LDPLUSPLUS zeigen im
  // Standardtemplate bereits auf RNs env-var-abhängigen Wrapper — hier
  // umbiegen auf unsere selbstgenügsamen Skripte.
  config = withXcodeProject(config, (config) => {
    const buildConfigs = config.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(buildConfigs)) {
      if (entry && typeof entry === 'object' && entry.buildSettings) {
        entry.buildSettings.CC = `"$(SRCROOT)/${WRAPPER_CLANG}"`;
        entry.buildSettings.CXX = `"$(SRCROOT)/${WRAPPER_CLANGPP}"`;
        entry.buildSettings.LD = `"$(SRCROOT)/${WRAPPER_CLANG}"`;
        entry.buildSettings.LDPLUSPLUS = `"$(SRCROOT)/${WRAPPER_CLANGPP}"`;
        delete entry.buildSettings.CCACHE_DIR; // wirkungslos, siehe oben — aufräumen
      }
    }
    return config;
  });

  // Pods-Project: react_native_post_install() setzt dort CC/CXX auf denselben
  // env-var-abhängigen Wrapper (ccache_enabled?() muss dafür true sein, siehe
  // USE_CCACHE in scripts/native-build.ts). Direkt danach umbiegen.
  config = withPodfile(config, (config) => {
    if (config.modResults.contents.includes('withIosCcacheDir')) return config; // idempotent
    const callRegex = /(react_native_post_install\(\s*installer,[\s\S]*?\n\s*\))/u;
    if (!callRegex.test(config.modResults.contents)) return config;
    config.modResults.contents = config.modResults.contents.replace(
      callRegex,
      `$1\n\n    # withIosCcacheDir: RNs eigener ccache-Wrapper liest CCACHE_BINARY/DIR aus\n    # der Prozessumgebung, die Xcode nicht an Compile-Sources-Subprozesse\n    # durchreicht (siehe docs/native-fingerprint-drift-debugging.md).\n    installer.pods_project.build_configurations.each do |c|\n      if c.build_settings['CC'].to_s.include?('ccache-clang.sh')\n        c.build_settings['CC'] = File.join(__dir__, '${WRAPPER_CLANG}')\n        c.build_settings['CXX'] = File.join(__dir__, '${WRAPPER_CLANGPP}')\n        c.build_settings['LD'] = File.join(__dir__, '${WRAPPER_CLANG}')\n        c.build_settings['LDPLUSPLUS'] = File.join(__dir__, '${WRAPPER_CLANGPP}')\n      end\n    end\n    installer.pods_project.save`,
    );
    return config;
  });

  config = withPodfile(config, (config) => {
    const marker = 'withIosCcacheDir: disable explicit modules';
    if (config.modResults.contents.includes(marker)) return config;
    const callRegex = /(react_native_post_install\(\s*installer,[\s\S]*?\n\s*\))/u;
    if (!callRegex.test(config.modResults.contents)) return config;
    config.modResults.contents = config.modResults.contents.replace(
      callRegex,
      `$1\n\n    # ${marker}: Xcode 26 cannot use Explicit Modules with a custom compiler launcher.\n    # Without this, Swift loses ExpoSQLite's sqlite3 module and exsqlite3_* is missing.\n    installer.pods_project.targets.each do |target|\n      target.build_configurations.each do |c|\n        c.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'\n      end\n    end`,
    );
    return config;
  });

  return config;
};
