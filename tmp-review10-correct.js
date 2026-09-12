const fs = require('fs');

const input = 'docs/recipe-extraction/waivy-fam-catalog-import.de.corrected.reviewed8-01A2.json';
const output = 'docs/recipe-extraction/waivy-fam-catalog-import.de.corrected.reviewed9-01A2.json';
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const byId = new Map(data.recipes.map((recipe) => [recipe.externalId, recipe]));

function recipe(id) {
  const value = byId.get(id);
  if (!value) throw new Error(`Unknown recipe ${id}`);
  return value;
}

function setAt(id, path, value) {
  const parts = path.replace(/^recipes\[\d+\]\./, '').split(/\.|\[(\d+)\]/).filter(Boolean);
  let target = recipe(id);
  for (const part of parts.slice(0, -1)) target = target[part];
  target[parts.at(-1)] = value;
}

function replaceAt(id, path, replacements) {
  const parts = path.replace(/^recipes\[\d+\]\./, '').split(/\.|\[(\d+)\]/).filter(Boolean);
  let target = recipe(id);
  for (const part of parts.slice(0, -1)) target = target[part];
  const key = parts.at(-1);
  let value = target[key];
  for (const [from, to] of replacements) value = value.replace(from, to);
  target[key] = value;
}

const exact = {
  'waivy:egg-chawanmushi-steamed-custard|steps[6].text': 'Vergewissern Sie sich vor dem Servieren, dass das Huhn und die Garnelen vollständig gegart sind: Das Huhn ist durchgehend undurchsichtig, die Garnelen rosa und fest. Wenn die Mitte immer noch sehr locker ist, dämpfen Sie weitere 3 bis 5 Minuten und überprüfen Sie es erneut.',
  'waivy:egg-kerala-egg-roast-nadan-mutta|instructions': 'Gekochte Eier werden in einem glänzenden, tief karamellisierten Zwiebel-Masala geschwenkt, das mit schwarzem Pfeffer, Ingwer-Knoblauch und Curryblättern verfeinert ist. Das Masala ist halbtrocken, kräftig und ein wenig feurig und haftet an jedem Ei. Keine Kokosnuss, keine Sahne, nur ein toller Geschmack aus billigen Zutaten, der perfekt zu Chapati oder Naturreis passt.',
  'waivy:egg-burmese-golden-egg-curry|steps[6].text': 'Legen Sie die hart gekochten Eier in die Soße und löffeln Sie die Soße darüber. 5–7 Minuten leicht köcheln lassen, dabei die Eier einmal wenden, bis die Soße reichhaltig, glänzend und leicht eingedickt ist und die Eier durchgewärmt sind.',
  'waivy:egg-burmese-golden-egg-curry|steps[7].text': 'Salz oder Fischsauce abschmecken und anpassen. Nach Belieben mit gehacktem Koriander garnieren und die gekochten Eier in der Soße heiß über gedünstetem Reis servieren.',
  'waivy:egg-kuku-sabzi-persian-herb-frittata|steps[4].text': 'Erhitzen Sie 2 EL Olivenöl in einer 23–25 cm großen beschichteten Pfanne bei mittlerer bis niedriger Hitze. Die Kräuter-Ei-Mischung dazugeben und mit einem Spatel flach verstreichen. Abdecken und 12–15 Minuten ungestört garen, bis die Unterseite tiefgolden ist und die Oberseite größtenteils fest, aber in der Mitte noch leicht weich ist.',
  'waivy:egg-green-shakshuka|steps[6].text': 'Nehmen Sie die Pfanne vom Herd. Den Feta darüberbröseln und mit dem restlichen Dill und Koriander bestreuen.',
  'waivy:egg-air-fryer-scotch-eggs|components[0].items[0].source_note': '4 zum Kochen und Einwickeln, 2 Eier, geschlagen, zum Wälzen',
  'waivy:egg-air-fryer-scotch-eggs|steps[3].text': 'Stellen Sie drei flache Schüsseln auf: Mehl in die erste, die 2 restlichen geschlagenen Eier in die zweite, Panko in die dritte. Wälzen Sie jedes eingewickelte Ei in Mehl, tauchen Sie es in das verquirlte Ei und drücken Sie es anschließend in das Panko, um es vollständig zu bedecken.',
  'waivy:egg-loco-moco|hashtags[8]': 'Imbiss-klassisch',
  'waivy:ba-no-fail-roast-chicken-with-lemon-and-garlic|steps[8].text': 'Rösten Sie das Hähnchen, bis es schön gebräunt ist. Messen Sie mit einem Lebensmittelthermometer an der dicksten Stelle von Brust und Keule eine Kerntemperatur von mindestens 74 °C; prüfen Sie die Temperatur nach 45 Minuten und garen Sie bei Bedarf weiter.',
  'waivy:she-chicken-quesadillas|substitutions[1].savings': 'Verwenden Sie den Käseblock, der gerade im Angebot ist.',
  'waivy:she-chicken-with-homemade-gravy|components[0].items[1].source_note': '1 TL für die Paniermischung + nach Geschmack',
  'waivy:she-chicken-with-homemade-gravy|components[0].items[2].source_note': '1/2 TL für die Paniermischung + nach Geschmack',
  'waivy:she-chicken-with-homemade-gravy|steps[0].text': 'Die Paniermischung zubereiten: In einer großen flachen Schüssel das 35 g Mehl, Meersalz, schwarzen Pfeffer, süßes Paprikapulver, Zwiebelpulver und Knoblauchpulver vermischen.',
  'waivy:she-chicken-with-homemade-gravy|steps[7].text': 'Das Hähnchen über Kartoffelpüree mit gedünsteten grünen Bohnen servieren, mit Soße beträufeln und mit gehackter Petersilie bestreuen. Geflügel sollte vor dem Servieren eine Kerntemperatur von mindestens 74 °C erreichen.',
  'waivy:she-falafel-bowl|images[0].altText': 'Rezeptfoto: Falafel-Schüssel (Simple Home Edit)',
  'waivy:she-falafel-bowl|title': 'Falafel-Schüssel (Simple Home Edit)',
  'waivy:she-falafel-bowl|instructions': 'Eine lebendige mediterrane Schüssel mit knusprigen Falafeln, lockerem braunem Reis, frischem Gemüse, salzigen Oliven und Feta auf einem Schuss Rote-Bete-Hummus. Bereit in 10 Minuten für ein unkompliziertes, sättigendes Mittagessen. Rezept von Simple Home Edit: https://simplehomeedit.com/recipe/falafel-bowl/',
  'waivy:she-lemon-gnocchi-chicken|steps[2].text': 'Sobald die Butter geschmolzen ist, fügen Sie das Huhn hinzu und kochen Sie es 3 Minuten. Wenden Sie das Huhn, decken Sie es ab und garen Sie es weitere 3 Minuten oder bis es durchgegart ist. Beiseitestellen.',
  'waivy:she-macaroni-and-cheese|steps[5].text': 'Das Hühnerbrühepulver und den geriebenen Cheddar unterrühren, bis er geschmolzen ist. Schalten Sie den Herd aus und rühren Sie die gekochten Nudeln durch. So servieren, wie es ist, oder für zusätzliche Knusprigkeit weiterbacken.',
  'waivy:she-one-pan-chicken-and-broccoli-ramen-noodles|steps[7].text': 'Nehmen Sie den Deckel ab und drehen und lösen Sie die Nudeln vorsichtig mit einer Zange. Achten Sie dabei darauf, dass alle festen Teile die Flüssigkeit berühren. Decken Sie die Pfanne ab und kochen Sie weitere 1–2 Minuten, bis die Nudeln weich sind.',
  'waivy:she-sticky-beef-noodles|substitutions[1].swap': 'Verwenden Sie Lo-Mein-Nudeln, Reisnudeln oder notfalls Spaghetti, wenn keine andere Nudelsorte vorhanden ist.',
  'waivy:she-stir-fried-beef-with-flat-rice-noodles|substitutions[1].savings': 'Verwenden Sie eine Sojasauce, die Sie bereits zu Hause haben.',
  'waivy:she-the-best-salad-dressing|substitutions[2].savings': 'Jedes vorhandene Süßungsmittel, das sich für die Vorratshaltung eignet, funktioniert.',
  'waivy:she-tuna-fried-rice|steps[4].text': 'Schieben Sie alles auf eine Seite der Pfanne. Gießen Sie die verquirlten Eier auf die leere Seite und kochen Sie sie 2–3 Minuten, bis sie fest sind, und heben Sie sie dann unter die Reismischung.',
  'waivy:she-tuna-fried-rice|steps[5].text': 'Tamari und Sesamöl einrühren und alles 1–2 Minuten weiter erhitzen, bis das Gericht vollständig dampfend heiß ist, dann heiß servieren.',
  'waivy:toh-crispy-orange-chicken|steps[0].text': 'Backen Sie das gefrorene panierte Hähnchen auf einem Blech gemäß den Anweisungen auf der Packung, bis es gar ist. Prüfen Sie an der dicksten Stelle mit einem Lebensmittelthermometer mindestens 74 °C.',
  'waivy:toh-easy-stuffed-shells|steps[6].text': 'Nehmen Sie den Deckel ab und backen Sie weitere 3–5 Minuten, bis die Soße Blasen bildet und der Käse vollständig geschmolzen ist.',
  'waivy:toh-gnocchi-with-white-beans|instructions': 'Kuschelige Kartoffelgnocchi werden in der Pfanne goldbraun angebraten, anschließend mit cremigen Cannellini-Bohnen, Kräutertomaten und welkem Spinat vermengt und köcheln gelassen, bevor sie mit schmelzendem Mozzarella und Parmesan bedeckt werden. Ein gemütliches Abendessen aus einer Pfanne, das in einer halben Stunde auf dem Tisch steht. Rezept von Taste of Home: https://www.tasteofhome.com/recipes/gnocchi-with-white-beans/',
  'waivy:toh-grilled-huli-huli-chicken|instructions': 'Saftige gegrillte Hähnchenschenkel werden in einer süßen und herzhaften hawaiianischen Glasur aus braunem Zucker, Soja, Ketchup, Ingwer und Knoblauch mariniert, anschließend auf dem Grill verkohlt und mit der zurückbehaltenen Marinade bestrichen, um ein klebriges, karamellisiertes Finish zu erhalten. Rezept von Taste of Home: https://www.tasteofhome.com/recipes/grilled-huli-huli-chicken/',
  'waivy:toh-saucy-pork-chop-skillet|instructions': 'Zarte, in der Pfanne angebratene Schweinelendenkoteletts werden in einer herzhaften Tomaten-Rinderbrühe-Sauce mit süßen Zwiebeln und Kräutern gegart, mit einer glänzenden Bratensoße abgerundet und mit flauschigem braunem Reis serviert. Ein gemütliches Abendessen unter der Woche in einer einzigen Pfanne, das in einer halben Stunde zubereitet ist. Rezept von Taste of Home: https://www.tasteofhome.com/recipes/saucy-pork-chop-skillet/',
  'waivy:ba-red-sauce-for-pizza|steps[2].text': 'Widerstehen Sie der Zugabe von mehr Salz; der Geschmack konzentriert sich, wenn die Sauce mit der Pizza backt.',
  'waivy:ba-parker-house-rolls-recipe|steps[0].text': 'Die Hefe mit ¼ Tasse warmem Wasser (43–46 °C) in einer kleinen Schüssel verquirlen; schaumig rühren lassen, ca. 5 Minuten.',
  'waivy:ba-parker-house-rolls-recipe|steps[5].text': 'Eine 33 × 23 cm große Auflaufform leicht mit etwas geschmolzener Butter bestreichen. Den Teig ausstanzen und in 4 gleich große Stücke teilen.',
  'waivy:ba-parker-house-rolls-recipe|steps[6].text': 'Stück für Stück zu einem 30 × 15 cm großen Rechteck ausrollen. Längs in drei 5 cm breite Streifen schneiden, dann jeden Streifen quer schneiden, um drei 10 × 5 cm große Rechtecke zu erhalten (9 pro Stück, 36 insgesamt).',
  'waivy:ba-salted-butter-apple-galette-with-maple-whipped-cream|steps[1].text': 'Rollen Sie den Tortenteig auf einer leicht bemehlten Oberfläche zu einem groben 36 × 25 cm großen Rechteck mit einer Dicke von etwa 3 mm oder zu einer runden Fläche von etwa 30 cm aus. Auf ein mit Backpapier ausgelegtes Backblech geben.',
  'waivy:ba-salted-butter-apple-galette-with-maple-whipped-cream|steps[2].text': 'Ordnen Sie die Apfelscheiben überlappend darauf ein und lassen Sie einen Rand von etwa 3,8 cm. Bestreichen Sie die Äpfel mit der braunen Vanillebutter und bestreuen Sie sie mit dem Muscovado-Zucker.',
  'waivy:she-baked-miso-salmon|steps[0].text': 'Heizen Sie den Ofen auf 200 °C vor.',
  'waivy:mw-tuna-pasta-bowl|steps[4].text': 'Warm essen oder für einen Nudelsalat 10 Minuten kühlen.',
  'waivy:mw-tomato-pasta-mug|steps[3].text': 'Zerkleinerte Tomaten, Knoblauchpulver und italienische Gewürze unterrühren; weitere 60 Sekunden in der Mikrowelle erhitzen.',
  'waivy:mw-ramen-egg-bowl|images[0].altText': 'Rezeptfoto: Ramen-Ei-Schüssel aus der Mikrowelle',
  'waivy:mw-ramen-egg-bowl|title': 'Ramen-Ei-Schüssel aus der Mikrowelle',
  'waivy:mw-cabbage-ramen-stir-bowl|steps[0].text': 'Kohl zerkleinern und mit 1 EL Wasser in eine mikrowellengeeignete Schüssel geben.',
  'waivy:mw-rice-pudding-breakfast|steps[3].text': 'Vanille hinzufügen und mit zusätzlichem Zimt bestreuen.',
  'waivy:mw-banana-oat-mug-cake|steps[3].text': 'Mit einem Klecks Erdnussbutter belegen und 1 Minute abkühlen lassen, denn der Becher ist sehr heiß.',
  'waivy:mw-loaded-baked-potato|steps[1].text': 'In der Mikrowelle auf einem Teller 5 Minuten erhitzen, umdrehen, dann weitere 2 Minuten erhitzen (mit einer Gabel testen).',
  'waivy:mw-chili-baked-potato|images[0].altText': 'Rezeptfoto: Ofenkartoffel mit Chili-Belag',
  'waivy:mw-chili-baked-potato|title': 'Ofenkartoffel mit Chili-Belag',
  'waivy:ba-one-skillet-chicken-with-buttery-orzo|substitutions[2].swap': '1 gelbe oder weiße Zwiebel, gehackt',
  'waivy:she-baked-lemon-garlic-butter-salmon|components[0].items[10].source_note': '4 Lachsfilets mit Haut',
  'waivy:she-baked-miso-salmon|components[0].items[3].source_note': '4 Lachsfilets mit Haut',
  'waivy:she-honey-garlic-salmon|components[0].items[5].source_note': '4 Lachsfilets mit Haut',
};

for (const [key, value] of Object.entries(exact)) {
  const separator = key.indexOf('|');
  setAt(key.slice(0, separator), key.slice(separator + 1), value);
}

const replacements = [
  ['waivy:egg-chawanmushi-steamed-custard', 'substitutions[0].swap', [['1,25 Tassen Wasser mit Dashi-Pulver mischen oder stattdessen Hühnerbrühe verwenden.', '1,25 Tassen Wasser mit Dashi-Pulver mischen oder ersatzweise Hühnerbrühe verwenden.']]],
  ['waivy:egg-cha-trung-hap-vietnamese-steamed-egg-meatloaf', 'substitutions[2].savings', [['Verwenden Sie ein vorhandenes Vorratskammer-Grundnahrungsmittel, wenn keine Fischsauce vorhanden ist.', 'Verwenden Sie ein vorhandenes Vorratskammer-Grundnahrungsmittel, wenn Sie keine Fischsauce vorrätig haben.']]],
  ['waivy:egg-ojja-merguez', 'steps[7].text', [['Schalten Sie die Hitze ab, streuen Sie den gehackten Koriander darüber.', 'Schalten Sie die Hitze ab und streuen Sie den gehackten Koriander darüber.']]],
  ['waivy:egg-ful-medames-soft-egg-cumin', 'components[0].items[0].source_note', [['1 Tasse abgetropfte Bohnen; einen Spritzer Flüssigkeit aufbewahren', '1 Tasse abgetropfte Bohnen; einen Spritzer Flüssigkeit aufbewahren']]],
  ['waivy:ba-parker-house-rolls-recipe', 'substitutions[0].savings', [['Oft bereits vorhanden; das spart den Kauf von Backfett.', 'Oft bereits vorhanden; das spart den Kauf von Backfett.']]],
  ['waivy:she-chicken-salad-with-creamy-peanut-dressing', 'substitutions[2].swap', [['Abgefüllter Limettensaft funktioniert ebenfalls.', 'Abgefüllter Limettensaft funktioniert ebenfalls, wenn keine frischen Limetten vorhanden sind.']]],
  ['waivy:she-chicken-salad-with-creamy-peanut-dressing', 'instructions', [['15 Minuten flach', 'in 15 Minuten fertig']]],
  ['waivy:she-crispy-chicken-schnitzel-alfredo', 'substitutions[2].savings', [['Verwenden Sie, was Sie bereits in der Vorratskammer haben.', 'Verwenden Sie, was Sie bereits in der Vorratskammer haben.']]],
  ['waivy:she-honey-garlic-salmon', 'substitutions[0].savings', [['Verwenden Sie Reisweinessig oder frischen Limettensaft, den Sie bereits zu Hause haben.', 'Verwenden Sie Reisweinessig oder frischen Limettensaft, den Sie bereits zu Hause haben.']]],
  ['waivy:she-stir-fried-beef-with-flat-rice-noodles', 'substitutions[0].savings', [['Verwenden Sie Mirin oder trockenen Sherry, den Sie bereits zu Hause haben.', 'Verwenden Sie Mirin oder trockenen Sherry, den Sie bereits zu Hause haben.']]],
  ['waivy:she-stir-fried-beef-with-flat-rice-noodles', 'substitutions[2].savings', [['Kaufen Sie die günstigere Alternative, wenn sie im Angebot ist.', 'Kaufen Sie die günstigere Alternative, wenn sie im Angebot ist.']]],
  ['waivy:toh-best-salisbury-steak', 'substitutions[1].savings', [['Bessere Textur; frische Champignons kosten bei Angeboten etwa gleich viel.', 'Bessere Textur; frische Champignons kosten bei Angeboten etwa gleich viel.']]],
  ['waivy:toh-pork-ramen-stir-fry', 'substitutions[0].savings', [['Oft im Angebot günstiger als Schweinelende.', 'Oft im Angebot günstiger als Schweinelende.']]],
  ['waivy:toh-spinach-and-feta-stuffed-chicken', 'substitutions[1].savings', [['Oft im Angebot; eine magerere Option.', 'Oft im Angebot; eine magerere Option.']]],
  ['waivy:toh-turkey-taco-salad', 'substitutions[1].savings', [['Kostet etwa gleich viel; verwenden Sie, was Sie bereits in der Vorratskammer haben.', 'Kostet etwa gleich viel; verwenden Sie, was Sie bereits in der Vorratskammer haben.']]],
];
for (const [id, path, pairs] of replacements) replaceAt(id, path, pairs);

const sourceNotes = {
  'waivy:ba-no-fail-roast-chicken-with-lemon-and-garlic|components[0].items[3].source_note': 'etwa 1,6–1,8 kg',
  'waivy:ba-red-wine-braised-short-ribs-with-carrots|components[0].items[0].source_note': 'etwa 2,3 kg Rinderrippen mit Knochen nach englischer Art, zwischen den Knochen geschnitten (etwa 10 Stück)',
  'waivy:ba-red-wine-braised-short-ribs-with-carrots|components[0].items[7].source_note': 'etwa 450 g junge Karotten, ungeschält, bei großen halbiert',
  'waivy:ba-slow-roasted-salmon-with-fennel-citrus-and-chiles|components[0].items[7].source_note': 'etwa 900 g Filet ohne Haut, vorzugsweise mittig geschnitten',
  'waivy:toh-asian-lettuce-wraps|components[0].items[1].source_note': 'mager, etwa 450 g insgesamt',
  'waivy:toh-brown-sugar-glazed-salmon|components[0].items[0].source_note': 'ein etwa 450 g schweres Filet, in 4 Portionen geschnitten',
  'waivy:toh-crispy-bbq-chip-tenders|components[0].items[12].source_note': 'Hähnchenfilet, etwa 680 g',
  'waivy:toh-grilled-beef-blue-cheese-sandwiches|components[0].items[3].source_note': 'dünn geschnitten, etwa 340 g',
  'waivy:toh-hot-dog-pie|components[0].items[0].source_note': 'etwa 225 g, gebräunt und abgetropft',
  'waivy:toh-italian-sausage-bean-soup|components[0].items[0].source_note': 'Masse, Hüllen entfernt; etwa 450 g insgesamt',
  'waivy:toh-skillet-shepherd-s-pie|components[0].items[0].source_note': 'etwa 450 g Rinderhackfleisch',
  'waivy:toh-sweet-n-spicy-chicken|components[0].items[1].source_note': 'etwa 450 g, in 1,3 cm große Würfel geschnitten',
  'waivy:toh-tasty-burritos|components[0].items[0].source_note': 'etwa 450 g, gebräunt und abgetropft',
};
for (const [key, value] of Object.entries(sourceNotes)) {
  const separator = key.indexOf('|');
  setAt(key.slice(0, separator), key.slice(separator + 1), value);
}

const noteFixes = [
  ['waivy:she-beans-with-fried-rice-and-dumplings', 'components[0].items[9].source_note', '3 Frühlingszwiebeln, fein gehackt, weiß und grün getrennt'],
  ['waivy:she-chicken-fried-rice', 'components[0].items[11].source_note', '2 Frühlingszwiebeln, fein geschnitten'],
  ['waivy:she-chicken-gyros', 'components[0].items[8].source_note', '4 Fladenbrote'],
  ['waivy:she-creamy-pesto-pasta-salad', 'components[0].items[8].source_note', '2 gehäufte EL Pesto'],
  ['waivy:she-creamy-pesto-pasta-salad', 'components[0].items[9].source_note', '2 gehäufte Esslöffel griechischer Naturjoghurt'],
  ['waivy:she-crispy-sesame-chicken-and-fried-rice', 'components[0].items[21].source_note', '1 Frühlingszwiebel, fein geschnitten, zum Garnieren'],
  ['waivy:she-crispy-sweet-chilli-chicken', 'components[0].items[14].source_note', '1 Frühlingszwiebel, fein geschnitten'],
  ['waivy:she-curried-egg-sandwiches', 'components[0].items[5].source_note', '1 Frühlingszwiebel, fein geschnitten'],
  ['waivy:she-drunken-noodles', 'components[0].items[13].source_note', '4 Frühlingszwiebelstiele, in Stäbchen geschnitten'],
  ['waivy:she-easy-curry-laksa', 'components[0].items[13].source_note', '1 geschnittene frische lange rote Chili'],
  ['waivy:she-juicy-thai-beef-lettuce-cups', 'components[0].items[16].source_note', '1 Frühlingszwiebel, fein geschnitten'],
  ['waivy:she-korean-beef-rice-bowls', 'components[0].items[10].source_note', '2 Frühlingszwiebeln, fein geschnitten, 1 EL zum Garnieren reserviert'],
  ['waivy:she-one-pan-chicken-and-broccoli-ramen-noodles', 'components[0].items[9].source_note', '2 Frühlingszwiebeln, weiße und grüne Teile getrennt'],
  ['waivy:she-one-pan-korean-style-beef-noodles', 'components[0].items[15].source_note', '2 Frühlingszwiebeln, fein geschnitten, plus etwas zusätzlich zum Servieren'],
  ['waivy:she-prawn-shrimp-fried-rice', 'components[0].items[14].source_note', '3 Frühlingszwiebeln, in Scheiben geschnitten'],
  ['waivy:she-quick-beef-and-broccoli-noodles', 'components[0].items[13].source_note', '1 Frühlingszwiebel, fein geschnitten'],
  ['waivy:she-quick-creamy-miso-chicken-ramen', 'components[0].items[9].source_note', '3 Frühlingszwiebeln, fein geschnitten'],
  ['waivy:she-salmon-green-curry', 'components[0].items[1].source_note', '4 Filets mit Haut, gewürzt mit Meersalz'],
  ['waivy:she-speedy-beef-teriyaki', 'components[0].items[16].source_note', '1 Frühlingszwiebel, fein geschnitten'],
  ['waivy:she-sticky-beef-noodles', 'components[0].items[13].source_note', '2 Frühlingszwiebeln, fein geschnitten'],
  ['waivy:she-sticky-hoisin-beef', 'components[0].items[4].source_note', '2 Frühlingszwiebeln, weiße und grüne Teile getrennt'],
  ['waivy:she-sticky-pork-noodles', 'components[0].items[10].source_note', '2 Frühlingszwiebeln, fein geschnitten'],
  ['waivy:she-street-style-soy-noodles', 'components[0].items[9].source_note', '2 Frühlingszwiebeln, grüne und weiße Teile getrennt'],
  ['waivy:she-taco-bowl', 'components[0].items[14].source_note', '1 Frühlingszwiebel, fein geschnitten'],
];
for (const [id, path, value] of noteFixes) setAt(id, path, value);

const replacementsByField = [
  ['steps[0].text', '„1,3 cm', '„1,3 cm'],
];
void replacementsByField;

const globalReplacements = [
  ['substitutions[2].savings', 'waivy:ba-red-sauce-for-pizza', 'teaspoon', 'Teelöffel'],
  ['substitutions[2].savings', 'waivy:she-one-pan-korean-style-beef-noodles', 'gemahlen Pute kann spart up zu 0,50 $/Portion', 'Gemahlenes Putenfleisch kann bis zu 0,50 $ pro Portion sparen.'],
  ['substitutions[2].savings', 'waivy:she-pork-belly-fried-rice', 'verwendet up Reste', 'Verwendet Reste'],
  ['substitutions[2].savings', 'waivy:she-tuna-fried-rice', 'günstiger pro tablespoon als olive Kochen', 'Günstiger pro Esslöffel als Olivenöl.'],
  ['substitutions[1].savings', 'waivy:toh-bbq-meat-loaf-minis', 'verwenden up Vorratskammer-Grundnahrungsmittel', 'Verwenden Sie vorhandene Vorratskammer-Grundnahrungsmittel.'],
  ['substitutions[2].savings', 'waivy:toh-grilled-basil-chicken-and-tomatoes', 'verwenden up günstiger seasonal Tomaten', 'Verwenden Sie günstigere Tomaten der Saison.'],
  ['substitutions[1].savings', 'waivy:toh-pork-chops-with-honey-garlic-sauce', 'Oft günstiger pro tablespoon als Honig', 'Oft günstiger pro Esslöffel als Honig'],
  ['substitutions[0].savings', 'waivy:toh-easy-beef-taco-skillet', 'Vorratskammer-Grundnahrungsmittel kostet weniger als ein Flasche von taco Sauce', 'Die günstigere 80/20-Mischung kostet weniger als eine Flasche Taco-Sauce.'],
  ['cheapTips[2]', 'waivy:she-creamy-pesto-chicken-with-zoodles', 'ohne ein Cremigkeit zu verlieren', 'ohne an Cremigkeit zu verlieren'],
  ['instructions', 'waivy:she-perfect-steak-with-peppercorn-sauce', 'in der 20 Minuten-Wohnung', 'in 20 Minuten'],
  ['instructions', 'waivy:egg-pidan-doufu-century-egg-silken-tofu', 'und tiefem Umami ist es', 'und voller Umami ist es'],
  ['instructions', 'waivy:toh-mediterranean-turkey-skillet', 'Ein helles Abendessen', 'Ein herzhaftes Abendessen'],
  ['instructions', 'waivy:toh-zippy-breaded-pork-chops', 'einen würzigen Ranch-Dip', 'einen würzigen Ranch-Dip'],
];
for (const [path, id, from, to] of globalReplacements) replaceAt(id, path, [[from, to]]);

const phraseReplacements = [
  ['instructions', 'waivy:egg-bacon-sriracha-deviled-eggs', 'Snack', 'Zwischenmahlzeit'],
  ['instructions', 'waivy:egg-creamy-egg-salad', 'snack', 'Zwischenmahlzeit'],
  ['cheapTips[2]', 'waivy:egg-air-fryer-scotch-eggs', 'Snack', 'Zwischenmahlzeit'],
  ['instructions', 'waivy:egg-air-fryer-scotch-eggs', 'Snack', 'Zwischenmahlzeit'],
  ['cheapTips[0]', 'waivy:egg-grated-egg-avocado-toast', 'Snack', 'Zwischenmahlzeit'],
  ['instructions', 'waivy:she-bruschetta-salad', 'Crunch', 'Knusprigkeit'],
  ['cheapTips[2]', 'waivy:she-chia-and-oat-puddings', 'Toppings', 'Beläge'],
  ['cheapTips[2]', 'waivy:she-chicken-quesadillas', 'Toppings', 'Beläge'],
  ['steps[7].text', 'waivy:she-juicy-thai-beef-lettuce-cups', 'Toppings', 'Beläge'],
  ['steps[6].text', 'waivy:toh-cilantro-beef-tacos', 'Toppings', 'Beläge'],
  ['instructions', 'waivy:she-taco-bowl', 'Bowl', 'Schüssel'],
  ['instructions', 'waivy:she-honey-garlic-salmon', 'Bowl', 'Schüssel'],
  ['instructions', 'waivy:she-beef-burrito-bowl', 'Bowl', 'Schüssel'],
  ['instructions', 'waivy:she-falafel-bowl', 'Bowl', 'Schüssel'],
  ['title', 'waivy:she-falafel-bowl', 'Bowl', 'Schüssel'],
  ['images[0].altText', 'waivy:she-falafel-bowl', 'Bowl', 'Schüssel'],
];
for (const [path, id, from, to] of phraseReplacements) replaceAt(id, path, [[from, to]]);

const metric = [
  ['waivy:egg-sucuklu-yumurta', 'components[0].items[1].source_note', [['0,6 cm', '0,6 cm']]],
  ['waivy:egg-sucuklu-yumurta', 'steps[0].text', [['0,6 cm', '0,6 cm']]],
  ['waivy:ba-fallen-chocolate-cake', 'components[0].items[0].source_note', [['in 1Stücke', 'in 1-cm-Stücke']]],
  ['waivy:ba-no-fail-roast-chicken-with-lemon-and-garlic', 'steps[4].text', [['7,6 cm', '7,6 cm']]],
  ['waivy:ba-slow-roasted-salmon-with-fennel-citrus-and-chiles', 'steps[1].text', [['2,8-l-Auflaufform', 'etwa 2,8 l große Auflaufform']]],
  ['waivy:she-creamy-sausage-pasta', 'components[0].items[1].source_note', [['2,5 cm', '2,5 cm']]],
  ['waivy:toh-bacon-swiss-chicken-sandwiches', 'steps[1].text', [['1,3 cm', '1,3 cm']]],
  ['waivy:toh-blt-pizza', 'components[0].items[0].source_note', [['30,5 cm', '30,5 cm']]],
  ['waivy:toh-blt-pizza', 'steps[0].text', [['30,5 cm', '30,5 cm']]],
  ['waivy:toh-chicken-cheese-tortilla-pie', 'components[0].items[1].source_note', [['15 cm', '15 cm']]],
  ['waivy:toh-chicken-cheese-tortilla-pie', 'steps[0].text', [['23 cm', '23 cm']]],
  ['waivy:toh-chicken-cordon-bleu-pizza', 'components[0].items[5].source_note', [['1,3 cm', '1,3 cm']]],
  ['waivy:toh-cilantro-beef-tacos', 'components[0].items[11].source_note', [['15 cm', '15 cm']]],
  ['waivy:toh-easy-beef-taco-skillet', 'components[0].items[3].source_note', [['2,5 cm', '2,5 cm']]],
  ['waivy:toh-mediterranean-pork-and-orzo', 'steps[0].text', [['2,5 cm', '2,5 cm']]],
  ['waivy:toh-moo-shu-mushroom-wraps', 'components[0].items[11].source_note', [['15 cm', '15 cm']]],
  ['waivy:toh-parmesan-chicken-sandwiches', 'components[0].items[4].source_note', [['1,3 cm', '1,3 cm']]],
  ['waivy:toh-parmesan-chicken-sandwiches', 'steps[1].text', [['1,3 cm', '1,3 cm']]],
  ['waivy:toh-pork-medallions-in-mustard-sauce', 'components[0].items[3].source_note', [['1,3 cm', '1,3 cm']]],
  ['waivy:toh-pork-potato-supper', 'components[0].items[1].source_note', [['0,6 cm', '0,6 cm']]],
  ['waivy:toh-pork-potato-supper', 'steps[0].text', [['30,5 cm', '30,5 cm']]],
  ['waivy:toh-pork-ramen-stir-fry', 'components[0].items[6].source_note', [['1,3 cm', '1,3 cm']]],
  ['waivy:toh-potato-kielbasa-skillet', 'components[0].items[0].source_note', [['2,5 cm', '2,5 cm']]],
  ['waivy:toh-potato-kielbasa-skillet', 'components[0].items[9].source_note', [['0,6 cm', '0,6 cm']]],
  ['waivy:toh-salmon-veggie-packets', 'steps[0].text', [['46 × 38 cm', '46 × 38 cm']]],
  ['waivy:toh-sloppy-joe-biscuit-cups', 'steps[3].text', [['12,7 cm', '12,7 cm']]],
  ['waivy:toh-sweet-n-spicy-chicken', 'components[0].items[1].source_note', [['1,3 cm', '1,3 cm']]],
  ['waivy:toh-sweet-n-spicy-chicken', 'steps[0].text', [['1,3 cm', '1,3 cm']]],
  ['waivy:toh-tasty-burritos', 'components[0].items[3].source_note', [['30,5 cm', '30,5 cm']]],
  ['waivy:toh-turkey-biscuit-stew', 'steps[0].text', [['25 cm', '25 cm']]],
  ['waivy:toh-turkey-gyros', 'components[0].items[6].source_note', [['0,6 cm', '0,6 cm']]],
  ['waivy:mw-potato-egg-hash', 'steps[0].text', [['1,3 cm', '1,3 cm']]],
];
for (const [id, path, pairs] of metric) replaceAt(id, path, pairs);

const exactQuantity = {
  'waivy:egg-grated-egg-avocado-toast|steps[1].text': 'Eine etwa 2,5 cm dicke Scheibe Sauerteig in einem Toaster oder unter einem Grill rösten, bis die Ränder goldbraun und knusprig sind, 2–3 Minuten. Eine stabile, knusprige Basis verhindert, dass der Belag durchweicht.',
  'waivy:ba-kuku-sabzi|steps[0].text': 'Erhitzen Sie 2 EL Pflanzenöl in einer 25 cm großen Pfanne bei mittlerer Hitze. Kochen Sie die fein gehackte Zwiebel und den Lauch unter gelegentlichem Rühren, bis sie sehr weich, aber nicht gebräunt sind, 10–12 Minuten. Auf einen Teller geben und abkühlen lassen. Die Pfanne auswischen und beiseitestellen.',
  'waivy:ba-salted-butter-apple-galette-with-maple-whipped-cream|components[0].items[4].source_note': 'etwa 450 g Backäpfel, in 3 mm dünne Scheiben geschnitten',
  'waivy:she-easy-curry-laksa|cheapTips[2]': 'Verwenden Sie in Wasser verdünnte Hühnerbrühwürfel von Handelsmarken anstelle von 2 l Brühe, um die Kosten zu senken.',
  'waivy:toh-easy-stuffed-shells|steps[2].text': 'Fetten Sie eine 33 × 23 cm große Auflaufform leicht ein und verteilen Sie etwa 1/2 Tasse Marinara auf dem Boden.',
  'waivy:toh-bacon-cheeseburger-tater-tot-bake|steps[2].text': 'Verteilen Sie die käseartige Rindfleischmischung in einer gefetteten 33 × 23 cm großen Auflaufform.',
  'waivy:toh-baked-tilapia|steps[0].text': 'Heizen Sie den Ofen auf 218 °C vor und legen Sie die Tilapiafilets flach in einer einzigen Schicht in eine ungefettete 33 × 23 cm große Auflaufform.',
  'waivy:toh-chicken-cordon-bleu-pizza|steps[0].text': 'Heizen Sie den Ofen auf 218 °C vor und fetten Sie ein 38 × 25 cm großes Blech leicht ein.',
  'waivy:toh-contest-winning-broccoli-chicken-casserole|steps[0].text': 'Den Ofen auf 177 °C vorheizen und eine 28 × 18 cm große Auflaufform leicht einfetten.',
  'waivy:toh-meatball-submarine-casserole|steps[2].text': 'Reiben Sie das geröstete Brot mit der Schnittseite des Knoblauchs ein und werfen Sie dann den Knoblauch weg. Die Scheiben in mundgerechte Stücke reißen und in einer gefetteten 28 × 18 cm großen Auflaufform verteilen.',
};
for (const [key, value] of Object.entries(exactQuantity)) {
  const separator = key.indexOf('|');
  setAt(key.slice(0, separator), key.slice(separator + 1), value);
}

const tagsToRemove = [
  'waivy:egg-chawanmushi-steamed-custard',
  'waivy:she-baked-miso-salmon',
  'waivy:she-chicken-with-creamy-tomato-sauce',
  'waivy:she-creamy-garlic-chicken',
  'waivy:she-creamy-lemon-pepper-chicken',
  'waivy:she-easy-greek-chicken',
  'waivy:she-mango-salad-with-sweet-chilli-lime-dressing',
  'waivy:toh-tomato-garlic-butter-bean-dinner',
  'waivy:toh-tomato-poached-halibut',
  'waivy:mw-loaded-baked-potato',
];
for (const id of tagsToRemove) {
  const tags = recipe(id).dietaryTags;
  recipe(id).dietaryTags = tags.filter((tag) => tag !== 'gluten_free' && tag !== 'vegetarian');
}

data.schemaVersion = 2;
fs.writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`);
