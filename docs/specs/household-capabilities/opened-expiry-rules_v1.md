# Spec: Berechnete Haltbarkeit geöffneter Produkte

## Objective

Dieses Dokument beschreibt die im EverShelf-Code vorhandene Regelbasis für die
berechnete Haltbarkeit nach dem Öffnen. Es ist eine Referenz für die spätere
Umsetzung in Fam und beschreibt noch keine implementierte Fam-Funktion.

Die Berechnung liefert eine Anzahl von Tagen. Es gibt keinen gespeicherten
Wert `estimated` und keinen separaten Datumstyp für diese Berechnung.

## Datenmodell

```text
opened_at          Zeitpunkt der Öffnung
expiry_date        konkretes Ablaufdatum (DATE), sofern vorhanden
expiry_user_set    0 oder 1; 1 bedeutet manuell gesetzt
vacuum_sealed      0 oder 1
```

Das berechnete Öffnungsintervall wird nicht als eigene Spalte gespeichert. Die
effektive Haltbarkeit wird aus `opened_at` und der berechneten Tageszahl
abgeleitet.

## Berechnungsregeln

Die Regeln werden in der folgenden Reihenfolge geprüft. Der erste passende
Treffer gewinnt.

### Ortsunabhängige Regeln

| Produktgruppe | Tage |
|---|---:|
| Salz, Zucker, Honig, Essig, Bicarbonat, Backtriebmittel | 9999 |
| Spirituosen | 730 |
| Aromen, Extrakte, Vanille, Farbstoffe | 730 |
| Tee und Kräutertee | 730 |
| Kaffee, Öl | 365 |
| Sojasauce, Paniermehl, Panko | 90 |

### Tiefkühler (`freezer`)

| Produktgruppe | Tage |
|---|---:|
| Brot, Gebäck | 90 |
| Gemüse, Obst | 270 |
| Frische Pasta, Gnocchi, Ravioli | 60 |
| Eis und Sorbet | 365 |
| Fisch und Meeresfrüchte | 120 |
| Geflügel | 270 |
| Rotes Fleisch | 365 |
| Hackfleisch | 120 |
| Wurst und gepökeltes Fleisch | 60 |
| Butter | 270 |
| Sahne, Käse, Mozzarella, Ricotta | 90 |
| Brühe, Suppen, Saucen | 180 |
| Fallback | 180 |

### Speisekammer (`dispensa` oder anderer Nicht-Kühlschrank-Ort)

| Produktgruppe | Tage |
|---|---:|
| Kekse, Müsli, Cerealien | 60 |
| Marmelade, Nuss-Nougat-Creme, Schokolade | 90 |
| Brot | 4 |
| Tomatensauce | 5 |
| Sahne | 3 |
| Joghurt | 2 |
| Milch | 1 |
| Käse | 2 |
| Kartoffeln, Zwiebeln, Knoblauch, Lauch | 30 |
| Karotten | 14 |
| Fallback | 60 |

### Kühlschrank (`frigo`)

| Produktgruppe | Tage |
|---|---:|
| Frische Milch | 3 |
| UHT-Milch und allgemeine Milch | 7 |
| Joghurt | 5 |
| Mozzarella, Burrata | 3 |
| Frischkäse | 7 |
| Hartkäse | 28 |
| Frischer Käse, Ricotta, Mascarpone | 5 |
| Allgemeiner Käse | 10 |
| Butter | 30 |
| Sahne | 4 |
| Kochschinken, Mortadella, Würstchen | 5 |
| Rohschinken, Salami, Bresaola, Speck | 7 |
| Fleisch | 2 |
| Frischer Fisch | 2 |
| Passata, Pelati, Tomatensauce | 5 |
| Fertige Reis-, Pasta- oder Getreidesalate | 7 |
| Salat, Rucola, Spinat | 4 |
| Saft | 3 |
| Bier | 3 |
| Wein | 5 |
| Geöffneter Dosenfisch | 4 |
| Beeren | 4 |
| Avocado | 3 |
| Äpfel, Birnen, Kiwi, Trauben und ähnliches Obst | 5 |
| Zitrusfrüchte | 7 |
| Zucchini, Paprika, Tomaten | 5 |
| Brokkoli, Blumenkohl | 4 |
| Zwiebeln, Lauch | 6 |
| Karotten | 7 |
| Kartoffeln | 4 |
| Knoblauch | 14 |
| Piadina und ähnliche Fladenbrote | 2 |
| Verpacktes Schnittbrot | 4 |
| Fallback | 5 |

## Effektives Datum

```text
effektives Ablaufdatum = opened_at + Regelwert in Tagen
```

Das bestehende `expiry_date` bleibt als konkretes Datum erhalten. Ein
manuell gesetztes Datum wird durch automatische Neuberechnung nicht ersetzt,
wenn `expiry_user_set = 1` gesetzt ist.

Bei vakuumierten Produkten wird der Regelwert zusätzlich über
`getVacuumExpiryDays()` verlängert. Auch diese Verlängerung ist eine
Berechnung und kein eigener Haltbarkeitstyp.

## Code-Belege

- `C:/GIT/ai-mobileapp/EverShelf/api/database.php:463`
- `C:/GIT/ai-mobileapp/EverShelf/assets/js/app.js:2275`
- `C:/GIT/ai-mobileapp/EverShelf/api/database.php:227`

## Testing Strategy

Für eine spätere Fam-Implementierung sind tabellarische Unit-Tests für jede
Produktgruppe, jeden Lagerort, den Fallback und die Vakuumverlängerung nötig.
Zusätzlich muss geprüft werden, dass `expiry_user_set = 1` nicht überschrieben
wird.

## Boundaries

- Always: Berechnung als Tageszahl behandeln und den ersten passenden Treffer
  verwenden.
- Ask first: Neue Produktregeln, neue Lagerorte oder Änderungen am Datenmodell.
- Never: `best_before`, `use_by` oder `estimated` als nicht belegte Felder
  ausgeben.

## Festgelegte Entscheidungen für Fam

- Produktbezeichnungen und Kategorien werden auf Deutsch oder Englisch
  geführt, nicht auf Italienisch.
- Die berechnete Haltbarkeit wird nur angezeigt und nicht als eigener Wert
  gespeichert.
- Die Tageswerte werden vor der Fam-Umsetzung gegen aktuelle fachliche
  Empfehlungen zur Lebensmittelsicherheit geprüft und bei Bedarf angepasst.
