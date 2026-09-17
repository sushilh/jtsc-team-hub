import assert from "node:assert/strict";
import test from "node:test";
import { buildLedgerExport } from "../lib/ledger-export.mjs";

test("ledger export totals hours and points separately and neutralizes formula-leading cells", () => {
  const rows = [
    {
      volunteerName: "=CMD|calc", swimmerName: "Alex", jobName: "Timer", meet: "Dual Meet", meetDate: "2026-06-01",
      units: "Hrs.", credit: 2, checkedInAt: "2026-06-01T08:00:00Z", checkedOutAt: "2026-06-01T10:00:00Z",
      adjusted: false, source: "Signup",
    },
    {
      volunteerName: "Sam", swimmerName: "Jordan", jobName: "Concessions", meet: "Dual Meet", meetDate: "2026-06-01",
      units: "Pts.", credit: 5, checkedInAt: null, checkedOutAt: null, adjusted: true, source: "Walk-in",
    },
  ];
  const result = buildLedgerExport(rows, "2026-06-01");
  assert.equal(result.rowCount, 2);
  assert.equal(result.totalHours, 2);
  assert.equal(result.totalPoints, 5);
  assert.equal(result.fileName, "JTSC-volunteer-hours-2026-06-01.csv");
  assert.match(result.csv, /"'=CMD\|calc"/);
  assert.match(result.csv, /"TOTAL","","","","","2","5","","","","2 shifts"/);
});

test("an empty ledger still produces a header and a zeroed total row", () => {
  const result = buildLedgerExport([], "all-meets");
  const lines = result.csv.split("\n");
  assert.equal(lines[0], '"Volunteer","Swimmer / account","Job","Meet","Meet date","Hours","Points","Check in","Check out","Credit adjusted","Source"');
  assert.equal(result.totalHours, 0);
  assert.equal(result.totalPoints, 0);
  assert.equal(result.rowCount, 0);
  assert.equal(result.fileName, "JTSC-volunteer-hours-all-meets.csv");
});
