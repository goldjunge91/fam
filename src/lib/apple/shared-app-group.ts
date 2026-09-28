/** Gemeinsame iOS-Grenze für Haupt-App und native Erweiterungen. */
export const FAM_APP_GROUP = 'group.com.goldjunge91.fam1';

/** Der SQLCipher-Schlüssel wird ausschließlich über diese Keychain-Gruppe geteilt. */
export const FAM_KEYCHAIN_ACCESS_GROUP = FAM_APP_GROUP;

/** Kleine, nicht geheime Auswahl des aktiven Haushalts für Siri. */
export const FAM_SIRI_CONTEXT_FILE = 'fam-siri-context-v1.json';
