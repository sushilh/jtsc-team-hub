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
