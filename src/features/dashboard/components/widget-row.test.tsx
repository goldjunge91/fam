import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { WidgetRow } from './widget-row';

describe('WidgetRow', () => {
  it('ordnet Widgets nebeneinander, wenn die Zeile nicht gestapelt ist', async () => {
    await render(
      <WidgetRow>
        <Text>Erstes Widget</Text>
      </WidgetRow>,
    );

    expect(screen.getByText('Erstes Widget').parent).toHaveStyle({
      flexDirection: 'row',
    });
  });

  it('ordnet Widgets untereinander, wenn stacked aktiviert ist', async () => {
    await render(
      <WidgetRow stacked>
        <Text>Erstes Widget</Text>
      </WidgetRow>,
    );

    expect(screen.getByText('Erstes Widget').parent).toHaveStyle({
      flexDirection: 'column',
    });
  });
});
