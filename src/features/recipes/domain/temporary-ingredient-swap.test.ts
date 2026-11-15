import {
  replaceIngredientInText,
  replaceIngredientName,
  type TemporaryIngredientSwap,
} from './temporary-ingredient-swap';

const swap: TemporaryIngredientSwap = { ingredientName: 'S+P', replacement: 'Pfeffer' };

describe('temporary ingredient swap', () => {
  it('replaces whole ingredient mentions case-insensitively and keeps mention markers', () => {
    expect(replaceIngredientInText('S+P salzen. @s+p dazugeben.', swap)).toBe(
      'Pfeffer salzen. @Pfeffer dazugeben.',
    );
    expect(replaceIngredientInText('S+Paprika hinzugeben.', swap)).toBe('S+Paprika hinzugeben.');
  });

  it('leaves instructions unchanged when a swap is missing or incomplete', () => {
    const text = 'Kartoffeln schälen.';
    expect(replaceIngredientInText(text, null)).toBe(text);
    expect(replaceIngredientInText(text, { ingredientName: ' ', replacement: 'Pfeffer' })).toBe(
      text,
    );
    expect(replaceIngredientInText(text, { ingredientName: 'Kartoffeln', replacement: ' ' })).toBe(
      text,
    );
  });

  it('replaces only the exact ingredient name and leaves unrelated names untouched', () => {
    expect(replaceIngredientName(' s+p ', swap)).toBe('Pfeffer');
    expect(replaceIngredientName('Paprika', swap)).toBe('Paprika');
    expect(replaceIngredientName('S+P', null)).toBe('S+P');
  });
});
