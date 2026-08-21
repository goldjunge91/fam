import {
  computeMentionUsage,
  matchPendingMention,
  mentionedIngredientIds,
  splitStepMentions,
} from './ingredient-mentions';

const INGREDIENTS = [
  { itemId: 'zwiebel', name: 'Zwiebel', unit: 'g', quantity: 100 },
  { itemId: 'wurst', name: 'Wurst', unit: 'g', quantity: 100 },
  { itemId: 'bruehe', name: 'Brühe', unit: 'ml', quantity: 500 },
  { itemId: 'hafer', name: 'Haferflocken kernig', unit: 'g', quantity: 200 },
];

describe('splitStepMentions', () => {
  it('löst eine Erwähnung mit Menge zu Klartext mit Zutaten-Einheit auf', () => {
    const segments = splitStepMentions('@Wurst50 in Scheiben schneiden.', INGREDIENTS);
    expect(segments[0]).toMatchObject({ kind: 'resolved', text: '50g Wurst' });
    expect(segments[1]).toMatchObject({ kind: 'text', text: ' in Scheiben schneiden.' });
  });

  it('zeigt eine Erwähnung ohne Menge nur als Namen', () => {
    const segments = splitStepMentions('@Zwiebel andünsten.', INGREDIENTS);
    expect(segments[0]).toMatchObject({ kind: 'resolved', text: 'Zwiebel' });
  });

  it('markiert eine Erwähnung ohne passende Zutat als unresolved und lässt die rohe Syntax stehen', () => {
    const segments = splitStepMentions('@Karotte50 schneiden.', INGREDIENTS);
    expect(segments[0]).toMatchObject({ kind: 'unresolved', text: '@Karotte50' });
  });

  it('erkennt einen mehrteiligen Zutatennamen als eine Erwähnung statt an der Leerstelle abzureißen', () => {
    const segments = splitStepMentions('@Haferflocken kernig50 unterrühren.', INGREDIENTS);
    expect(segments[0]).toMatchObject({ kind: 'resolved', text: '50g Haferflocken kernig' });
    expect(segments[1]).toMatchObject({ kind: 'text', text: ' unterrühren.' });
  });

  it('schneidet einen kürzeren Namen nicht vorzeitig ab, wenn er Präfix eines längeren Worts ist', () => {
    const segments = splitStepMentions('@Zwiebeltopf holen.', INGREDIENTS);
    expect(segments[0]).toMatchObject({ kind: 'unresolved', text: '@Zwiebeltopf' });
  });

  it('gibt reinen Text unverändert zurück, wenn keine Erwähnung vorkommt', () => {
    const segments = splitStepMentions('Alles vermengen.', INGREDIENTS);
    expect(segments).toEqual([{ key: 't0', kind: 'text', text: 'Alles vermengen.' }]);
  });
});

describe('computeMentionUsage', () => {
  it('summiert Mengen über mehrere Schritte und deckelt auf die Gesamtmenge', () => {
    const used = computeMentionUsage(['@Wurst50 anbraten.', '@Wurst80 dazugeben.'], INGREDIENTS);
    expect(used.get('wurst')).toBe(100); // 50 + 80 gedeckelt auf 100
  });

  it('zählt Erwähnungen ohne Menge nicht als Verbrauch', () => {
    const used = computeMentionUsage(['@Zwiebel andünsten.'], INGREDIENTS);
    expect(used.get('zwiebel')).toBe(0);
  });

  it('ignoriert unbekannte Erwähnungen', () => {
    const used = computeMentionUsage(['@Karotte50 schneiden.'], INGREDIENTS);
    expect(used.get('zwiebel')).toBe(0);
    expect(used.get('wurst')).toBe(0);
  });
});

describe('mentionedIngredientIds', () => {
  it('gibt die IDs aller im Text erwähnten, bekannten Zutaten zurück', () => {
    const ids = mentionedIngredientIds('@Wurst50 und @Brühe250 dazugeben.', INGREDIENTS);
    expect(ids.sort()).toEqual(['bruehe', 'wurst']);
  });
});

describe('matchPendingMention', () => {
  it('erkennt eine unvollständige Erwähnung am Textende', () => {
    expect(matchPendingMention('Die @Wur')).toEqual({ query: 'Wur' });
  });

  it('gibt null zurück, wenn am Textende keine Erwähnung getippt wird', () => {
    expect(matchPendingMention('Alles vermengen.')).toBeNull();
  });

  it('gibt null zurück, sobald eine Zahl die Erwähnung abschließt', () => {
    expect(matchPendingMention('@Wurst50')).toBeNull();
  });

  it('erlaubt Leerzeichen in der Abfrage für mehrteilige Namen', () => {
    expect(matchPendingMention('@Haferflocken kern')).toEqual({
      query: 'Haferflocken kern',
    });
  });
});
