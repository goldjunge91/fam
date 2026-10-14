import { render, screen } from '@testing-library/react-native';
import { formatBytes, formatZeitpunkt, Zeile } from './dev-screen-shared';

describe('dev screen helpers', () => {
  it.each([0, -10])('formats non-positive byte counts as empty size: %s', (bytes) => {
    expect(formatBytes(bytes)).toBe('0 MB');
  });

  it('formats positive byte counts in megabytes', () => {
    expect(formatBytes(524_288)).toBe('0.5 MB');
    expect(formatBytes(1_048_576)).toBe('1.0 MB');
  });

  it('formats absent, valid, and invalid timestamps', () => {
    expect(formatZeitpunkt(null)).toBe('—');
    const formatted = formatZeitpunkt('2026-01-15T10:00:00.000Z');
    expect(formatted).not.toBe('2026-01-15T10:00:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatZeitpunkt('not a timestamp')).toBe('not a timestamp');
  });

  it('renders a value with the selected tone or the primary default', async () => {
    await render(
      <>
        <Zeile label="Status" wert="Achtung" tone="warning" />
        <Zeile label="Standard" wert="Bereit" />
      </>,
    );

    expect(screen.getByText('Achtung')).toBeOnTheScreen();
    expect(screen.getByText('Bereit')).toBeOnTheScreen();
  });
});
