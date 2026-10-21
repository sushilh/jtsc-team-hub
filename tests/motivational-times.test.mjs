import assert from "node:assert/strict";
import test from "node:test";
import rows from "../lib/motivational-times-data.json" with { type: "json" };
import { getMotivationalSeries, motivationalAgeGroup } from "../lib/motivational-times.mjs";
import { getQualifyingSeries, parseSwimTime } from "../lib/state-qualifying-times.mjs";

test("PDF individual events cover every age group and pool, with six ordered levels for both genders", () => {
  assert.equal(rows.length, 241);
  const keys = new Set();
  for (const [age, course, stroke, distance, girls, boys] of rows) {
    const key = `${age}:${course}:${stroke}:${distance}`;
    assert.ok(!keys.has(key), key);
    keys.add(key);
    for (const times of [girls, boys]) {
      assert.equal(times.length, 6, key);
      const seconds = times.map(parseSwimTime);
      assert.ok(seconds.every((value) => value !== null), key);
      assert.ok(seconds.every((value, index) => !index || value < seconds[index - 1]), key);
    }
  }
});

test("boys and girls times follow B to AAAA order from the source PDF", () => {
  const times = (gender) => getMotivationalSeries({ age: 10, gender, stroke: "Free", course: "SCY" }).map((level) => level.points.find((p) => p.distance === 50).timeText);
  assert.deepEqual(times("girls"), ["39.79", "35.99", "32.09", "30.89", "29.59", "28.29"]);
  assert.deepEqual(times("boys"), ["38.19", "34.59", "31.09", "29.89", "28.69", "27.49"]);
});

test("ages map to the PDF brackets and invalid selections fail safely", () => {
  assert.deepEqual([5, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(motivationalAgeGroup), ["10 & under", "10 & under", "11-12", "11-12", "13-14", "13-14", "15-16", "15-16", "17-18", "17-18"]);
  assert.equal(motivationalAgeGroup(19), null);
  assert.deepEqual(getMotivationalSeries({ age: 11, gender: "other", stroke: "Free", course: "SCY" }), []);
});

test("every source event appears in the appropriate course, age, stroke and gender", () => {
  const ages = { "10 & under": 10, "11-12": 11, "13-14": 13, "15-16": 15, "17-18": 17 };
  const strokes = { FR: "Free", BK: "Back", BR: "Breast", FL: "Fly", IM: "IM" };
  for (const [age, course, stroke, distance, girls, boys] of rows) {
    for (const [gender, expected] of [["girls", girls], ["boys", boys]]) {
      const levels = getMotivationalSeries({ age: ages[age], gender, stroke: strokes[stroke], course });
      assert.deepEqual(levels.map((level) => level.points.find((p) => p.distance === distance)?.timeText), expected);
    }
  }
});

test("motivational standards do not change qualifying standards; no invented 100 IM in LCM", () => {
  const params = { age: 10, gender: "girls", stroke: "IM", course: "LCM" };
  assert.ok(getMotivationalSeries(params).every((level) => level.points.every((point) => point.distance !== 100)));
  assert.ok(getQualifyingSeries(params).every((level) => !level.id.startsWith("motivational-")));
});
