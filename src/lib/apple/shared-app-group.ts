/** Gemeinsame iOS-Grenze für Haupt-App und native Erweiterungen. */
export const FAM_APP_GROUP = 'group.com.goldjunge91.fam1';

/** Apple-Team-ID; deckt die Keychain-Gruppen im Provisioning-Profil ab. */
export const FAM_TEAM_ID = 'SW8RP7PA3W';

/**
 * Keychain-Access-Group des SQLCipher-Schlüssels.
 *
 * Bewusst NICHT die App-Group: `keychain-access-groups` im
 * Provisioning-Profil lautet `SW8RP7PA3W.*` und deckt damit Suffixe unter der
 * Team-ID — nicht die `group.*`-App-Group. Apple entfernt beim Signieren jedes
 * Entitlement, das das Profil nicht abdeckt; mit der App-Group als
 * Keychain-Gruppe blieb die generierte `.xcent` leer und die Siri-Extension
 * konnte den Schlüssel nicht lesen (SQLITE_NOTADB, "SQLite prepare").
 *
 * expo-secure-store reicht `accessGroup` unverändert an die Keychain-API
 * durch, deshalb muss hier der vollständige Name mit Team-ID stehen.
 */
export const FAM_KEYCHAIN_ACCESS_GROUP = `${FAM_TEAM_ID}.com.goldjunge91.fam1`;

/** Kleine, nicht geheime Auswahl des aktiven Haushalts für Siri. */
export const FAM_SIRI_CONTEXT_FILE = 'fam-siri-context-v1.json';
