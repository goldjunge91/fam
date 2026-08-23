import { reconcileBaselineState } from './baseline-reconcile';

describe('reconcileBaselineState', () => {
  it('Normalzustand (nur active): keine Aktion', () => {
    expect(reconcileBaselineState({ active: true, next: false, recovery: false })).toEqual([]);
  });

  it('frischer Erstinstall (nichts existiert): keine Aktion', () => {
    expect(reconcileBaselineState({ active: false, next: false, recovery: false })).toEqual([]);
  });

  it('active + next (Absturz waehrend Download/Verifikation vor dem Swap): next verwerfen, active bleibt unangetastet', () => {
    expect(reconcileBaselineState({ active: true, next: true, recovery: false })).toEqual([
      { kind: 'delete', file: 'next' },
    ]);
  });

  it('recovery + next, kein active (Absturz zwischen Umbenennen alt->recovery und next->active): Swap zu Ende führen', () => {
    expect(reconcileBaselineState({ active: false, next: true, recovery: true })).toEqual([
      { kind: 'move', from: 'next', to: 'active' },
      { kind: 'delete', file: 'recovery' },
    ]);
  });

  it('nur recovery (Absturz mitten in der Umbenennung next->active, next verloren): auf recovery zurückrollen', () => {
    expect(reconcileBaselineState({ active: false, next: false, recovery: true })).toEqual([
      { kind: 'move', from: 'recovery', to: 'active' },
    ]);
  });

  it('active + recovery, kein next (Swap fertig, nur Aufräumen fehlt): recovery löschen', () => {
    expect(reconcileBaselineState({ active: true, next: false, recovery: true })).toEqual([
      { kind: 'delete', file: 'recovery' },
    ]);
  });

  it('alle drei vorhanden (sollte unter korrekter Reihenfolge nicht vorkommen, defensiv trotzdem behandelt): active vertrauen, Rest verwerfen', () => {
    expect(reconcileBaselineState({ active: true, next: true, recovery: true })).toEqual([
      { kind: 'delete', file: 'next' },
      { kind: 'delete', file: 'recovery' },
    ]);
  });

  it('nur next, kein active/recovery (unbestätigter Erstinstall-Download): verwerfen', () => {
    expect(reconcileBaselineState({ active: false, next: true, recovery: false })).toEqual([
      { kind: 'delete', file: 'next' },
    ]);
  });
});
