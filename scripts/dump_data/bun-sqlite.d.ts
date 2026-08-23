/**
 * Minimale Ambient-Deklaration für `bun:sqlite`, beschränkt auf die
 * Oberfläche, die `evaluate-categories.ts` tatsächlich nutzt.
 *
 * Bewusst KEIN `@types/bun`: das Paket deklariert zusätzlich globale
 * Web-APIs (u.a. ein inkompatibles `fetch`/`preconnect`), die projektweit
 * mit den vorhandenen DOM-/Node-Typen kollidieren, sobald `types` in
 * `tsconfig.json` es aufnimmt (bricht z.B. `src/lib/sync/server-clock.ts`).
 * Dieses Modul wird nur von Bun selbst zur Laufzeit aufgelöst — `tsc
 * --noEmit` sieht ausschließlich diese lokale Deklaration.
 */
declare module 'bun:sqlite' {
  export class Database {
    constructor(filename: string, options?: { readonly?: boolean; create?: boolean });
    query<T = unknown>(
      sql: string,
    ): {
      all(...params: unknown[]): T[];
      get(...params: unknown[]): T | null;
      run(...params: unknown[]): void;
    };
    exec(sql: string): void;
    close(): void;
  }
}
