import { render, screen, userEvent, within } from '@testing-library/react-native';

import type { BetaPreviewItem } from '../types';
import type { TextBetaPreview } from '../workflow/text-workflow';
import { NaturalLanguageAdditionSwiftUIPreviewContent } from './stt-preview-content';

const previewItem: BetaPreviewItem = {
  itemId: 'session-1:item:0',
  item: {
    name: 'Skyr',
    quantity: 1,
    unit: null,
    brand: null,
  },
  routing: {
    kind: 'uncertain',
    item: {
      name: 'Skyr',
      quantity: 1,
      unit: null,
      brand: null,
    },
    listId: null,
    confidence: 0.25,
    bestMatch: null,
    suggestions: [
      { listId: 'rewe-list', listName: 'REWE', confidence: 0.5 },
      { listId: 'aldi-list', listName: 'Aldi', confidence: 0.5 },
    ],
    needsClarification: true,
  },
  reviewState: 'pending',
};

const preview: TextBetaPreview = {
  session: { id: 'session-1', source: 'text', startedAt: '2026-09-18T00:00:00.000Z' },
  input: { source: 'text', text: 'Skyr', locale: null },
  parseResult: {
    items: [previewItem.item],
    unparsedText: null,
  },
  items: [previewItem],
  learningProgress: { uniqueAssignments: 0, thresholdReached: false },
};

describe('NaturalLanguageAdditionSwiftUIPreviewContent', () => {
  it('keeps other item selections when a single name is corrected', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const other = {
      ...previewItem,
      itemId: 'session-1:item:1',
      item: { ...previewItem.item, name: 'Brot' },
    };
    const props = { onRequestClose: jest.fn(), onEditText: jest.fn(), onConfirm };
    await render(
      <NaturalLanguageAdditionSwiftUIPreviewContent
        {...props}
        preview={{ ...preview, items: [previewItem, other] }}
      />,
    );
    await user.press(screen.getAllByRole('button', { name: 'Aldi' })[1]);
    await screen.rerender(
      <NaturalLanguageAdditionSwiftUIPreviewContent
        {...props}
        preview={{
          ...preview,
          items: [{ ...previewItem, item: { ...previewItem.item, name: 'Skyr natur' } }, other],
        }}
      />,
    );
    await user.press(screen.getByRole('button', { name: '1 Artikel hinzufügen' }));
    expect(onConfirm).toHaveBeenCalledWith([{ itemId: other.itemId, targetListId: 'aldi-list' }]);
  });

  it('shows unparsed text and removes the warning after a corrected preview arrives', async () => {
    const user = userEvent.setup();
    const onEditText = jest.fn();
    const onConfirm = jest.fn();
    const props = { onRequestClose: jest.fn(), onEditText, onConfirm };
    await render(
      <NaturalLanguageAdditionSwiftUIPreviewContent
        {...props}
        preview={{
          ...preview,
          input: { ...preview.input, text: 'Skyr, ???' },
          parseResult: { ...preview.parseResult, unparsedText: '???' },
        }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Noch nicht erkannt: ???');
    const transcript = screen.getByLabelText('Erkannter Text');
    await user.clear(transcript);
    await user.type(transcript, 'Skyr');
    await user.press(screen.getByRole('button', { name: 'Neu prüfen' }));
    expect(onEditText).toHaveBeenCalledWith('Skyr');
    expect(onConfirm).not.toHaveBeenCalled();
    await screen.rerender(
      <NaturalLanguageAdditionSwiftUIPreviewContent {...props} preview={preview} />,
    );
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('requires an explicit action to remember a name and allows one-off corrections', async () => {
    const user = userEvent.setup();
    const onCorrectName = jest.fn();
    await render(
      <NaturalLanguageAdditionSwiftUIPreviewContent
        preview={preview}
        onRequestClose={jest.fn()}
        onEditText={jest.fn()}
        onConfirm={jest.fn()}
        onCorrectName={onCorrectName}
      />,
    );
    await user.press(screen.getByRole('button', { name: 'Name korrigieren' }));
    const name = screen.getByLabelText('Artikelname');
    await user.clear(name);
    await user.type(name, 'Skyr natur');
    expect(onCorrectName).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Nur übernehmen' }));
    expect(onCorrectName).toHaveBeenLastCalledWith(previewItem.itemId, 'Skyr natur', false);
    await user.press(screen.getByRole('button', { name: 'Übernehmen und merken' }));
    expect(onCorrectName).toHaveBeenLastCalledWith(previewItem.itemId, 'Skyr natur', true);
  });

  it('offers remembered corrections without applying them and lets users forget any entry', async () => {
    const user = userEvent.setup();
    const onCorrectName = jest.fn();
    const onForgetCorrection = jest.fn();
    await render(
      <NaturalLanguageAdditionSwiftUIPreviewContent
        preview={preview}
        onRequestClose={jest.fn()}
        onEditText={jest.fn()}
        onConfirm={jest.fn()}
        nameCorrections={[
          { original: 'skyr', corrected: 'Skyr natur' },
          { original: 'Ski er', corrected: 'Skyr' },
        ]}
        onCorrectName={onCorrectName}
        onForgetCorrection={onForgetCorrection}
      />,
    );
    expect(onCorrectName).not.toHaveBeenCalled();
    expect(screen.getByText('Skyr')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Vorschlag übernehmen: Skyr natur' }));
    expect(onCorrectName).toHaveBeenCalledWith(previewItem.itemId, 'Skyr natur', false);
    await user.press(screen.getByRole('button', { name: 'Gemerkte Korrekturen (2)' }));
    await user.press(screen.getByRole('button', { name: 'Ski er: Korrektur vergessen' }));
    expect(onForgetCorrection).toHaveBeenCalledWith('Ski er');
  });

  it('keeps the preview header outside the scrollable content', async () => {
    await render(
      <NaturalLanguageAdditionSwiftUIPreviewContent
        preview={preview}
        onRequestClose={jest.fn()}
        onEditText={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    const scroll = screen.getByTestId('natural-language-addition-preview-scroll');
    const title = screen.getByText('Passt das so?');

    expect(title).toBeOnTheScreen();
    expect(within(scroll).queryByText('Passt das so?')).not.toBeOnTheScreen();
  });

  it('forwards the selected real shopping list when confirming an unclear item', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    await render(
      <NaturalLanguageAdditionSwiftUIPreviewContent
        preview={preview}
        onRequestClose={jest.fn()}
        onEditText={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Aldi' }));
    expect(screen.getByRole('button', { name: 'Aldi' })).toHaveProp('accessibilityState', {
      selected: true,
    });

    await user.press(screen.getByRole('button', { name: '1 Artikel hinzufügen' }));

    expect(onConfirm).toHaveBeenCalledWith([
      { itemId: 'session-1:item:0', targetListId: 'aldi-list' },
    ]);
  });

  it('forwards trimmed edited transcript text when rechecking', async () => {
    const user = userEvent.setup();
    const onEditText = jest.fn();

    await render(
      <NaturalLanguageAdditionSwiftUIPreviewContent
        preview={preview}
        onRequestClose={jest.fn()}
        onEditText={onEditText}
        onConfirm={jest.fn()}
      />,
    );

    const transcript = screen.getByLabelText('Erkannter Text');
    await user.clear(transcript);
    await user.type(transcript, '  Milch und Brot  ');
    await user.press(screen.getByRole('button', { name: 'Neu prüfen' }));

    expect(onEditText).toHaveBeenCalledWith('Milch und Brot');
  });
});
