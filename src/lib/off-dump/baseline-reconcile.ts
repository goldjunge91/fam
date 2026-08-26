export type ReconcileAction =
  | { kind: 'move'; from: 'next' | 'recovery'; to: 'active' }
  | { kind: 'delete'; file: 'next' | 'recovery' };

export function reconcileBaselineState(state: {
  active: boolean;
  next: boolean;
  recovery: boolean;
}): ReconcileAction[] {
  const { active, next, recovery } = state;

  // Normalzustand oder frische Installation.
  if (!next && !recovery) return [];

  // Swap abgeschlossen, nur recovery muss noch entfernt werden.
  if (active && !next && recovery) {
    return [{ kind: 'delete', file: 'recovery' }];
  }

  // Der geprüfte next-Stand kann den Swap sicher abschließen.
  if (!active && next && recovery) {
    return [
      { kind: 'move', from: 'next', to: 'active' },
      { kind: 'delete', file: 'recovery' },
    ];
  }

  // next ging verloren: zum letzten guten Stand zurückkehren.
  if (!active && !next && recovery) {
    return [{ kind: 'move', from: 'recovery', to: 'active' }];
  }

  // active bleibt autoritativ; ein nicht aktivierter next-Download wird verworfen.
  const actions: ReconcileAction[] = [{ kind: 'delete', file: 'next' }];
  if (recovery) actions.push({ kind: 'delete', file: 'recovery' });
  return actions;
}
