# Vertrag: Accessibility und Zustände

## Zweck und Zuständigkeit

Touch, Screenreader, größere Schrift und reduzierte Bewegung bleiben verständlich
bedienbar. Gemeinsame selected-, focused-, pressed-, disabled- und loading-Rezepte
gehören nach `ui.tsx`. Höhere Komponenten verwalten Verhalten und Accessibility-Metadaten.
Domänen entscheiden über Datenzustände; sie erfinden keine neue gemeinsame Darstellung.

## Interaktionsanforderungen

- Verständlicher Name und passende Rolle für jede Aktion; dekorative Icons erzeugen
  keinen eigenen unnötigen Fokus.
- `selected`, `checked`, `disabled`, `busy` und `expanded` werden entsprechend
  der tatsächlichen Bedeutung und des Zustands gemeldet.
- Normale eigenständige Aktionen haben mindestens 44 × 44 logische Einheiten
  tatsächlichen Trefferbereich ohne abgeschnittene oder überlappende Ziele.
- Loading/Disabled verhindern Aktivierung und Haptik. Ein Retry wiederholt eine
  fehlgeschlagene Abfrage, nicht automatisch eine bereits ausgelöste Mutation.
- Status ist zusätzlich über Text, Symbol oder Form erkennbar. Screenreader-Metadaten
  ersetzen keine verständliche sichtbare Zustandsdarstellung.
- Fokusfolge bleibt sinnvoll; Eingabefehler sind dem Feld zugänglich zugeordnet.
  Web unterstützt Tastaturaktivierung und sichtbaren Fokus. Sheets müssen Fokus
  sinnvoll übernehmen und nach dem Schließen an einen geeigneten Ort zurückgeben.
- Reduced Motion verhindert federndes Überschwingen und Skalierung. Ruhiges oder
  sofortiges Zustandsfeedback bleibt erhalten. Keine neuen dauerhaften dekorativen
  Pulse-, Shimmer- oder Blur-Animationen.

Der [Farbvertrag](./01-theme-and-colors.md) setzt 4,5:1 für informative Texte auf
unterstützten Flächen und 3:1 für notwendige nichttextliche Zustandsmerkmale/Fokus.
Ausnahmen für deaktivierte Controls, dekorative Konturen und native Darstellung
sind dort beziehungsweise im Integrationsvertrag eingegrenzt.

## Datenzustandsmatrix

| Situation | Darstellung | Bestehender Handlungsweg |
| --- | --- | --- |
| Erstladen ohne Daten | ruhig, zugänglich benannt; für Vorrat/Einkauf statische zur Liste passende Platzhalter | Navigation bleibt möglich |
| Aktualisieren mit Daten | vorhandene Inhalte bleiben sichtbar, dezentes Aktualisierungsfeedback | zulässige lokale Aktionen bleiben nutzbar |
| Erfolgreich geladen und tatsächlich leer | domänenspezifischer Leerzustand | passende vorhandene Hinzufügen-/Erstellen-/Beitrittsaktion |
| Suche oder Filter ohne Treffer | eigener Kein-Treffer-Zustand statt leerem Gesamtbestand | Suche/Filter zurücksetzen |
| Lesefehler ohne Daten | verständlicher Fehler, keine falsche Leermeldung | gezielte Wiederholung |
| Aktualisierungsfehler mit Daten | Daten bleiben sichtbar, erreichbarer Fehler-/Wiederholhinweis | erneut lesen |
| Offline mit lokalen Daten | lokale Inhalte und erlaubte Offline-Aktionen bleiben nutzbar | bestehende Outbox und globaler Sync-Banner |
| Fehlender Haushalt oder fehlende Berechtigung | bestehender Household-/Zugriffszustand | vorhandener zulässiger Beitritts-/Erstellungsweg |

Empty, Error und Loading sind getrennte Zustände. Offline allein ist kein Lesefehler
des lokalen Mirrors. Ein Feature erzeugt keinen zweiten globalen Offline-Banner.
Retries legen keine neuen Daten an; bestehende lokale Mutationen bleiben im
vorhandenen Outbox-Workflow. Technische Rohfehler und sensible Details gehören
nicht in UI-Copy.

Die Auswahl des Zustands bleibt in der Domäne. Ein universeller Async-Screen-Wrapper
ist nicht erforderlich. Der Produkt-`EmptyState` und seine Foundation teilen
Darstellungsregeln. Eine passende bestehende Aktion soll direkt erreichbar sein;
eine optionale Action-Komposition darf keine neue Fachfunktion erfinden. Native
Spezialladezustände müssen nicht in Listenskeletons umgebaut werden. Bestehende
kurzlebige native Busy-Indikatoren dürfen bleiben.

## Beispiel der vorgesehenen Verwendung

```tsx
import { Button } from '@/constants/ui';

<Button
  title="Erneut versuchen"
  accessibilityLabel="Artikelliste erneut laden"
  loading={retrying}
  onPress={retryRead}
/>
```

Ein unlabeled 20-Punkte-Plus, eine rein farbliche Auswahl oder `isLoading ? null`
ohne anderes erkennbares Ladefeedback verletzt den jeweiligen Vertrag.

## Verbindliche Prüfmatrix

Die vollständige Plattformgleichwertigkeit bleibt Ziel der späteren Umsetzung.
Für die dokumentationsgetriebene Korrektur von `fam-6zf.1` ist eine
Android-Geräteprüfung jedoch kein Abschlusskriterium. Eine nicht ausgeführte
Android-Prüfung wird nicht als bestanden behauptet.

| Dimension | Mindestprüfung |
| --- | --- |
| Plattform | iOS- und Android-Dev-Client, sofern die jeweilige Prüfung verfügbar ist; Web-Vorschau separat |
| Theme | System hell/dunkel sowie explizite App-Präferenz gegen das Systemtheme; Wechsel im geöffneten Formular |
| Breite | 320 und 393 logische Einheiten, Tablet-/Webbreite ab 768, Rotation/Resize |
| Schrift | Faktor 1,0 und 2,0; größte angebotene Accessibility-Schrift zusätzlich als bewerteter Grenzfall |
| Eingabe | Fehler + Fokus, Disabled, trailing action, Tastatur, mehrzeilig und Sheet |
| Assistenz | VoiceOver, TalkBack und Web-Tastatur; Name, Rolle, Zustand, Fokusfolge und Aktivierung |
| Bewegung | reale Reduced-Motion-Präferenz an/aus |
| Daten | alle zutreffenden Zustände der Datenzustandsmatrix |

Alle kanonischen Primitive werden in der Referenz in Light/Dark und mit großer
Schrift geprüft. Vorrat, Einkauf und ein Auth-/Bearbeitungsformular durchlaufen
schmal + große Schrift + Dark sowie Tastatur + Fehler, soweit zutreffend.
Weitere geänderte Verbraucher erhalten gezielte Prüfungen ihrer Änderungen;
eine vollständige Kreuzkombination jedes Screens ist nicht erforderlich.

## Aussagekraft der Nachweise

Gezielte RNTL-Tests belegen Namen, Rollen, States, Callback-Anzahl, Blockierung,
Fehlerausgabe und relevante Produktszenarien. Tokenprüfungen belegen definierte
Kontrastpaare. Kleine zentrale Styleprüfungen sind zulässig, beweisen aber keinen
realen Touchbereich oder Umbruch.

Native Integrationsgrenzen, echte Trefferbereiche, Systemschrift, Screenreader und
Motion benötigen die jeweilige Plattform. Web-Screenshots ersetzen dies nicht.
Nicht verfügbare Geräte oder Testdaten werden als fehlender Nachweis benannt,
niemals als bestanden. Keine vollständige Testsuite, pauschale Coverage-Quote oder
neue Screenshot-Infrastruktur allein zur Erfüllung dieses Vertrags.

Die [Spec](../../specs/ui-consolidation/SPEC.md) enthält konkrete bestehende
Testbefehle und übergreifende Abnahmekriterien. Die Referenzseite zeigt echte
Produktkomponenten; ein positives Beispiel dort ist noch kein Nachweis für jeden
Produktverbraucher.
