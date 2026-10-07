// Turns a GoMotion/Hy-Tek "Individual Events" meet-result workbook into notable
// performances (new team records, qualifying standards met) by cross-referencing
// lib/state-qualifying-times.mjs. Pure and tested; no DOM, no network.
import * as XLSX from "xlsx";
import { getQualifyingSeries, getTeamRecords, parseSwimTime, formatSwimTime } from "./state-qualifying-times.mjs";

const STROKE_MAP = { Freestyle: "Free", Backstroke: "Back", Breaststroke: "Breast", Butterfly: "Fly", Free: "Free", Back: "Back", Breast: "Breast", Fly: "Fly", IM: "IM" };
const GENDER_MAP = { Female: "girls", Male: "boys" };
export const STROKE_DISPLAY = { Free: "Freestyle", Back: "Backstroke", Breast: "Breaststroke", Fly: "Butterfly", IM: "IM" };

// Standards worth surfacing by default, fastest/most exclusive first. Anything
// not listed here (Regional, 10/14-Under, 11-Over State) still counts toward
// "standards met" but doesn't make a swim "notable" on its own — those are
// expected to be common and would otherwise flood the results.
const HEADLINE_STANDARDS = ["cz-sectionals", "cz-sectionals-bonus", "sr-state"];

function detectCourse(rawText) {
  const text = String(rawText || "");
  if (/Y/.test(text)) return "SCY";
  if (/L/.test(text)) return "LCM";
  if (/M/.test(text)) return "SCM";
  return null;
}

function parseMeetTime(rawText) {
  const clean = String(rawText || "").trim();
  if (!clean || /^(DQ|NS|SCR)$/i.test(clean)) return null;
  const match = clean.match(/(\d{1,2}:)?\d{1,3}\.\d{2}/);
  if (!match) return null;
  return { seconds: parseSwimTime(match[0]), course: detectCourse(clean) };
}

/**
 * Parses the sheet's raw rows (as `XLSX.utils.sheet_to_json(sheet, { header: 1 })`
 * returns them) into individual swims for one team. Finds the header row itself
 * rather than assuming a fixed offset, since these exports carry a few title
 * rows first. Skips DQ/NS/SCR and relay-style "Mixed" category rows. Prefers
 * the `Event Age` column over `Age` for record/standard eligibility — GoMotion's
 * `Age` looks like it's computed as of export time, not swim time, and drifts
 * by a year for anyone whose birthday fell between the meet and the download
 * (confirmed empirically; see project memory `gomotion-export-event-age`).
 */
export function parseMeetResultsRows(rows, { team = "OK-JTSC" } = {}) {
  const headerIndex = rows.findIndex((row) => String(row?.[0] ?? "").trim() === "LSC-Team");
  if (headerIndex === -1) throw new Error("This doesn't look like a Hy-Tek/GoMotion Individual Events export — no “LSC-Team” header row found.");
  const swims = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || String(row[0] ?? "").trim() !== team) continue;
    const athlete = String(row[1] ?? "").trim();
    if (!athlete) continue;
    const gender = GENDER_MAP[String(row[3] ?? "").trim()];
    if (!gender) continue; // skips "Mixed" relay-leadoff rows, not an individual swim
    const distance = Number(row[5]);
    const stroke = STROKE_MAP[String(row[6] ?? "").trim()];
    if (!stroke || !distance) continue;
    const prelim = parseMeetTime(row[8]);
    const final = parseMeetTime(row[9]);
    const candidates = [prelim, final].filter((value) => value != null);
    if (!candidates.length) continue;
    const best = candidates.reduce((a, b) => (b.seconds < a.seconds ? b : a));
    const age = Number(row[11]) || Number(row[12]);
    if (!age) continue;
    swims.push({
      athlete,
      gender,
      distance,
      stroke,
      course: best.course,
      seconds: best.seconds,
      timeText: formatSwimTime(best.seconds),
      age,
      date: String(row[13] ?? "").trim(),
    });
  }
  return swims;
}

/** Browser/Worker convenience wrapper: reads the raw file bytes straight through. */
export function parseMeetResultsWorkbook(input, options) {
  const workbook = XLSX.read(input, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
  return parseMeetResultsRows(rows, options);
}

/**
 * Cross-references each swim against team records and qualifying standards for
 * its own detected course. A swim with no detected course (an unrecognized time
 * format) is returned with empty record/standard info rather than dropped, so
 * the caller can still show it exists.
 */
export function findNotablePerformances(swims) {
  return swims.map((swim) => {
    if (!swim.course) return { swim, isNewRecord: false, oldRecord: null, standardsMet: [], headline: false };
    const records = getTeamRecords({ age: swim.age, gender: swim.gender, stroke: swim.stroke, course: swim.course });
    const record = records.find((entry) => entry.distance === swim.distance);
    const isNewRecord = Boolean(record && swim.seconds < record.seconds);
    const series = getQualifyingSeries({ age: swim.age, gender: swim.gender, stroke: swim.stroke, course: swim.course });
    const standardsMet = series
      .map((item) => ({ id: item.id, name: item.name, point: item.points.find((point) => point.distance === swim.distance) }))
      .filter((item) => item.point && swim.seconds <= item.point.seconds)
      .map((item) => ({ id: item.id, name: item.name, cutTimeText: item.point.timeText }));
    const headline = isNewRecord || standardsMet.some((item) => HEADLINE_STANDARDS.includes(item.id));
    return { swim, isNewRecord, oldRecord: record?.timeText ?? null, standardsMet, headline };
  });
}

/** One of CardStudio's eight milestone preset labels, as a best-effort default. */
export function suggestMilestone(performance) {
  if (performance.isNewRecord) return "NEW JTSC TEAM RECORD";
  if (performance.standardsMet.some((item) => item.id === "cz-sectionals" || item.id === "cz-sectionals-bonus")) return "Sectionals";
  return "Season Best";
}

export function formatEventName(stroke, distance, course) {
  const suffix = course === "SCY" ? "Y" : "M";
  return `${distance}${suffix} ${STROKE_DISPLAY[stroke] ?? stroke}`;
}

function normalizeName(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z,]/g, "");
}

/**
 * Matches a meet-result "Last, First Middle" name against the achievement-card
 * roster ("Last, First"), ignoring a middle initial/name and any spacing
 * differences (e.g. "GarciadelaTorre, Carmen" vs "Garcia de la Torre, Carmen").
 * Returns the roster's own spelling, or null if nothing matches.
 */
export function matchRosterName(meetName, roster) {
  const [last, rest] = String(meetName ?? "").split(",").map((part) => part.trim());
  if (!last) return null;
  const first = (rest ?? "").split(/\s+/)[0] ?? "";
  const candidate = normalizeName(`${last},${first}`);
  return roster.find((entry) => normalizeName(entry) === candidate) ?? null;
}

/** "09/19/2026" -> "2026-09-19", for the achievement card's `<input type="date">`. */
export function toIsoDate(mmddyyyy) {
  const match = String(mmddyyyy ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Everything Achievement Studio needs to prefill a card for one notable performance. */
export function buildCardPrefill(performance, { roster = [], meetName = "" } = {}) {
  const { swim } = performance;
  return {
    name: matchRosterName(swim.athlete, roster) ?? swim.athlete,
    milestone: suggestMilestone(performance),
    eventName: formatEventName(swim.stroke, swim.distance, swim.course),
    time: swim.timeText,
    meetName: meetName.trim(),
    meetDate: toIsoDate(swim.date),
  };
}
