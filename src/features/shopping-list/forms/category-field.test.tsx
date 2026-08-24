import { render, screen, userEvent } from '@testing-library/react-native';

import { CategoryField } from './category-field';

describe('CategoryField', () => {
  it('zeigt nur den aktuellen Einkaufsbereich ohne internen Herkunftsstatus', async () => {
    await render(
      <CategoryField
        categoryId="meat_poultry"
        source="name_fallback"
        onSelectCategory={jest.fn()}
        onReset={jest.fn()}
      />,
    );

    expect(screen.getByText('Fleisch & Geflügel')).toBeOnTheScreen();
    expect(screen.queryByText('automatisch · Name')).not.toBeOnTheScreen();
  });

  it('zeigt die kanonische Sonstiges-Zone ohne internen Herkunftsstatus', async () => {
    await render(
      <CategoryField
        categoryId={null}
        source="user"
        onSelectCategory={jest.fn()}
        onReset={jest.fn()}
      />,
    );

    expect(screen.getByText('Sonstiges')).toBeOnTheScreen();
    expect(screen.queryByText('bewusst „Sonstiges“')).not.toBeOnTheScreen();
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

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Wasser, Saft & Softdrinks' }));

    expect(onSelectCategory).toHaveBeenCalledWith('cold_drinks');
  });

  it('ruft onReset bei Auswahl von "Automatisch" auf', async () => {
    const user = userEvent.setup();
    const onReset = jest.fn();
    await render(
      <CategoryField
        categoryId="cold_drinks"
        source="user"
        onSelectCategory={jest.fn()}
        onReset={onReset}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    await user.press(screen.getByRole('button', { name: 'Automatisch' }));

    expect(onReset).toHaveBeenCalled();
  });

  it('ruft onSelectCategory mit der kanonischen Other-Zone auf', async () => {
    const user = userEvent.setup();
    const onSelectCategory = jest.fn();
    await render(
      <CategoryField
        categoryId="chilled_dairy_eggs"
        source="name_fallback"
        onSelectCategory={onSelectCategory}
        onReset={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: /Einkaufsbereich:/ }));
    const otherOptions = screen.getAllByRole('button', { name: 'Sonstiges' });
    await user.press(otherOptions[otherOptions.length - 1]);

    expect(onSelectCategory).toHaveBeenCalledWith('other');
  });
});
