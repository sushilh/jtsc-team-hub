import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const accounts = JSON.parse(readFileSync(fileURLToPath(new URL("../lib/achievement-accounts.json", import.meta.url)), "utf8"));

test("achievement swimmer selector contains only unique Account Name entries", () => {
  assert.equal(accounts.length, 167);
  assert.equal(new Set(accounts).size, accounts.length);
  assert.equal(accounts[0], "Abrol, Nitin");
  assert.equal(accounts.at(-1), "Zhang, Hongmin");
  for (const account of accounts) {
    assert.equal(typeof account, "string");
    assert.ok(account.trim());
    assert.doesNotMatch(account, /@|\d/);
  }
});
