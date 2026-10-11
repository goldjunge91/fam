import { render, screen } from '@testing-library/react-native';
import { ComponentsShowcase } from './showcase-components.web';

it('renders the selected component category in the web reference', async () => {
  await render(<ComponentsShowcase category="controls" />);

  expect(screen.getByText('Komponenten')).toBeOnTheScreen();
  expect(screen.getByText(/Kategorie: controls/)).toBeOnTheScreen();
});
