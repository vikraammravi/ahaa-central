import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/pickup.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: api });

const lines = [{ id: "item", fulfilled_quantity: 3, quantity: 5 }];
test("matching pickup needs no approval, including unchanged defaults", () => {
  assert.equal(api.pickupHasChanges(lines, { item: 3 }), false);
  assert.equal(api.pickupHasChanges(lines, {}), false);
});
test("extra and reduced pickup both require review", () => {
  assert.equal(api.pickupHasChanges(lines, { item: 5 }), true);
  assert.equal(api.pickupHasChanges(lines, { item: 1 }), true);
});
test("pickup accepts zero and the original request limit", () => {
  assert.equal(api.pickupQuantitiesValid(lines, { item: 0 }), true);
  assert.equal(api.pickupQuantitiesValid(lines, { item: 5 }), true);
});
test("pickup rejects fractional, negative, excessive, and non-finite values", () => {
  for (const value of [1.5, -1, 6, NaN, Infinity]) {
    assert.equal(api.pickupQuantitiesValid(lines, { item: value }), false);
  }
  assert.equal(api.pickupQuantitiesValid([], {}), false);
});
