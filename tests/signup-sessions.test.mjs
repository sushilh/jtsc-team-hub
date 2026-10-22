import test from "node:test";
import assert from "node:assert/strict";
import { signupSessionPeriod } from "../lib/signup-sessions.mjs";

test("job start times separate morning from afternoon and evening", () => {
  for (const value of ["10/24/2026 7:15:00 AM", "10/24/2026 11:00:00 AM", "2026-10-24T00:15:00", "12:00 AM"]) assert.equal(signupSessionPeriod(value), "morning", value);
  for (const value of ["10/24/2026 12:15:00 PM", "10/24/2026 3:00:00 PM", "10/23/2026 4:45:00 PM", "2026-10-24T15:00:00", "12:00 PM"]) assert.equal(signupSessionPeriod(value), "later", value);
  for (const value of ["", "not a time", "13:90", "13:00 PM"]) assert.equal(signupSessionPeriod(value), "unknown", value);
});
