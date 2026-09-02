import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schemaPath = new URL('./schemas/weekly-waste-checkin.schema.json', import.meta.url);

function readSchema() {
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}

test('weekly waste check-in schema is a strict, separate contract', () => {
  const schema = readSchema();

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    'household_id',
    'week_start',
    'reported_waste_quantity',
    'reported_waste_unit',
    'submitted_at',
  ]);
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    'household_id',
    'notes',
    'reported_waste_quantity',
    'reported_waste_unit',
    'submitted_at',
    'week_start',
  ]);

  assert.equal(schema.properties.week_start.format, 'date');
  assert.equal(schema.properties.submitted_at.format, 'date-time');
  assert.equal(schema.properties.reported_waste_quantity.minimum, 0);
  assert.deepEqual(schema.properties.reported_waste_unit.enum, [
    'g',
    'kg',
    'ml',
    'l',
    'piece',
    'package',
    'portion',
  ]);
  assert.equal(schema.properties.notes.type, 'string');

  const serializedSchema = JSON.stringify(schema);
  for (const forbiddenField of [
    'recipe_id',
    'inventory_item_id',
    'model',
    'model_id',
    'model_generated',
    'waste_event_id',
  ]) {
    assert.equal(
      serializedSchema.includes(forbiddenField),
      false,
      `weekly check-in must not contain ${forbiddenField}`,
    );
  }
});
