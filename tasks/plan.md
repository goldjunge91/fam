# Implementation Plan: Kanonische Farb-Tokens und Glass-UI

## Overview

Die Farb- und UI-Owner werden schrittweise auf eine eindeutige kanonische
Semantik ausgerichtet. Legacy-Palettenaliase werden nach vollständiger
Verbraucherprüfung auf kanonische Rollen migriert oder entfernt.
Android ist ausdrücklich nicht Teil dieses Vorhabens.

Tasks werden in Beads verfolgt. Der Produktionscode bleibt unverändert, bis die
kanonische Farbzuordnung und der Alias-Lifecycle gemeinsam bestätigt sind.

## Aktueller Befund

- `src/constants/ui.tsx` enthält keine eigenen Hex-Farben.
- `surfaceStyles`, `cardStyles`, `textToneStyles` und `TEXT_TONE` bilden teils
  dieselben kanonischen Theme-Rollen mehrfach ab.
- Die eigentliche Legacy-Alias-Schicht liegt in
  `src/components/theme/index.ts` (`bg`, `surface`, `textMuted`, `basil`,
  `carrot` usw.).
- Domain-Accent-Keys wie `pantry`, `nourish` und `grocery` sind eine eigene,
  weiterhin zulässige Semantik. Ihre Rezepte bleiben, verlieren aber die
  Waivy-Palettenabhängigkeit.
- UI-APIs wie `Surface tone="surface"` und `Txt tone="secondary"` bleiben als
  Komponenten-Semantik erhalten, auch wenn sie intern kanonische Rollen nutzen.
- Die produktive Glass-API bleibt native; Tokens und Unistyles besitzen
  Geometrie, Fallback-Fläche, Zustände und Schatten.

## Bestätigte Löschentscheidungen

- `textFaint` wird entfernt; es entsteht kein `textTertiary` als Ersatz.
- Die Domain-Accent-Keys (`pantry`, `grocery`, `nourish`, `ai-chef`, `cheap`,
  `saved`, `explore`, `protein`, `carbs`, `fat`, `fiber`, `water`) bleiben als
  Domain-Semantik bestehen. `makeAccent()` verwendet dafür nur kanonische
  Fam-Tokens.
- Die Waivy-Palette und ihre Aliasfamilie (`basil`, `carrot`, `butter`,
  `grape`, `teal`, `sky`, `pink`, `tomato`, `oat` sowie zugehörige
  `*Tint`, `*Shadow` und `*Soft`-Namen) werden entfernt.
- Eigene kanonische Fam-Tokens wie `shadowCard`, `shadowSheet`, `premium*`,
  `speedDial*` und `scrim` bleiben erhalten, sofern die Verbraucherprüfung
  keinen Waivy-Altbestand nachweist.

## Architekturentscheidungen

1. Kanonische Farbrollen bleiben im Theme-Owner und werden von Unistyles und
   `useTheme()` gemeinsam verwendet.
2. Legacy-Aliase werden zuerst verbraucherfrei auf kanonische Rollen migriert
   und anschließend entfernt.
3. Domain-Accent-Keys bleiben von Palette-Aliasen getrennt und werden durch
   `makeAccent()` auf kanonische Rollen abgebildet.
4. Native `GlassView`-Props und Reduce-Transparency-Fallbacks bleiben an der
   Native-UI-Grenze.

## Task List

### Phase 1: Kontext und Entscheidung

- [x] `fam-d2af.5` Farb-Alias-Verbraucher vollständig inventarisieren
- [x] `fam-d2af.1` Kanonische Farbrollen und Alias-Lifecycle festlegen

### Checkpoint: Farbvertrag

- [x] Jeder Legacy-Alias hat Verbraucher, Zieltoken oder begründete Ausnahme
- [x] Domain-Accent-Keys sind separat klassifiziert
- [x] Maintainer bestätigt die kanonische Namensliste

### Phase 2: Shared Owner

- [x] `fam-d2af.3` `ui.tsx` auf kanonische Farbsemantik konsolidieren

### Phase 3: Glass-UI

- [ ] `fam-d2af.2` GlassCard und InventoryIconButton auf Tokens und Unistyles ausrichten

### Checkpoint: Abschluss

- [x] Keine unbeabsichtigten Legacy-Verbraucher verbleiben
- [x] Biome, Typecheck und fokussierte Verhaltenstests sind grün
- [ ] Native Sicht-/Interaktionsprüfung für die betroffenen Glass-Flächen ist durchgeführt

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Legacy-Alias wird vor Migration gelöscht | Laufzeit-/TypeScript-Brüche | Erst Verbraucher-Inventar, dann gestufte Migration |
| Domain-Accent und Palette werden vermischt | Verlust fachlicher Farbbedeutungen | `makeAccent()` und Domain-Keys separat behandeln |
| GlassView wird wie eine normale RN-Fläche abstrahiert | Plattform-/Accessibility-Regression | Native Glass-Grenze und Fallback beibehalten |
| `ui.tsx`-Mapping wird zu aggressiv vereinfacht | Kontrast- oder Variant-Verhalten ändert sich | Bestehende UI-Tests als Verhaltensvertrag nutzen |

## Zielmodell für den gemeinsamen Durchgang

Die kanonische Palette verwendet Bedeutungen wie `background`,
`backgroundElement`, `backgroundSoft`, `text`, `textSecondary`, `border`,
`accent`, `onAccent`, `success`, `warning` und `danger`. Die Alias-Verbraucher
werden jetzt einzeln auf diese Rollen oder auf eine ausdrücklich begründete
fachliche Ausnahme abgebildet. Domain-Accent-Keys bleiben erhalten, aber ihre
`main`, `tint`, `shadow` und `on`-Werte kommen aus dieser kanonischen Palette.
