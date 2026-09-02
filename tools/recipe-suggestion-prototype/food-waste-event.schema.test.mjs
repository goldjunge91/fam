import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(
  new URL("./schemas/food-waste-event.schema.json", import.meta.url),
);

test("Food-Waste-Ereignis-Schema enthält den vollständigen Bestandsvertrag", async () => {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);

  const required = new Set(schema.required);
  for (const field of [
    "household_id",
    "actor_user_id",
    "inventory_item_id",
    "quantity",
    "unit",
    "reason",
    "occurred_at",
  ]) {
    assert.equal(required.has(field), true, `${field} muss Pflichtfeld sein`);
  }

  assert.equal("lot_id" in schema.properties, true);
  assert.equal("product_id" in schema.properties, false);

  assert.equal(schema.properties.quantity.type, "number");
  assert.equal(schema.properties.quantity.exclusiveMinimum, 0);
  assert.deepEqual(schema.properties.reason.enum, [
    "expired",
    "spoiled",
    "leftover",
    "other",
  ]);
  assert.equal(schema.properties.occurred_at.format, "date-time");
});
