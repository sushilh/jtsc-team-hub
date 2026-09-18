import assert from "node:assert/strict";
import test from "node:test";
import { formatSwimTime, getQualifyingSeries, getTeamRecords, parseSwimTime, standardsForAge } from "../lib/state-qualifying-times.mjs";

test("swim time parsing round-trips both mm:ss.hh and ss.hh forms", () => {
  assert.equal(parseSwimTime("1:09.99"), 69.99);
  assert.equal(parseSwimTime("53.79"), 53.79);
  assert.equal(formatSwimTime(69.99), "1:09.99");
  assert.equal(formatSwimTime(53.79), "53.79");
  assert.equal(formatSwimTime(parseSwimTime("22:53.09")), "22:53.09");
});

test("an 8-year-old sees the 10-Under and 14-Under-family standards, not Regional-15-19 or Senior", () => {
  const ids = standardsForAge(8).map((standard) => standard.id);
  assert.deepEqual(ids, ["10u-state", "14u-state", "regional"]);
});

test("a 13-year-old sees all four age-group standards that apply, in fixed color order", () => {
  const standards = standardsForAge(13);
  assert.deepEqual(standards.map((standard) => standard.id), ["14u-state", "regional", "11o-state-lc", "sr-state"]);
  // Order (and therefore color) must not depend on which standards are present —
  // Regional is always slot 3's color regardless of the age queried.
  assert.equal(standards.find((standard) => standard.id === "regional").color, "#4db6a0");
});

test("a 6-year-old sees 10-Under, 14-Under (8-Under bracket), and Regional 10-Under, never Senior", () => {
  const ids = standardsForAge(6).map((standard) => standard.id);
  assert.ok(!ids.includes("sr-state"));
  assert.deepEqual(ids, ["10u-state", "14u-state", "regional"]);
});

test("getQualifyingSeries returns one series per applicable standard, sorted by distance, SCY course", () => {
  const series = getQualifyingSeries({ age: 12, gender: "girls", stroke: "Free", course: "SCY" });
  assert.deepEqual(series.map((item) => item.id), ["14u-state", "regional", "11o-state-lc", "sr-state"]);
  const fourteenU = series.find((item) => item.id === "14u-state");
  assert.deepEqual(fourteenU.points.map((point) => point.distance), [50, 100, 200, 500]);
  assert.equal(fourteenU.points[0].timeText, "31.09");
});

test("times increase monotonically with distance within a stroke/standard/course (catches row transposition)", () => {
  for (const age of [8, 10, 12, 14, 17]) {
    for (const gender of ["girls", "boys"]) {
      for (const stroke of ["Free", "Back", "Breast", "Fly", "IM"]) {
        for (const course of ["SCY", "SCM", "LCM"]) {
          const series = getQualifyingSeries({ age, gender, stroke, course });
          for (const item of series) {
            for (let i = 1; i < item.points.length; i += 1) {
              assert.ok(
                item.points[i].seconds > item.points[i - 1].seconds,
                `${item.id} ${gender} ${stroke} ${course} age ${age}: ${item.points[i - 1].distance} (${item.points[i - 1].timeText}) should be faster than ${item.points[i].distance} (${item.points[i].timeText})`,
              );
            }
          }
        }
      }
    }
  }
});

test("the 11-12 and 13-14 age-group cuts agree across the documents that both publish them", () => {
  const fourteenU1112 = getQualifyingSeries({ age: 11, gender: "boys", stroke: "IM", course: "LCM" })
    .find((item) => item.id === "14u-state");
  const elevenOver1112 = getQualifyingSeries({ age: 11, gender: "boys", stroke: "IM", course: "LCM" })
    .find((item) => item.id === "11o-state-lc");
  assert.deepEqual(fourteenU1112.points, elevenOver1112.points);

  const elevenOver15 = getQualifyingSeries({ age: 15, gender: "girls", stroke: "Breast", course: "SCM" })
    .find((item) => item.id === "11o-state-lc");
  const srState15 = getQualifyingSeries({ age: 15, gender: "girls", stroke: "Breast", course: "SCM" })
    .find((item) => item.id === "sr-state");
  assert.deepEqual(elevenOver15.points, srState15.points);
});

test("a stroke/course combination with no data (e.g. 100 IM in LCM) returns no points, not a crash", () => {
  const series = getQualifyingSeries({ age: 9, gender: "girls", stroke: "IM", course: "LCM" });
  for (const item of series) assert.ok(item.points.every((point) => point.distance !== 100));
});

test("team records only exist for SCY and include the 25-yard sprints the OKS standards skip", () => {
  const scy = getTeamRecords({ age: 8, gender: "boys", stroke: "Free", course: "SCY" });
  assert.deepEqual(scy.map((r) => r.distance), [25, 50, 100, 200, 500]);
  assert.equal(scy[0].timeText, "16.87");
  assert.deepEqual(getTeamRecords({ age: 8, gender: "boys", stroke: "Free", course: "LCM" }), []);
  assert.deepEqual(getTeamRecords({ age: 8, gender: "boys", stroke: "Free", course: "SCM" }), []);
});

test("a blank record cell (nobody has swum it yet) is omitted, not a fake zero", () => {
  const records = getTeamRecords({ age: 6, gender: "boys", stroke: "Free", course: "SCY" });
  assert.deepEqual(records.map((r) => r.distance), [25, 50, 100]);
});

test("team record age brackets are tight two-year bands, distinct from the wider OKS brackets", () => {
  assert.deepEqual(getTeamRecords({ age: 8, gender: "girls", stroke: "Back", course: "SCY" }).map((r) => r.timeText), ["17.62", "35.69", "1:18.77"]);
  assert.deepEqual(getTeamRecords({ age: 9, gender: "girls", stroke: "Back", course: "SCY" }).map((r) => r.timeText), ["17.41", "32.13", "1:12.07", "2:52.48"]);
});

test("team records also get faster with age and with distance (catches a transposed row)", () => {
  for (const gender of ["girls", "boys"]) {
    for (const stroke of ["Free", "Back", "Breast", "Fly", "IM"]) {
      const records = getTeamRecords({ age: 17, gender, stroke, course: "SCY" });
      for (let i = 1; i < records.length; i += 1) {
        assert.ok(records[i].seconds > records[i - 1].seconds,
          `${gender} ${stroke}: ${records[i - 1].distance} (${records[i - 1].timeText}) should be faster than ${records[i].distance} (${records[i].timeText})`);
      }
    }
  }
});
