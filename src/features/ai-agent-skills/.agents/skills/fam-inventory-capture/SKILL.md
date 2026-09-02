---
name: fam-inventory-capture
description: Extrahiert Lebensmittel aus deutscher natürlicher Sprache als überprüfbares Inventar-Proposal; nutze bei „ich habe diese Lebensmittel“, nicht für Kochvorschläge, Barcode-/Belegimport oder direkte Bestandsänderungen.
---

# Fam: Inventar aus natürlicher Sprache erfassen

Nutze diesen Skill, wenn eine Person Lebensmittel meldet, zum Beispiel „Noch
zwei Paprika, eine halbe Packung Feta und etwas Spinat.“ Das Ergebnis ist immer
ein Vorschlag für eine Review, niemals eine bestätigte Inventaränderung.

## Ablauf

1. Zerlege den deutschen Freitext in einzelne Lebensmittelkandidaten und
   bewahre den jeweiligen Originalbezug in `rawText` und `evidence`.
2. Übernimm explizite Mengen und Einheiten. Unbestimmte Angaben wie „etwas“
   bleiben `null`; erfinde keine Grammzahl, kein Datum und keine
   Sicherheitsfreigabe.
3. Nutze ausschließlich die read-only-Funktionen
   `resolve_product_candidates(name)` und `suggest_storage(name)`.
4. Gib `inventory_capture_proposal.v1` aus. Markiere Unsicherheit über
   `confidence`, `missingFields`, `questions` und `warnings`.
5. Übergib das Proposal an den App-Review-Workflow. Erst die bestätigte
   lokale Domänenmutation darf einen Bestandseintrag und eine Outbox-Operation
   erzeugen.

## Grenzen

- Kein Barcode-Scan, Belegimport, Etikettfoto oder automatische MHD-
  Berechnung.
- Keine Datenbankmutation, kein SQL- oder Service-Role-Tool.
- `perishability` ist ein Kandidat aus Katalogsignalen und darf vom Review
  korrigiert werden.
- `householdId` und `now` kommen aus dem Gateway, nicht aus dem Text.
- Keine privaten Trackingdaten und keine Koch- oder Einkaufslistenplanung.

Lies für das exakte Schema und die Negativbeispiele
[references/contract.md](references/contract.md) und
[references/examples.md](references/examples.md). Die Laufzeitvalidierung liegt
in `src/features/ai-agent-skills/domain/contracts.ts`.