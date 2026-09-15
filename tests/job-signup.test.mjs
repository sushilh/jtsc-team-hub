import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  SIGNUP_HEADERS,
  makeSignupWorkbook,
  normalizeEventDate,
  parseSignupWorkbook,
  signupExportRows,
  validateSignupHeaders,
} from "../lib/job-signup.mjs";

function sampleWorkbook() {
  const sheet = XLSX.utils.aoa_to_sheet([
    SIGNUP_HEADERS,
    ["Fall Meet", "09/19/2026 7:00:00 AM", "09/19/2026 12:00:00 PM", "Parent, Pat\npat@example.com\n555-1111", "Timer", 5, 0, "Hrs.", "#1", "NO", "Lane 1", "Taylor Parent"],
    ["Fall Meet", "09/19/2026 7:00:00 AM", "09/19/2026 12:00:00 PM", "\n  \n", "Timer", 5, 0, "Hrs.", "#0", "NO", "Lane 2", ""],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Job Signup(0)");
  return XLSX.write(workbook, { type: "array", bookType: "biff8" });
}

test("Job Signup parsing preserves assigned and open slots", () => {
  const parsed = parseSignupWorkbook(sampleWorkbook());
  assert.equal(parsed.sheetName, "Job Signup(0)");
  assert.deepEqual(parsed.headers, SIGNUP_HEADERS);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].volunteerName, "Taylor Parent");
  assert.equal(parsed.rows[0].swimmerName, "Parent, Pat");
  assert.equal(parsed.rows[0].eventDate, "2026-09-19");
  assert.equal(parsed.rows[0].assigned, true);
  assert.equal(parsed.rows[1].assigned, false);
  assert.equal(parsed.rows[1].slot, "#0");
});

test("round-trip export keeps the twelve source columns and applies completed credit", () => {
  const parsed = parseSignupWorkbook(sampleWorkbook());
  const savedRows = parsed.rows.map((row, index) => ({
    ...row,
    completed: index === 0,
    credited_value: index === 0 ? 4.25 : null,
  }));
  const matrix = signupExportRows(savedRows);
  assert.deepEqual(matrix[0], SIGNUP_HEADERS);
  assert.equal(matrix[1][6], 4.25);
  assert.equal(matrix[1][9], "YES");
  assert.equal(matrix[2][3], "");
  const exported = parseSignupWorkbook(makeSignupWorkbook(savedRows, parsed.sheetName));
  assert.equal(exported.rows.length, 2);
  assert.equal(exported.rows[0].creditEarned, 4.25);
  assert.equal(exported.rows[0].completed, true);
});

test("header and date validation give predictable results", () => {
  assert.equal(normalizeEventDate("07/23/2026 3:00:00 PM"), "2026-07-23");
  assert.equal(normalizeEventDate("2026-09-19"), "2026-09-19");
  assert.throws(() => validateSignupHeaders(["Event Title", "Account"]), /Missing:/);
});

test("a corrected re-import keeps desk check-ins on shifts that still exist", () => {
  // The morning file gets checked in at the desk, then a corrected file arrives with a
  // late signup added and one volunteer swapped out. This mirrors importSignup's matching.
  const shiftKey = (row) => [row.eventDate, row.eventTitle, row.jobName, row.slot, row.volunteerName].join("\u0000");
  const build = (rows) => {
    const sheet = XLSX.utils.aoa_to_sheet([SIGNUP_HEADERS, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Job Signup(0)");
    return XLSX.write(workbook, { type: "array", bookType: "biff8" });
  };
  const row = (job, slot, who, credit) => [
    "Fall Meet", "09/20/2026 7:00:00 AM", "09/20/2026 12:30:00 PM",
    who + "\n" + who + "@example.com", job, credit, 0, "Hrs.", slot, "NO", "", who,
  ];

  const morning = parseSignupWorkbook(build([
    row("Timer", "#1", "Sushil Hegde", 5),
    row("Concessions", "#1", "Priya Hegde", 4),
    row("Runner", "#1", "Dana Smith", 3),
  ]));
  // Sushil has finished his shift; Priya is still on deck.
  const desk = new Map();
  desk.set(shiftKey(morning.rows[0]), { checkedInAt: "2026-09-20T07:02:00Z", completed: 1, creditedValue: 5, creditEarned: 5 });
  desk.set(shiftKey(morning.rows[1]), { checkedInAt: "2026-09-20T07:06:00Z", completed: 0, creditedValue: 4, creditEarned: 0 });

  const corrected = parseSignupWorkbook(build([
    row("Timer", "#1", "Sushil Hegde", 5),
    row("Concessions", "#1", "Priya Hegde", 4),
    row("Runner", "#1", "Alex Ruiz", 3),
    row("Awards", "#1", "Jo Park", 2),
  ]));
  const carried = corrected.rows.map((r) => ({ name: r.volunteerName, kept: desk.get(shiftKey(r)) ?? null }));

  assert.equal(carried[0].kept.completed, 1, "a finished shift stays completed");
  assert.equal(carried[0].kept.creditEarned, 5, "its earned credit survives the re-import");
  assert.equal(carried[1].kept.checkedInAt, "2026-09-20T07:06:00Z", "an on-deck shift stays checked in");
  assert.equal(carried[2].kept, null, "a swapped volunteer never inherits someone else's check-in");
  assert.equal(carried[3].kept, null, "a late signup starts clean");
  assert.equal(carried.filter((entry) => entry.kept).length, 2);
});
