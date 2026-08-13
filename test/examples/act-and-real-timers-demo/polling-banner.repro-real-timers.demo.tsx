import { render, screen } from '@testing-library/react-native';
import { PollingBanner } from './polling-banner';

// REPRODUKTION: echte Timer machen die Assertion wall-clock-gebunden statt
// deterministisch. Die Komponente pollt alle 3000ms, wir warten aber nur
// 500ms auf das erste Update -> die Assertion schlaegt zuverlaessig fehl,
// weil das Update schlicht noch nicht passiert ist. Der Test braucht dafuer
// echte 500ms Wanduhrzeit statt 0ms.
test('REPRODUKTION: echte Timer machen den Test langsam und wall-clock-abhaengig', async () => {
  await render(<PollingBanner intervalMs={3000} />);

  const start = Date.now();
  await expect(
    screen.findByText('1', {}, { timeout: 500 }),
  ).rejects.toThrow();
  const elapsedMs = Date.now() - start;

  // Der Test MUSS ~500ms real warten, um das feststellen zu koennen.
  // Bei vielen solcher Tests parallel/unter CPU-Last (siehe jest.config.js:
  // "Default 5000ms ist zu knapp ... sobald alle Suiten gemeinsam um CPU
  // konkurrieren") summiert sich das zu genau dem beobachteten
  // "Jest did not exit"/Timeout-Verhalten.
  expect(elapsedMs).toBeGreaterThanOrEqual(450);
});
