import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ExamplePanel } from './showcase-shared';

it('renders a neutral panel without optional code content', async () => {
  await render(
    <ExamplePanel kind="neutral" label="Hinweis">
      <Text>Neutrale Information</Text>
    </ExamplePanel>,
  );

  expect(screen.getByText('Hinweis')).toBeOnTheScreen();
  expect(screen.getByText('Neutrale Information')).toBeOnTheScreen();
  expect(screen.queryByText(/Codebeispiel:/)).toBeNull();
});
