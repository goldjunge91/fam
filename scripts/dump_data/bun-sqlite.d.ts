/** Minimale Deklaration ohne die kollidierenden globalen APIs aus `@types/bun`. */
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
