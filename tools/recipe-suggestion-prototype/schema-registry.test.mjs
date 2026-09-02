import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const schemaDirectory = join(dirname(fileURLToPath(import.meta.url)), 'schemas');

test('alle Prototyp-Schemas haben einen stabilen, geschlossenen Vertrag', () => {
  const schemaFiles = readdirSync(schemaDirectory).filter((file) => file.endsWith('.schema.json'));
  const schemas = schemaFiles.map((file) => ({
    file,
    schema: JSON.parse(readFileSync(join(schemaDirectory, file), 'utf8')),
  }));

  assert.ok(schemas.length >= 4);
  assert.equal(new Set(schemas.map(({ schema }) => schema.$id)).size, schemas.length);

  for (const { file, schema } of schemas) {
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', file);
    assert.equal(schema.type, 'object', file);
    assert.equal(schema.additionalProperties, false, file);
    assert.equal(typeof schema.title, 'string', file);
  }
});
