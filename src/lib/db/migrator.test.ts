import { MIGRATIONS } from '@/lib/db/migrations';
import { assertMigrationSequence, planMigrations } from '@/lib/db/migrator';
import type { Migration } from '@/lib/db/types';

const migration = (version: number): Migration => ({
  version,
  name: `m${version}`,
  statements: ['select 1'],
});

describe('planMigrations', () => {
  const all = [migration(1), migration(2), migration(3)];

  it('wendet auf einer frischen Datenbank (user_version 0) alle Migrationen an', () => {
    expect(planMigrations(0, all).map((m) => m.version)).toEqual([1, 2, 3]);
  });

  it('laesst beim zweiten App-Start nichts mehr uebrig — es wird nicht erneut migriert', () => {
    expect(planMigrations(3, all)).toEqual([]);
  });

  it('wendet nach einem Update nur die neu hinzugekommenen Migrationen an', () => {
    expect(planMigrations(1, all).map((m) => m.version)).toEqual([2, 3]);
  });

  it('migriert nicht rueckwaerts, wenn die Datenbank neuer ist als der Code', () => {
    expect(planMigrations(99, all)).toEqual([]);
  });

  it('gibt eine leere Liste zurueck, wenn es gar keine Migrationen gibt', () => {
    expect(planMigrations(0, [])).toEqual([]);
  });
});

describe('assertMigrationSequence', () => {
  it('akzeptiert eine lueckenlose Folge ab 1', () => {
    expect(() => assertMigrationSequence([migration(1), migration(2)])).not.toThrow();
  });

  it('akzeptiert eine leere Liste', () => {
    expect(() => assertMigrationSequence([])).not.toThrow();
  });

  it('lehnt eine Luecke ab', () => {
    expect(() => assertMigrationSequence([migration(1), migration(3)])).toThrow(/Version 2/);
  });

  it('lehnt eine doppelte Version ab', () => {
    expect(() => assertMigrationSequence([migration(1), migration(1)])).toThrow(/Version 2/);
  });

  it('lehnt eine Folge ab, die nicht bei 1 beginnt', () => {
    expect(() => assertMigrationSequence([migration(0)])).toThrow(/Version 1/);
  });

  it('lehnt eine nicht ganzzahlige Version ab', () => {
    expect(() => assertMigrationSequence([migration(1.5)])).toThrow(/ganzzahlige/);
  });
});

describe('MIGRATIONS', () => {
  it('ist eine gueltige Folge — sonst wirft jeder App-Start beim Oeffnen der Datenbank', () => {
    expect(() => assertMigrationSequence(MIGRATIONS)).not.toThrow();
  });

  it('enthaelt mindestens die Ausgangsversion', () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(1);
  });
});
