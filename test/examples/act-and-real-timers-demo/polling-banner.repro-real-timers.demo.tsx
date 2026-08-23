import { render, screen } from '@testing-library/react-native';
import { PollingBanner } from './polling-banner';

// Reproduktion: Ein 500-ms-Timeout endet vor dem echten 3-s-Poll.
test('REPRODUKTION: echte Timer machen den Test langsam und wall-clock-abhaengig', async () => {
  await render(<PollingBanner intervalMs={3000} />);

  const start = Date.now();
  await expect(
    screen.findByText('1', {}, { timeout: 500 }),
  ).rejects.toThrow();
  const elapsedMs = Date.now() - start;

  // Der Nachweis erfordert rund 500 ms echte Wanduhrzeit.
  expect(elapsedMs).toBeGreaterThanOrEqual(450);
});
