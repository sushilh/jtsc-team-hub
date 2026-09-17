function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

// Hours and points are different currencies, so they get their own columns rather
// than being added together. Shared by the on-demand CSV download and the "save for
// later" history in D1, so both paths always agree on what the file contains.
export function buildLedgerExport(rows, label) {
  const csvRows = rows.map((row) => [
    row.volunteerName,
    row.swimmerName,
    row.jobName,
    row.meet,
    row.meetDate,
    row.units === "Hrs." ? row.credit : "",
    row.units === "Pts." ? row.credit : "",
    row.checkedInAt ?? "",
    row.checkedOutAt ?? "",
    row.adjusted ? "Yes" : "No",
    row.source,
  ]);
  const totalHours = rows.filter((row) => row.units === "Hrs.").reduce((sum, row) => sum + row.credit, 0);
  const totalPoints = rows.filter((row) => row.units === "Pts.").reduce((sum, row) => sum + row.credit, 0);
  const csv = [
    ["Volunteer", "Swimmer / account", "Job", "Meet", "Meet date", "Hours", "Points", "Check in", "Check out", "Credit adjusted", "Source"],
    ...csvRows,
    [],
    ["TOTAL", "", "", "", "", totalHours, totalPoints, "", "", "", `${rows.length} shifts`],
  ].map((row) => row.map(csvCell).join(",")).join("\n");
  return { csv, fileName: `JTSC-volunteer-hours-${label}.csv`, totalHours, totalPoints, rowCount: rows.length };
}
