import { render, screen } from '@testing-library/react-native';
import { ShadowsShowcase } from './showcase-shadows';

it('renders dashboard, glass-card, and sheet shadow examples', async () => {
  await render(<ShadowsShowcase />);

  expect(screen.getByText('Schatten in der App')).toBeOnTheScreen();
  expect(screen.getByText('DashboardCardShell')).toBeOnTheScreen();
  expect(screen.getByText('GlassCard mit expliziter Auswahl')).toBeOnTheScreen();
  expect(screen.getByText('Normale Karte')).toBeOnTheScreen();
  expect(screen.getByText('Prominente Karte')).toBeOnTheScreen();
  expect(screen.getByText('Von unten kommendes Sheet')).toBeOnTheScreen();
});
