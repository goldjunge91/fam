import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Konventionsprüfung statt Screen-Test: FlashList ist laut AGENTS.md die
// alleinige virtualisierte Listen-Implementierung dieser App (#139). Ein
// neuer `FlatList`-Import fällt hier auf, egal in welchem Feature er landet.
// `git grep` statt Dateibaum-Walk: respektiert .gitignore und ist schnell.
function gitGrep(pattern: string) {
  try {
    return execFileSync('git', ['grep', '-n', '-E', pattern, '--', ':(glob)src/**/*.ts', ':(glob)src/**/*.tsx'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    // git grep beendet sich mit Exit-Code 1, wenn es keine Treffer gibt.
    return [];
  }
}

describe('Listen-Konvention', () => {
  it('nutzt nirgends mehr FlatList aus react-native', () => {
    // Import und JSX-Verwendung statt jeder Erwaehnung: Kommentare duerfen
    // weiterhin auf die frueher genutzte FlatList verweisen.
    const hits = gitGrep('^import .*FlatList|<FlatList');

    expect(hits).toEqual([]);
  });
});
