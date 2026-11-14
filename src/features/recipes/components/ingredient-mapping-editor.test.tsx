import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { UNKNOWN_INGREDIENT_MAPPING } from '../domain/ingredient-mapping';
import { IngredientMappingEditor } from './ingredient-mapping-editor';

jest.mock('@/features/recipes/hooks/use-food-ingredients', () => ({
  useFoodIngredients: () => ({
    data: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        canonical_name: 'Weizen',
        revision: 1,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        canonical_name: 'Milch',
        revision: 1,
      },
    ],
    isError: false,
    isFetching: false,
  }),
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { accent: '#957b91', backgroundElement: '#eee' } }),
}));

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  const PressContext = React.createContext<{ onPress?: () => void; disabled?: boolean } | null>(
    null,
  );
  return {
    Press: ({
      children,
      onPress,
      disabled,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) => React.createElement(PressContext.Provider, { value: { onPress, disabled } }, children),
    Txt: ({ children }: { children: ReactNode }) => {
      const press = React.useContext(PressContext);
      return React.createElement(Text, press ?? {}, children);
    },
    TextField: (props: Record<string, unknown>) => React.createElement(TextInput, props as never),
  };
});

const source = {
  source: 'import_source' as const,
  sourceId: 'https://example.test/recipe',
  sourceUrl: 'https://example.test/recipe',
  sourceVersion: 'recipe-source-revision-2',
  license: null,
};

async function pressText(view: Awaited<ReturnType<typeof render>>, text: string) {
  const textNode = view.getByText(text);
  const onPress = textNode.props.onPress as (() => void) | undefined;
  if (!onPress) throw new Error(`Element "${text}" hat keinen onPress-Handler`);
  await act(async () => onPress());
}

describe('IngredientMappingEditor', () => {
  it('shows source text and extraction confidence, then saves a reviewed multi-ingredient mapping', async () => {
    const onChange = jest.fn();
    const onEvidenceChange = jest.fn();
    const props = {
      itemId: 'item-1',
      sourceText: 'Weizenmehl und Milch',
      extractionConfidence: 'high' as const,
      mapping: { ...UNKNOWN_INGREDIENT_MAPPING },
      source,
      reviewerId: '00000000-0000-4000-8000-000000000010',
      onChange,
      onEvidenceChange,
    };

    const view = await render(<IngredientMappingEditor {...props} evidenceSnapshot="" />);

    expect(view.getByText('Importtext: Weizenmehl und Milch')).toBeOnTheScreen();
    expect(view.getByText('KI-Erkennung: hoch')).toBeOnTheScreen();
    expect(view.getByText('Zutatenzuordnung prüfen')).toBeOnTheScreen();

    await pressText(view, 'Zutatenzuordnung prüfen');
    const evidenceInput = view.getByLabelText('Beleg der Zutatenliste');
    const inputHandler = evidenceInput.props.onChangeText as ((value: string) => void) | undefined;
    if (!inputHandler) throw new Error('Der Zutatenlistenbeleg hat keinen onChangeText-Handler');
    await act(async () => inputHandler('Weizenmehl, Milch'));
    expect(onEvidenceChange).toHaveBeenCalledWith('Weizenmehl, Milch');
    await view.rerender(
      <IngredientMappingEditor {...props} evidenceSnapshot="Weizenmehl, Milch" />,
    );
    await pressText(view, 'Weizen');
    await pressText(view, 'Milch');
    expect(view.getByText('Vollständige Zutatenliste bestätigen').props.disabled).toBe(false);
    await pressText(view, 'Vollständige Zutatenliste bestätigen');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'verified',
        ingredientIds: [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ],
        complete: true,
        source: source.source,
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        sourceVersion: source.sourceVersion,
        license: source.license,
        evidenceSnapshot: 'Weizenmehl, Milch',
        reviewedBy: props.reviewerId,
      }),
    );
  });

  it('keeps the mapping unknown when the source has no stable version', async () => {
    const onChange = jest.fn();
    const view = await render(
      <IngredientMappingEditor
        itemId="item-2"
        sourceText="Hafer"
        extractionConfidence="medium"
        mapping={{ ...UNKNOWN_INGREDIENT_MAPPING }}
        evidenceSnapshot="Hafer"
        source={null}
        reviewerId="00000000-0000-4000-8000-000000000010"
        onChange={onChange}
        onEvidenceChange={jest.fn()}
      />,
    );

    await pressText(view, 'Zutatenzuordnung prüfen');
    await pressText(view, 'Weizen');
    expect(
      view.getByText('Für diese Quelle fehlt eine stabile Version. Die Zuordnung bleibt offen.'),
    ).toBeOnTheScreen();
    expect(view.getByText('Vollständige Zutatenliste bestätigen').props.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'verified' }));
  });
});
