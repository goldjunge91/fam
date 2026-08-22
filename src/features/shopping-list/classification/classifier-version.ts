/**
 * Version der automatischen Klassifikationspipeline (OFF-Tag-Regeln,
 * Namens-Fallback-Regeln, Normalisierung, Konfliktauflösung).
 *
 * Jede semantische Änderung an einem dieser Bestandteile erhöht diese
 * Konstante. Gespeicherte `category_classifier_version`-Snapshots an
 * Einkaufslisten-, Historien- oder Bestandseinträgen bleiben dadurch stabil
 * nachvollziehbar, auch wenn sich die Regeln später ändern — siehe
 * `docs/issue#223_V2.md` Abschnitt 3 und 18 ("Stabile Snapshots").
 */
export const CLASSIFIER_VERSION = '1';
