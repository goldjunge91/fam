import { celebrate as hapticCelebrate } from './haptics';

export type CelebrationBurst = {
  id: number;
  message?: string;
};

type CelebrationListener = (burst: CelebrationBurst) => void;

let nextCelebrationId = 0;
const listeners = new Set<CelebrationListener>();

export function subscribeToCelebrations(listener: CelebrationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Löst die sichtbare und taktile Celebration für einen erreichten Meilenstein aus. */
export function celebrate(message?: string): void {
  try {
    hapticCelebrate();
  } catch {
    // Eine nicht verfügbare Haptik darf die sichtbare Celebration nicht blockieren.
  }

  const burst = { id: ++nextCelebrationId, message };
  for (const listener of listeners) listener(burst);
}
