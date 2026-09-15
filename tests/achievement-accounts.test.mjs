import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const memberNames = JSON.parse(readFileSync(fileURLToPath(new URL("../lib/achievement-members.json", import.meta.url)), "utf8"));

test("achievement swimmer selector contains only unique Member Name entries", () => {
  assert.equal(memberNames.length, 202);
  assert.equal(new Set(memberNames).size, memberNames.length);
  assert.equal(memberNames[0], "Abrol, Ananya");
  assert.equal(memberNames.at(-1), "Zeiler, Landon");
  for (const memberName of memberNames) {
    assert.equal(typeof memberName, "string");
    assert.ok(memberName.trim());
    assert.doesNotMatch(memberName, /@|\d/);
  }
});
