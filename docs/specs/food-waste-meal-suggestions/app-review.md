# Spec: Feature Chef-Koch: App-Anzeige und Cook-Review

## Objective

Der Nutzer soll im neuen Full-Screen-Feature `Chef-Koch` mit einem freundlichen
Geist-/Genie-Avatar sprechen und aus dem autoritativen Haushaltsbestand bis zu
drei verständliche Rezeptvorschläge auswählen können.
Die Anzeige macht Quelle, verwendete Mengen und fehlende Einkaufsartikel
sichtbar. „Kochen“ öffnet immer zuerst ein
Bestands-Review. Erst „Gekocht bestätigen“ darf den bestehenden atomaren
Verbrauchs- und Outbox-Pfad auslösen.

## Tech Stack

- Expo SDK 57, React Native 0.86, React 19.2
- Expo Router für Route-Adapter unter `src/app`
- React Query für `useRecipeSuggestions` und die bestätigte Mutation
- Zod-/TypeScript-Verträge aus `src/features/recipes/domain`
- ThemeProvider, Theme-Tokens und `src/constants/ui.tsx` für semantische UI

## Commands

- Tests: `bun run test <gezielte-datei>`
- Typecheck: `bun run typecheck`
- Format/Lint: `bun run check`
- DB: deklarative Schemas unter `supabase/schemas`; Migrationen werden mit
  `supabase db schema declarative sync` erzeugt und anschließend lokal geprüft

## Project Structure

- `src/features/chef-koch/` enthält das neue Feature mit Screen, Komponenten,
  Hook-Adaptern und Tests
- `src/app/chef-koch.tsx` enthält ausschließlich den Expo-Router-Adapter
- `src/features/recipes/domain/` enthält reine Review-/Validierungslogik
- `src/features/recipes/data/` enthält React-Query-Hooks und Gateway-Aufruf
- `docs/mockups_v2/rezepte/` enthält den statischen Chef-Koch-UI-Mockup

## Code Style

```tsx
<Button
  label="Gekocht bestätigen"
  loading={confirmMutation.isPending}
  disabled={!canConfirm}
  onPress={confirmCooked}
/>
```

Komponenten zeigen nur validierte Domain-Daten. Sie ersetzen keine Inventar-ID,
rechnen keine unbekannten Lebensmittel zu und rufen keine Mutation beim Öffnen
oder Bearbeiten auf. Aktionen tragen verständliche Accessibility-Rollen und
Zustände.

## Testing Strategy

- Domain-Tests prüfen Review-Erstellung, Mengenänderung, Abwahl und
  `pending_confirmation`.
- Hook-Tests prüfen Gateway-Parameter, Read-only-Verhalten und die einzige
  Mutation nach Bestätigung.
- UI-Tests prüfen loading, Fehler, leeren Einkaufslistenfall, Quellenlabels,
  fehlende Artikel, Review-Interaktion und bestätigte Erfolg-/Fehlerzustände.
- Mutationstests behalten die bereits geprüften atomaren Stale-/Deleted- und
  Haushaltsgrenzen bei.
- Datenbanktests prüfen die deklarativen Wissensbasis-Schemas, RLS, Grants und
  Provenienzregeln. Der offizielle lokale pgTAP-Lauf benötigt die laufende
  Docker-Desktop-Umgebung.

## Boundaries

- Always: Vorschläge und Rezept speichern bleiben read-only; nur die bestätigte
  Review darf den Verbrauchspfad aufrufen.
- Ask first: neue Datenbankfelder, neue Mutationen, Änderungen am Structured-
  Output-Vertrag oder neue Design-Tokens.
- Never: Modell-IDs reparieren, Bestand aus Freitext ableiten, Allergien im UI
  entscheiden oder Bestandsänderungen beim Start von „Kochen“ ausführen.

## Success Criteria

- Vorschlagsanzeige rendert 1–3 Vorschläge mit Titel, Zutaten, Mengen, Quelle
  und fehlenden Einkaufsartikeln.
- Katalog-/Vorlagenvorschläge und neu formulierte Vorschläge sind unterscheidbar.
- „Kochen“ öffnet den Review; Mengen können geändert und Einträge abgewählt
  werden.
- Öffnen, Bearbeiten und Speichern erzeugen keinen Bestands-/Outbox-Aufruf.
- Nur „Gekocht bestätigen“ bestätigt den Review und delegiert an die vorhandene
  atomare Mutation.
- Fehler bei stale/deleted Bestand, falschem Haushalt oder Übermenge bleiben
  fail-closed und zeigen einen retrybaren Zustand.

## Abnahme- und Betriebsstatus

- Das Full-Screen-Dialoglayout und die Geist-/Genie-Avatar-Darstellung sind
  ausgewählt und umgesetzt.
- Das Feature besitzt den Full-Screen-Route-Einstieg `/chef-koch`; der Avatar
  spricht statusabhängig durch Vorschlags- und Review-Zustände.
- Die deklarativen Allergen-Schemas, Seed-Daten und die erzeugte Migration sind
  im Worktree vorhanden. Die TypeScript-Datenbanktypen sind synchronisiert.
- Der offizielle lokale pgTAP-Lauf ist abgeschlossen: 26 Dateien und 438/438
  Assertions bestanden.
- Der fokussierte UI-/Hook-Lauf ist mit 30/30 Tests bestanden; der
  AI-Gateway-Lauf mit 54/54 Tests.
