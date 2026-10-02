/** Gemeinsame iOS-Grenze für Haupt-App und native Erweiterungen. */
export const FAM_APP_GROUP = 'group.com.goldjunge91.fam1';

/** Apple-Team-ID; im Store-Provisioning-Profil für Keychain-Gruppen freigegeben. */
export const FAM_TEAM_ID = 'SW8RP7PA3W';

/** Keychain-Gruppe getrennt von der App-Group-Kennung. */
export const FAM_KEYCHAIN_ACCESS_GROUP = `${FAM_TEAM_ID}.com.goldjunge91.fam1`;

/** Kleine, nicht geheime Auswahl des aktiven Haushalts für Siri. */
export const FAM_SIRI_CONTEXT_FILE = 'fam-siri-context-v1.json';
