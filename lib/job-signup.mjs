import * as XLSX from "xlsx";

export const SIGNUP_HEADERS = Object.freeze([
  "Event Title",
  "Event Start Date",
  "Event End Date",
  "Account",
  "Job Name",
  "Credit Possible",
  "Credit Earned",
  "Credit Units",
  "Slot",
  "Completed?",
  "Notes",
  "Volunteer Info",
]);

const OPTIONAL_SWIMMER_HEADERS = ["Swimmer Name", "Swimmer"];

function text(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

export function firstLine(value) {
  return String(value ?? "").split(/\r?\n/).map((part) => part.trim()).find(Boolean) ?? "";
}

function usableVolunteerInfo(value) {
  const candidate = firstLine(value);
  return /[a-z]/i.test(candidate) ? candidate : "";
}

export function normalizeEventDate(value) {
  const input = text(value);
  if (!input) return "";
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (us) {
    const numericYear = Number(us[3]);
    const year = us[3].length === 2 ? (numericYear < 70 ? 2000 + numericYear : 1900 + numericYear) : numericYear;
    return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

export function isCompleted(value) {
  return /^(yes|y|true|1|completed|complete|x)$/i.test(text(value));
}

export function validateSignupHeaders(headers) {
  const normalized = headers.map(text);
  const missing = SIGNUP_HEADERS.filter((header) => !normalized.includes(header));
  if (missing.length) {
    throw new Error(`This is not a JTSC Job Signup export. Missing: ${missing.join(", ")}.`);
  }
  return normalized;
}

export function parseSignupWorkbook(input) {
  const workbook = XLSX.read(input, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
  const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: false,
    dateNF: "mm/dd/yyyy h:mm:ss AM/PM",
  });
  if (!grid.length) throw new Error("The worksheet is empty.");
  const headers = validateSignupHeaders(grid[0]);
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const swimmerHeader = OPTIONAL_SWIMMER_HEADERS.find((header) => indexes[header] !== undefined);
  const rows = grid.slice(1).filter((row) => row.some((value) => text(value))).map((row, index) => {
    const get = (header) => text(row[indexes[header]]);
    const account = get("Account");
    const accountName = firstLine(account);
    const volunteerInfo = get("Volunteer Info");
    const volunteerName = usableVolunteerInfo(volunteerInfo) || accountName;
    const swimmerName = swimmerHeader ? text(row[indexes[swimmerHeader]]) : accountName;
    const creditPossible = Number.parseFloat(get("Credit Possible")) || 0;
    const creditEarned = Number.parseFloat(get("Credit Earned")) || 0;
    return {
      sourceRow: index + 2,
      eventTitle: get("Event Title"),
      eventStart: get("Event Start Date"),
      eventEnd: get("Event End Date"),
      eventDate: normalizeEventDate(get("Event Start Date")),
      account,
      accountName,
      swimmerName,
      jobName: get("Job Name"),
      creditPossible,
      creditEarned,
      creditUnits: get("Credit Units"),
      slot: get("Slot"),
      completed: isCompleted(get("Completed?")),
      notes: get("Notes"),
      volunteerInfo,
      volunteerName,
      assigned: Boolean(accountName || volunteerName),
    };
  });
  if (!rows.length) throw new Error("The worksheet does not contain signup rows.");
  return { sheetName, headers, rows };
}

export function signupExportRows(rows) {
  return [SIGNUP_HEADERS, ...rows.map((row) => [
    row.event_title ?? row.eventTitle ?? "",
    row.event_start ?? row.eventStart ?? "",
    row.event_end ?? row.eventEnd ?? "",
    row.account ?? "",
    row.job_name ?? row.jobName ?? "",
    Number(row.credit_possible ?? row.creditPossible ?? 0),
    Number(row.completed ? (row.credited_value ?? row.credit_earned ?? row.creditEarned ?? row.credit_possible ?? row.creditPossible ?? 0) : (row.credit_earned ?? row.creditEarned ?? 0)),
    row.credit_units ?? row.creditUnits ?? "",
    row.slot ?? "",
    row.completed ? "YES" : "NO",
    row.notes ?? "",
    row.volunteer_info ?? row.volunteerInfo ?? "",
  ])];
}

export function makeSignupWorkbook(rows, sheetName = "Job Signup(0)") {
  const worksheet = XLSX.utils.aoa_to_sheet(signupExportRows(rows));
  worksheet["!cols"] = [
    { wch: 34 }, { wch: 23 }, { wch: 23 }, { wch: 36 }, { wch: 34 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 9 }, { wch: 12 }, { wch: 58 }, { wch: 30 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, String(sheetName || "Job Signup(0)").slice(0, 31));
  return XLSX.write(workbook, { bookType: "biff8", type: "array" });
}
