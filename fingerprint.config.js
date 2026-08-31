const { SourceSkips } = require('expo/fingerprint');

/** @type {import('expo/fingerprint').Config} */
const config = {
  fileHookTransform(source, chunk) {
    // Dev-only seed commands cannot change the native binary.
    if (
      source.type !== 'contents' ||
      source.id !== 'packageJson:scripts' ||
      typeof chunk !== 'string'
    ) {
      return chunk;
    }

    const scripts = JSON.parse(chunk);
    for (const name of Object.keys(scripts)) {
      if (name.startsWith('seed:')) delete scripts[name];
    }
    return JSON.stringify(scripts);
  },

  // Wird automatisch von @expo/fingerprint gelesen — nicht nur von
  // scripts/native-build.ts, sondern auch von 'expo run:ios'/'expo run:android'
  // (Build-Cache-Provider-Lookup) und 'eas build'. Ein Skip hier gilt also
  // konsistent für Lock, Cache-Key und Diff-Tool, statt zu divergieren.
  //
  // Nur Felder, die nachweislich KEINEN nativen Compile-Output beeinflussen —
  // siehe docs/native-fingerprint-drift-debugging.md für die Begründung jedes
  // einzelnen Flags. Bewusst NICHT dabei: ExpoConfigAssets (Icon/Splash sind
  // nativ relevant), ExpoConfigAndroidPackage/IosBundleIdentifier/Schemes
  // (native Identität), ExpoConfigAll und PackageJsonScriptsAll (zu breit,
  // würde z. B. einen patch-package-postinstall-Hook unsichtbar machen).
  sourceSkips:
    SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun | // Default von @expo/fingerprint, explizit gehalten
    SourceSkips.ExpoConfigVersions | // version/buildNumber/versionCode ändern kein kompiliertes Verhalten
    SourceSkips.ExpoConfigNames | // Anzeigename/Beschreibung, nur Plist/Manifest-Metadaten
    SourceSkips.ExpoConfigEASProject | // EAS-Projekt-ID/Owner, reine Cloud-Metadaten
    SourceSkips.ExpoConfigExtraSection, // "extra"-Feld ist nur zur Laufzeit über expo-constants sichtbar, nicht kompiliert
};

module.exports = config;
