import { parseJsonArray } from './json-array';

describe('parseJsonArray', () => {
  it('gibt [] fuer null/undefined/leeren String zurueck', () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray('')).toEqual([]);
  });

  it('gibt [] fuer kaputtes JSON zurueck statt zu werfen', () => {
    expect(parseJsonArray('{not valid json')).toEqual([]);
  });

  it('gibt [] zurueck, wenn das JSON kein Array ist', () => {
    expect(parseJsonArray('{"a": 1}')).toEqual([]);
    expect(parseJsonArray('42')).toEqual([]);
  });

  it('parst ein gueltiges JSON-Array', () => {
    expect(parseJsonArray<string>('["vegan", "vegetarian"]')).toEqual(['vegan', 'vegetarian']);
  });
});
