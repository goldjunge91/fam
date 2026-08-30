const { withGradleProperties } = require('expo/config-plugins');

/**
 * Lokale Android-Builds sind ohne diese Werte teurer als nötig (Fastpath-Plan,
 * docs/native-fingerprint-fastpath-plan.html, Phase 3): kein Gradle-Build-Cache,
 * und 2 GB Heap sind auf einer Apple-Silicon-Maschine ein künstlicher Engpass.
 * Als Config-Plugin statt als direkte Bearbeitung von android/gradle.properties,
 * weil `expo prebuild --clean` diese Datei bei jedem Rebuild neu generiert
 * (siehe B8 im Plan) — nur ein Plugin überlebt das.
 *
 * reactNativeArchitectures bleibt hier bewusst unverändert: Release-Builds
 * brauchen weiterhin alle vier ABIs. Die Reduktion auf eine ABI für den Inner
 * Loop passiert stattdessen pro Lauf über ORG_GRADLE_PROJECT_* in
 * scripts/native-build.ts (native:dev), nicht global.
 *
 * org.gradle.configuration-cache ist bewusst nicht gesetzt — die RN-Plugin-
 * Kompatibilität ist laut Plan noch nicht verifiziert, nicht einfach annehmen.
 */
function setProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === 'property' && item.key === key);
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

module.exports = function withAndroidGradleTuning(config) {
  return withGradleProperties(config, (config) => {
    setProperty(config.modResults, 'org.gradle.caching', 'true');
    setProperty(config.modResults, 'org.gradle.jvmargs', '-Xmx6144m -XX:MaxMetaspaceSize=1024m');
    return config;
  });
};
