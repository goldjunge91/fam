// Stellvertreter fuer einen extern ausgeloesten SDK-Listener.
export type StatusListener = (status: string) => void;

export function onStatusChange(_listener: StatusListener): () => void {
  return () => {};
}
