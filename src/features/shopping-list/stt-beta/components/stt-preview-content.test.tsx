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
