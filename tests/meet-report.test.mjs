import assert from "node:assert/strict";
import test from "node:test";
import { buildCardPrefill, findNotablePerformances, formatEventName, matchRosterName, parseMeetResultsRows, suggestMilestone, toIsoDate } from "../lib/meet-report.mjs";

const HEADER = ["LSC-Team", "Athlete Name", "#ID", "Competitive\nCategory", "Age Group", "Distance", "Stroke", "Trial", "Prelim", "Final", "Final\nPosition", "Event\nAge", "Age", "Date"];

function row({ team = "OK-JTSC", name, category = "Male", ageGroup = "12 & Under", distance, stroke, prelim = "", final, place = "", eventAge, age, date = "09/19/2026" }) {
  return [team, name, "ID123", category, ageGroup, String(distance), stroke, " ", prelim, final, place, String(eventAge), String(age), date];
}

test("parseMeetResultsRows finds the header row itself and skips the title rows before it", () => {
  const rows = [
    ["", "", "Jenks Trojan Swim Club"],
    ["Meet Result - Individual Events"],
    [],
    HEADER,
    row({ name: "Archer, Jonathan G", distance: 50, stroke: "Free", final: "24.08Y", eventAge: 12, age: 12 }),
  ];
  const swims = parseMeetResultsRows(rows);
  assert.equal(swims.length, 1);
  assert.equal(swims[0].athlete, "Archer, Jonathan G");
  assert.equal(swims[0].timeText, "24.08");
  assert.equal(swims[0].course, "SCY");
});

test("parseMeetResultsRows only keeps the requested team, skips Mixed category and DQ/NS", () => {
  const rows = [
    HEADER,
    row({ name: "Someone Else", team: "OK-BAC", distance: 50, stroke: "Free", final: "23.00Y", eventAge: 12, age: 12 }),
    row({ name: "Relay Leadoff", category: "Mixed", distance: 50, stroke: "Free", final: "23.00Y", eventAge: 12, age: 12 }),
    row({ name: "Disqualified, Swimmer", distance: 50, stroke: "Free", final: "DQ", eventAge: 12, age: 12 }),
    row({ name: "NoShow, Swimmer", distance: 50, stroke: "Free", final: "", prelim: "", eventAge: 12, age: 12 }),
    row({ name: "Real, Swim", distance: 50, stroke: "Free", final: "23.00Y", eventAge: 12, age: 12 }),
  ];
  const swims = parseMeetResultsRows(rows);
  assert.deepEqual(swims.map((swim) => swim.athlete), ["Real, Swim"]);
});

test("parseMeetResultsRows prefers Event Age over Age (GoMotion's Age drifts after a birthday)", () => {
  const rows = [HEADER, row({ name: "Hradisky, Livia", distance: 50, stroke: "Back", final: "49.81Y", eventAge: 6, age: 7 })];
  const swims = parseMeetResultsRows(rows);
  assert.equal(swims[0].age, 6);
});

test("parseMeetResultsRows takes the faster of prelim/final and detects LCM from the 'L' suffix", () => {
  const rows = [HEADER, row({ name: "Archer, Jonathan G", distance: 50, stroke: "Free", prelim: "28.00L", final: "27.54L", eventAge: 12, age: 12 })];
  const swims = parseMeetResultsRows(rows);
  assert.equal(swims[0].timeText, "27.54");
  assert.equal(swims[0].course, "LCM");
});

test("findNotablePerformances flags a new SCY team record", () => {
  const rows = [HEADER, row({ name: "Archer, Jonathan G", distance: 50, stroke: "Free", final: "24.08Y", eventAge: 12, age: 12 })];
  const [performance] = findNotablePerformances(parseMeetResultsRows(rows));
  assert.equal(performance.isNewRecord, true);
  assert.equal(performance.oldRecord, "24.54");
  assert.equal(performance.headline, true);
  assert.equal(suggestMilestone(performance), "NEW JTSC TEAM RECORD");
});

test("findNotablePerformances flags a Zone Sectionals cut as headline-worthy even without a new record", () => {
  const rows = [HEADER, row({ name: "Brice, James G", category: "Male", ageGroup: "13 & Over", distance: 50, stroke: "Free", final: "22.04Y", eventAge: 18, age: 18 })];
  const [performance] = findNotablePerformances(parseMeetResultsRows(rows));
  assert.equal(performance.isNewRecord, false);
  assert.ok(performance.standardsMet.some((item) => item.id === "cz-sectionals"));
  assert.equal(performance.headline, true);
  assert.equal(suggestMilestone(performance), "Sectionals");
});

test("findNotablePerformances does not call a merely-Regional-level swim headline-worthy", () => {
  const rows = [HEADER, row({ name: "Slower, Swimmer", distance: 50, stroke: "Free", final: "45.00Y", eventAge: 10, age: 10 })];
  const [performance] = findNotablePerformances(parseMeetResultsRows(rows));
  assert.equal(performance.isNewRecord, false);
  assert.equal(performance.headline, false);
  assert.equal(suggestMilestone(performance), "Season Best");
});

test("formatEventName matches the card studio's own convention", () => {
  assert.equal(formatEventName("Fly", 100, "SCY"), "100Y Butterfly");
  assert.equal(formatEventName("Free", 50, "LCM"), "50M Freestyle");
});

test("matchRosterName ignores a middle initial and spacing differences", () => {
  const roster = ["Archer, Jonathan", "GarciadelaTorre, Carmen"];
  assert.equal(matchRosterName("Archer, Jonathan G", roster), "Archer, Jonathan");
  assert.equal(matchRosterName("Garcia de la Torre, Carmen", roster), "GarciadelaTorre, Carmen");
  assert.equal(matchRosterName("Nobody, Here", roster), null);
});

test("toIsoDate converts MM/DD/YYYY to YYYY-MM-DD for the date input, or empty string if unparseable", () => {
  assert.equal(toIsoDate("09/19/2026"), "2026-09-19");
  assert.equal(toIsoDate("9/5/2026"), "2026-09-05");
  assert.equal(toIsoDate(""), "");
  assert.equal(toIsoDate("not a date"), "");
});

test("buildCardPrefill assembles everything Achievement Studio needs, matching the roster's own spelling", () => {
  const rows = [HEADER, row({ name: "Archer, Jonathan G", distance: 50, stroke: "Free", final: "24.08Y", eventAge: 12, age: 12 })];
  const [performance] = findNotablePerformances(parseMeetResultsRows(rows));
  const prefill = buildCardPrefill(performance, { roster: ["Archer, Jonathan"], meetName: "JTSC Fall Intrasquad" });
  assert.deepEqual(prefill, {
    name: "Archer, Jonathan",
    milestone: "NEW JTSC TEAM RECORD",
    eventName: "50Y Freestyle",
    time: "24.08",
    meetName: "JTSC Fall Intrasquad",
    meetDate: "2026-09-19",
  });
});
