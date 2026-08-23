import { render, screen, userEvent } from '@testing-library/react-native';

import { CategoryField } from './category-field';

describe('CategoryField', () => {
  it('zeigt die aktuelle Kategorie mit ihrer automatischen Herkunft', async () => {
    await render(
      <CategoryField
        categoryId="meat_poultry"
        source="name_fallback"
        onSelectCategory={jest.fn()}
        onReset={jest.fn()}
      />,
    );

    expect(screen.getByText('Fleisch & Geflügel')).toBeOnTheScreen();
    expect(screen.getByText('automatisch · Name')).toBeOnTheScreen();
  });

  it('zeigt bewusstes "Sonstiges" getrennt von "kein Vorschlag"', async () => {
    await render(
      <CategoryField
        categoryId={null}
        source="user"
        onSelectCategory={jest.fn()}
        onReset={jest.fn()}
      />,
    );

    expect(screen.getByText('Sonstiges')).toBeOnTheScreen();
    expect(screen.getByText('bewusst „Sonstiges“')).toBeOnTheScreen();
  });

  it('öffnet die Liste und ruft onSelectCategory bei Auswahl einer Kategorie auf', async () => {
    const user = userEvent.setup();
    const onSelectCategory = jest.fn();
    await render(
      <CategoryField
        categoryId={null}
        source={null}
        onSelectCategory={onSelectCategory}
        onReset={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Getränke' }));

    expect(onSelectCategory).toHaveBeenCalledWith('beverages');
  });

  it('ruft onReset bei Auswahl von "Automatisch" auf', async () => {
    const user = userEvent.setup();
    const onReset = jest.fn();
    await render(
      <CategoryField
        categoryId="beverages"
        source="user"
        onSelectCategory={jest.fn()}
        onReset={onReset}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Automatisch' }));

    expect(onReset).toHaveBeenCalled();
  });

  it('ruft onSelectCategory mit null bei Auswahl von "Sonstiges" auf', async () => {
    const user = userEvent.setup();
    const onSelectCategory = jest.fn();
    await render(
      <CategoryField
        categoryId="dairy"
        source="name_fallback"
        onSelectCategory={onSelectCategory}
        onReset={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Kategorie:/ }));
    await user.press(screen.getByRole('button', { name: 'Sonstiges' }));

    expect(onSelectCategory).toHaveBeenCalledWith(null);
  });
});
