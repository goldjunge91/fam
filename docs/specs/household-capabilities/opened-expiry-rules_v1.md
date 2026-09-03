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

## Vollständige Kategorie-Normalisierung

> Maßgeblich sind die folgenden Code-Muster und Rückgabewerte. Deutsche
> Bezeichnungen in den Kurzfassungen dienen nur der Lesbarkeit und sind keine
> EverShelf-Kategorien.

Die erlaubten normalisierten Kategorien sind:

```text
latticini, carne, pesce, frutta, verdura, pasta, pane, surgelati,
bevande, condimenti, snack, conserve, cereali, igiene, pulizia, altro
```

Wenn die importierte Kategorie leer, unbekannt, `altro`, ein Open-Food-Facts-
Pfad oder eine sonstige externe Bezeichnung ist, wird sie aus dem Produktnamen
erraten. Die Prüfung erfolgt in dieser Reihenfolge:

| Produktname enthält | Normalisierte Kategorie |
|---|---|
| `yogurt`, `latte`, `formagg`, `burro`, `uova`, `mozzarella`, `ricotta`, `grana`, `parmigiano` | `latticini` |
| `pasta`, `spaghetti`, `penne`, `rigatoni`, `riso`, `farro`, `orzo` | `pasta` |
| `piadina`, `pane`, `focaccia`, `grissini`, `cracker`, `brioche`, `toast`, `pangratt` | `pane` |
| `acqua`, `birra`, `vino`, `caffè`, `tè`, `succo`, `cola`, `spumante`, `bevanda` | `bevande` |
| `pomodoro`, `insalata`, `verdura`, `carota`, `zucchina`, `melanzana`, `patata` | `verdura` |
| `mela`, `pera`, `banana`, `arancia`, `limone`, `frutta`, `fragola` | `frutta` |
| `pollo`, `manzo`, `maiale`, `prosciutto`, `salame`, `carne`, `bresaola`, `wurstel` | `carne` |
| `pesce`, `tonno`, `salmone`, `sardine`, `gambero`, `merluzzo` | `pesce` |
| `gelato`, `surgelato`, `frozen` | `surgelati` |
| `olio`, `aceto`, `sale`, `pepe`, `salsa`, `ketchup`, `maionese`, `condimento` | `condimenti` |
| `biscotto`, `cioccolato`, `snack`, `patatine`, `merendine`, `wafer`, `nutella` | `snack` |
| `pelati`, `passata`, `marmellata`, `conserve`, `tonno in scatola` | `conserve` |
| `cereali`, `muesli`, `corn flakes`, `fiocchi` | `cereali` |
| kein Treffer | `altro` |

Quelle: `C:/GIT/ai-mobileapp/EverShelf/api/index.php:5404`.

## Vollständige Öffnungsberechnung

> Dieser Abschnitt bildet die Reihenfolge, Muster und Werte der
> `estimateOpenedExpiryDaysPHP()`-Funktion ab. Es werden keine zusätzlichen
> Produktgruppen oder Haltbarkeitstypen eingeführt.

Die Funktion normalisiert `name`, `category` und `location` auf Kleinbuchstaben
und prüft die folgenden Regeln exakt in dieser Reihenfolge.

### Ortsunabhängig

| Namensmuster | Tage |
|---|---:|
| `sale`, `sel mar`, `salt` (außer Lachs, Salami, Sauce) | 9999 |
| `zucchero`, `sugar` | 9999 |
| `miele` | 9999 |
| `aceto` | 9999 |
| `bicarbonato`, `lievito chimico` | 9999 |
| Spirituosen: `sambuca`, `rum`, `brandy`, `whiskey`, `whisky`, `vodka`, `gin`, `grappa`, `amaro`, `aperol`, `campari`, `limoncello`, `cognac`, `porto`, `marsala`, `baileys`, `amaretto`, `vermouth` | 730 |
| `aroma`, `estratto`, `essenza`, `vanilli`, `colorante` | 730 |
| `tè`, `tea`, `tisana`, `camomilla`, `verbena`, `infuso`, `rooibos` | 730 |
| `caffè`, `coffee`, `nespresso` | 365 |
| `olio` | 365 |
| `salsa di soia`, `soy sauce` | 90 |
| `grattugiat`, `pangratt`, `panko`, `bread crumb`, `briciole di pane` | 90 |

### Tiefkühler (`freezer`)

| Namensmuster | Tage |
|---|---:|
| `pane`, `bread`, `toast`, `brioche`, `ciabatta`, `baguette`, `focaccia`, `pizza base`, `impasto` | 90 |
| `pasta fresca`, `gnocchi`, `ravioli`, `tortellini`, `lasagna fresca` | 60 |
| `croissant`, `cornetto`, `pasticceria`, `dolce`, `torta`, `plumcake`, `muffin`, `biscotti` | 90 |
| `gelato`, `sorbetto`, `ice cream`, `ghiacciolo` | 365 |
| Fisch und Meeresfrüchte (`salmone`, `trota`, `spigola`, `orata`, `tonno`, `merluzzo`, `baccalà`, `nasello`, `sgombro`, `pesce`, `calamaro`, `gambero`, `polpo`, `seppia`, `cozza`, `vongola`, `frutti di mare`, `seafood`) | 120 |
| Geflügel (`pollo`, `tacchino`, `anatra`, `faraona`, `petto di pollo`, `coscia`, `fesa`) | 270 |
| Rotes Fleisch (`manzo`, `vitello`, `agnello`, `maiale`, `lonza`, `costata`, `arrosto`, `fettina`, `bistecca`) | 365 |
| Hackfleisch (`macinato`, `macinata`, `hamburger`, `polpette`, `ragù`) | 120 |
| Wurst und gepökeltes Fleisch (`salsiccia`, `würstel`, `wurstel`, `salame`, `pancetta`, `speck`, `prosciutto`) | 60 |
| `burro` | 270 |
| `panna` | 90 |
| `formaggio`, `mozzarella`, `ricotta` | 90 |
| Gemüse: `piselli`, `fagioli`, `fagiolini`, `spinaci`, `broccoli`, `cavolfiore`, `carote`, `mais`, `edamame`, `verdure miste`, `minestrone` | 270 |
| Obst: `fragole`, `lamponi`, `mirtilli`, `more`, `ciliegia`, `frutta mista`, `frutta` | 270 |
| `brodo`, `zuppa`, `minestra`, `sugo`, `salsa`, `passata` | 180 |
| kein Treffer | 180 |

### Speisekammer (jeder Nicht-Kühlschrank-Ort)

Vor den eigentlichen Speisekammer- und Tiefkühlerblöcken gelten für jeden
Nicht-Kühlschrank-Ort zusätzlich diese Trockenwarenregeln:

| Namensmuster | Tage |
|---|---:|
| `pasta`, `spaghetti`, `penne`, `rigatoni`, `fusilli`, `farfalle`, `tagliatelle`, `linguine`, `bucatini`, `lasagne`, `tortiglioni` | 365 |
| `riso`, `risotto`, `orzo`, `farro`, `quinoa`, `couscous` (außer `pronto`, `cotto`) | 365 |
| `polenta`, `semola`, `maizena`, `amido`, `farina` | 180 |
| `lenticchie`, `ceci`, `fagioli`, `piselli` (außer `cotto`, `vapore`, `scatola`) | 365 |

| Namensmuster | Tage |
|---|---:|
| `biscotti`, `cookies`, `wafer`, `taralli`, `crackers` | 60 |
| `muesli`, `cereali`, `corn flakes`, `granola`, `fiocchi` | 60 |
| `confettura`, `marmellata` | 90 |
| `nutella`, `cioccolato` | 90 |
| `pane` | 4 |
| `salsa di pomodoro`, `salsa pronta` | 5 |
| `panna` | 3 |
| `yogurt`, `yaourt`, `yoghurt` | 2 |
| `latte` | 1 |
| `formaggio` | 2 |
| `patata`, `cipolla`, `aglio`, `scalogno`, `porro` | 30 |
| `carota` | 14 |
| kein Treffer | 60 |

### Kühlschrank (`frigo`)

| Namensmuster | Tage |
|---|---:|
| `latte fresco`, `latte intero`, `latte parzial`, `latte scremato` | 3 |
| `latte uht`, `latte a lunga`, `latte` sowie Marken-/Qualitätsmuster für UHT-Milch | 7 |
| `yogurt`, `yaourt`, `yoghurt` | 5 |
| `mozzarella`, `burrata`, `stracciatella` | 3 |
| `philadelphia`, `spalmabile` | 7 |
| Hartkäse (`parmigiano`, `grana`, `pecorino`, `provolone`, `asiago`, `fontina`, `emmental`, `gruyere`, `scamorza`, `groviera`) | 28 |
| Frischkäse, Ricotta, Mascarpone | 5 |
| sonstiger `formaggio` | 10 |
| `burro` | 30 |
| `panna` | 4 |
| Kochschinken, Mortadella, Würstchen | 5 |
| Rohschinken, Salami, Bresaola, Speck, Pancetta, Nduja | 7 |
| Fleisch: `pollo`, `tacchino`, `maiale`, `manzo`, `vitello`, `agnello` | 2 |
| Frischer Fisch: `salmone`, `tonno fresco`, `pesce` (außer „pesce in …“) | 2 |
| Passata, Pelati, Tomatensauce | 5 |
| Reis-, Pasta-, Farro-, Orzo- oder Couscous-Salat | 7 |
| Salat, Rucola, Spinat, Lattuga, Kresse, Sprossen | 4 |
| Saft | 3 |
| Bier | 3 |
| Wein | 5 |
| Dosenfisch | 4 |
| Avocado | 3 |
| Beeren | 4 |
| Banane, Pfirsich, Aprikose, Kirsche, Mango, Papaya | 4 |
| Apfel, Birne, Nektarine, Pflaume, Kiwi, Ananas, Traube, Melone, Wassermelone | 5 |
| Orange, Mandarine, Grapefruit, Zitrone | 7 |
| Zucchini, Aubergine, Tomate | 5 |
| Paprika | 5 |
| Brokkoli, Blumenkohl, Kohl | 4 |
| Zwiebel, Frühlingszwiebel, Schalotte, Lauch | 6 |
| Karotte | 7 |
| Kartoffel | 4 |
| Knoblauch | 14 |
| Piadina, Piadelle, Crescia, Tigella | 2 |
| verpacktes Schnittbrot | 4 |
| kein Treffer | 5 |

Quelle: `C:/GIT/ai-mobileapp/EverShelf/api/database.php:463`.

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
