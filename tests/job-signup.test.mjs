import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  SIGNUP_HEADERS,
  makeSignupWorkbook,
  normalizeEventDate,
  parseSignupWorkbook,
  signupExportRows,
  usableVolunteerInfo,
  validateSignupHeaders,
} from "../lib/job-signup.mjs";
import { clubIsoDate, isResetAllowed, isSignupMeetOpen, signupScopeKey } from "../lib/volunteer-service.mjs";

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

test("CSV signup exports use the same parser as Excel files", () => {
  const csv = [
    SIGNUP_HEADERS.join(","),
    '"Fall Meet","09/19/2026 7:00:00 AM","09/19/2026 12:00:00 PM","Parent, Pat","Timer",5,0,"Hrs.","#1","NO","","Taylor Parent"',
  ].join("\n");
  const parsed = parseSignupWorkbook(new TextEncoder().encode(csv));
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].volunteerName, "Taylor Parent");
  assert.equal(parsed.rows[0].jobName, "Timer");
});

test("volunteer display names never expose email addresses or phone numbers", () => {
  assert.equal(usableVolunteerInfo("helper@example.com"), "");
  assert.equal(usableVolunteerInfo("Ben Lenski (918) 555-1212"), "Ben Lenski");

  const account = "Matute, Gorka\ngorka@example.com";
  const sheet = XLSX.utils.aoa_to_sheet([
    SIGNUP_HEADERS,
    ["Fall Meet", "09/19/2026 7:00:00 AM", "09/19/2026 12:00:00 PM", account, "Timer", 5, 0, "Hrs.", "#1", "NO", "", "Gorka Matute"],
    ["Fall Meet", "09/19/2026 7:00:00 AM", "09/19/2026 12:00:00 PM", account, "Runner", 3, 0, "Hrs.", "#2", "NO", "", ""],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Job Signup(0)");
  const parsed = parseSignupWorkbook(XLSX.write(workbook, { type: "array", bookType: "biff8" }));
  assert.deepEqual(parsed.rows.map((row) => row.volunteerName), ["Gorka Matute", "Gorka Matute"]);
});

test("club date and import scope keep same-title meets on different dates separate", () => {
  assert.equal(clubIsoDate(new Date("2026-09-16T04:30:00Z")), "2026-09-15");
  assert.notEqual(
    signupScopeKey({ eventDate: "2026-09-19", eventTitle: "Recurring Meet" }),
    signupScopeKey({ eventDate: "2026-09-20", eventTitle: "Recurring Meet" }),
  );
});

test("the destructive reset is disabled unless a deployment opts in", () => {
  assert.equal(isResetAllowed({}), false);
  assert.equal(isResetAllowed({ DEMO_MODE: "false" }), false);
  assert.equal(isResetAllowed({ ALLOW_DATA_RESET: "true" }), true);
});

test("admin check-in controls override the meet schedule", () => {
  const now = new Date("2026-09-15T18:00:00Z");
  assert.equal(isSignupMeetOpen("2026-09-15", "scheduled", {}, now), true);
  assert.equal(isSignupMeetOpen("2026-09-19", "scheduled", {}, now), false);
  assert.equal(isSignupMeetOpen("2026-09-19", "open", {}, now), true);
  assert.equal(isSignupMeetOpen("2026-09-15", "closed", { ALLOW_EARLY_CHECKIN: "true" }, now), false);
  assert.equal(isSignupMeetOpen("2026-09-19", "scheduled", { ALLOW_EARLY_CHECKIN: "true" }, now), true);
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
