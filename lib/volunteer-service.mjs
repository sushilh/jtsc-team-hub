import { makeSignupWorkbook, parseSignupWorkbook } from "./job-signup.mjs";

const COOKIE_NAME = "jtsc_admin";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SIGNUP_ROWS = 2500;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_FAILURES = 8;
let schemaPromise;

class InputError extends Error {}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, session_date TEXT NOT NULL,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL, location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, name TEXT NOT NULL,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL, default_hours REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS swimmers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, group_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS volunteer_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, job_id INTEGER NOT NULL,
    swimmer_id INTEGER NOT NULL, volunteer_name TEXT NOT NULL, swimmer_name TEXT NOT NULL,
    job_name TEXT NOT NULL, checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TEXT, credited_hours REAL NOT NULL, volunteer_override INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'checked_in', admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS signup_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, file_name TEXT NOT NULL, sheet_name TEXT NOT NULL,
    source_hash TEXT NOT NULL UNIQUE, row_count INTEGER NOT NULL, event_count INTEGER NOT NULL,
    assigned_count INTEGER NOT NULL, uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS signup_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT, import_id INTEGER NOT NULL, source_row INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1, assigned INTEGER NOT NULL DEFAULT 0,
    event_title TEXT NOT NULL, event_start TEXT NOT NULL, event_end TEXT NOT NULL, event_date TEXT NOT NULL,
    account TEXT NOT NULL, account_name TEXT NOT NULL, swimmer_name TEXT NOT NULL,
    job_name TEXT NOT NULL, credit_possible REAL NOT NULL, credit_earned REAL NOT NULL,
    credit_units TEXT NOT NULL, slot TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL, volunteer_info TEXT NOT NULL, volunteer_name TEXT NOT NULL,
    checked_in_at TEXT, checked_out_at TEXT, credited_value REAL, volunteer_override INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (import_id) REFERENCES signup_imports(id)
  )`,
  `CREATE TABLE IF NOT EXISTS signup_meet_settings (
    event_date TEXT NOT NULL, event_title TEXT NOT NULL,
    checkin_mode TEXT NOT NULL DEFAULT 'scheduled'
      CHECK (checkin_mode IN ('scheduled', 'open', 'closed')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_date, event_title)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_login_attempts (
    login_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_jobs_session ON jobs(session_id)",
  "CREATE INDEX IF NOT EXISTS idx_entries_session ON volunteer_entries(session_id)",
  "CREATE INDEX IF NOT EXISTS idx_signup_rows_active_date ON signup_rows(active, event_date)",
  "CREATE INDEX IF NOT EXISTS idx_signup_rows_import ON signup_rows(import_id, source_row)",
];

// Data clearing is opt-in. A missing production binding must never expose a wipe control.
export function isResetAllowed(bindings) {
  const flag = String(bindings?.ALLOW_DATA_RESET ?? bindings?.DEMO_MODE ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(flag);
}

function isEarlyCheckinAllowed(bindings) {
  const flag = String(bindings?.ALLOW_EARLY_CHECKIN ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(flag);
}

export function isSignupMeetOpen(eventDate, checkinMode = "scheduled", bindings, now = new Date()) {
  if (checkinMode === "closed") return false;
  if (checkinMode === "open") return true;
  return isEarlyCheckinAllowed(bindings) || eventDate === clubIsoDate(now);
}

function db(bindings) {
  if (!bindings?.DB) throw new Error("Volunteer storage is not configured.");
  return bindings.DB;
}

async function ensureDatabase(bindings) {
  if (!schemaPromise) {
    const database = db(bindings);
    schemaPromise = database.batch(schemaStatements.map((sql) => database.prepare(sql))).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

function responseJson(value, status = 200, extraHeaders = {}) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

function fail(message, status = 400, extraHeaders = {}) {
  return responseJson({ error: message }, status, extraHeaders);
}

function sameOrigin(request) {
  if (request.method === "GET") return true;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  return (!origin || origin === url.origin) && request.headers.get("Sec-Fetch-Site") !== "cross-site";
}

function readCookie(request, name) {
  return request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sessionSecret(bindings) {
  return String(bindings?.SESSION_SECRET ?? bindings?.ADMIN_PIN ?? "").trim();
}

async function makeSessionCookie(bindings) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const secret = sessionSecret(bindings);
  if (!secret) throw new Error("Admin access is not configured.");
  const signature = await hmac(String(expires), secret);
  return `${expires}.${signature}`;
}

async function isAdmin(request, bindings) {
  const token = readCookie(request, COOKIE_NAME);
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) <= Date.now() / 1000) return false;
  const secret = sessionSecret(bindings);
  return Boolean(secret) && signature === await hmac(expires, secret);
}

function cookieHeader(request, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}`;
}

function number(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function requiredText(value, label, max = 160) {
  const clean = String(value ?? "").trim();
  if (!clean) throw new InputError(`${label} is required.`);
  if (clean.length > max) throw new InputError(`${label} is too long.`);
  return clean;
}

function requiredDate(value, label = "Date") {
  const clean = requiredText(value, label, 10);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new InputError(`${label} must use YYYY-MM-DD.`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])) throw new InputError(`${label} is not a valid calendar date.`);
  return clean;
}

function requiredTime(value, label) {
  const clean = requiredText(value, label, 5);
  const match = clean.match(/^(\d{2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new InputError(`${label} must use a valid 24-hour time.`);
  }
  return clean;
}

function validateTimeRange(start, end) {
  const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  if (minutes(end) <= minutes(start)) throw new InputError("End time must be after start time.");
}

export function clubIsoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function signupScopeKey(row) {
  return `${row.eventDate}\u0000${row.eventTitle}`;
}

async function all(database, sql, ...values) {
  return (await database.prepare(sql).bind(...values).all()).results ?? [];
}

function mapSignupRow(row) {
  return {
    id: Number(row.id),
    importId: Number(row.importId),
    eventTitle: row.eventTitle,
    eventStart: row.eventStart,
    eventEnd: row.eventEnd,
    eventDate: row.eventDate,
    accountName: row.accountName,
    volunteerName: row.volunteerName,
    swimmerName: row.swimmerName,
    jobName: row.jobName,
    creditPossible: Number(row.creditPossible),
    creditEarned: Number(row.creditEarned),
    creditUnits: row.creditUnits,
    slot: row.slot,
    completed: Boolean(row.completed),
    checkedInAt: row.checkedInAt,
    checkedOutAt: row.checkedOutAt,
    creditedValue: Number(row.creditedValue ?? row.creditPossible),
    volunteerOverride: Boolean(row.volunteerOverride),
  };
}

async function publicData(database, bindings) {
  const [sessions, jobs, swimmers, activeEntries, signupRows, signupDates, unassignedMeets, signupJobs, signupSwimmers, signupMeetSettings] = await Promise.all([
    all(database, `SELECT id, title, session_date AS sessionDate, start_time AS startTime,
      end_time AS endTime, location, status FROM sessions WHERE status = 'open' ORDER BY session_date, start_time`),
    all(database, `SELECT id, session_id AS sessionId, name, start_time AS startTime,
      end_time AS endTime, default_hours AS defaultHours FROM jobs ORDER BY name`),
    all(database, `SELECT id, name, group_name AS groupName FROM swimmers WHERE active = 1 ORDER BY name`),
    all(database, `SELECT id, session_id AS sessionId, volunteer_name AS volunteerName,
      swimmer_name AS swimmerName, job_name AS jobName, checked_in_at AS checkedInAt,
      credited_hours AS creditedHours FROM volunteer_entries
      WHERE checked_out_at IS NULL ORDER BY checked_in_at DESC`),
    all(database, `SELECT id, import_id AS importId, event_title AS eventTitle,
      event_start AS eventStart, event_end AS eventEnd, event_date AS eventDate,
      account_name AS accountName, volunteer_name AS volunteerName, swimmer_name AS swimmerName, job_name AS jobName,
      credit_possible AS creditPossible, credit_earned AS creditEarned, credit_units AS creditUnits,
      slot, completed, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt,
      credited_value AS creditedValue, volunteer_override AS volunteerOverride
      FROM signup_rows WHERE active = 1 AND assigned = 1
      ORDER BY event_date DESC, event_start, job_name, volunteer_name LIMIT 2500`),
    all(database, `SELECT event_date AS eventDate, event_title AS eventTitle, COUNT(CASE WHEN assigned = 1 THEN 1 END) AS assignedCount,
      SUM(CASE WHEN assigned = 1 AND checked_in_at IS NOT NULL AND completed = 0 THEN 1 ELSE 0 END) AS checkedInCount,
      SUM(CASE WHEN assigned = 1 AND completed = 1 THEN 1 ELSE 0 END) AS completedCount
      FROM signup_rows WHERE active = 1
      GROUP BY event_date, event_title ORDER BY event_date DESC, event_title`),
    // Keep the open-slot count for the empty-state copy and admin diagnostics. The
    // meet list itself also includes these scopes so an open imported job can accept
    // a walk-in even when nobody was assigned in the source file.
    all(database, `SELECT event_date AS eventDate, event_title AS eventTitle, COUNT(*) AS openCount
      FROM signup_rows WHERE active = 1 AND assigned = 0
      GROUP BY event_date, event_title ORDER BY event_date DESC, event_title`),
    all(database, `SELECT event_date AS eventDate, event_title AS eventTitle,
      event_start AS eventStart, event_end AS eventEnd, job_name AS jobName,
      MAX(credit_possible) AS creditPossible, MAX(credit_units) AS creditUnits,
      COUNT(*) AS slotCount
      FROM signup_rows WHERE active = 1 AND job_name <> ''
      GROUP BY event_date, event_title, event_start, event_end, job_name
      ORDER BY event_date DESC, event_start, job_name`),
    all(database, `SELECT event_date AS eventDate, event_title AS eventTitle,
      swimmer_name AS swimmerName
      FROM signup_rows WHERE active = 1 AND swimmer_name <> ''
      GROUP BY event_date, event_title, swimmer_name
      ORDER BY swimmer_name`),
    all(database, `SELECT event_date AS eventDate, event_title AS eventTitle, checkin_mode AS checkinMode
      FROM signup_meet_settings`),
  ]);
  const meetModes = new Map(signupMeetSettings.map((item) => [signupScopeKey(item), item.checkinMode]));
  const jobsBySession = new Map();
  for (const job of jobs) {
    const list = jobsBySession.get(Number(job.sessionId)) ?? [];
    list.push({ ...job, id: Number(job.id), sessionId: Number(job.sessionId), defaultHours: Number(job.defaultHours) });
    jobsBySession.set(Number(job.sessionId), list);
  }
  return {
    sessions: sessions.map((session) => ({ ...session, id: Number(session.id), jobs: jobsBySession.get(Number(session.id)) ?? [] })),
    swimmers: swimmers.map((swimmer) => ({ ...swimmer, id: Number(swimmer.id) })),
    activeEntries: activeEntries.map((entry) => ({ ...entry, id: Number(entry.id), sessionId: Number(entry.sessionId), creditedHours: Number(entry.creditedHours) })),
    signupRows: signupRows.map(mapSignupRow),
    signupDates: signupDates.map((item) => {
      const checkinMode = meetModes.get(signupScopeKey(item)) ?? "scheduled";
      return {
        ...item,
        checkinMode,
        checkinOpen: isSignupMeetOpen(item.eventDate, checkinMode, bindings),
        assignedCount: Number(item.assignedCount),
        checkedInCount: Number(item.checkedInCount),
        completedCount: Number(item.completedCount),
      };
    }),
    unassignedMeets: unassignedMeets.map((item) => ({ ...item, openCount: Number(item.openCount) })),
    signupJobs: signupJobs.map((item) => ({
      ...item,
      creditPossible: Number(item.creditPossible),
      slotCount: Number(item.slotCount),
    })),
    signupSwimmers,
  };
}

async function adminData(database, bindings) {
  const publicResult = await publicData(database, bindings);
  const resetAllowed = isResetAllowed(bindings);
  const [jobs, entries, signupImports] = await Promise.all([
    all(database, `SELECT id, session_id AS sessionId, name, start_time AS startTime,
      end_time AS endTime, default_hours AS defaultHours FROM jobs ORDER BY session_id, start_time, name`),
    all(database, `SELECT id, session_id AS sessionId, job_id AS jobId, swimmer_id AS swimmerId,
      volunteer_name AS volunteerName, swimmer_name AS swimmerName, job_name AS jobName,
      checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt,
      credited_hours AS creditedHours, volunteer_override AS volunteerOverride, status
      FROM volunteer_entries ORDER BY checked_in_at DESC`),
    all(database, `SELECT id, file_name AS fileName, sheet_name AS sheetName, row_count AS rowCount,
      event_count AS eventCount, assigned_count AS assignedCount, uploaded_at AS uploadedAt
      FROM signup_imports ORDER BY uploaded_at DESC, id DESC LIMIT 20`),
  ]);
  return {
    ...publicResult,
    resetAllowed,
    jobs: jobs.map((job) => ({ ...job, id: Number(job.id), sessionId: Number(job.sessionId), defaultHours: Number(job.defaultHours) })),
    entries: entries.map((entry) => ({
      ...entry,
      id: Number(entry.id), sessionId: Number(entry.sessionId), jobId: Number(entry.jobId), swimmerId: Number(entry.swimmerId),
      creditedHours: Number(entry.creditedHours), volunteerOverride: Boolean(entry.volunteerOverride),
    })),
    signupImports: signupImports.map((item) => ({
      ...item,
      id: Number(item.id), rowCount: Number(item.rowCount), eventCount: Number(item.eventCount), assignedCount: Number(item.assignedCount),
    })),
  };
}

async function importSignup(request, database) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Choose a Job Signup .xls, .xlsx, or .csv file.");
  if (!/\.(?:xlsx?|csv)$/i.test(file.name)) return fail("Choose an Excel .xls, .xlsx, or .csv file.");
  if (!file.size) return fail("The signup file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("The signup file must be smaller than 5 MB.");
  const buffer = await file.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  let parsed;
  try {
    parsed = parseSignupWorkbook(buffer);
  } catch (error) {
    throw new InputError(error instanceof Error ? error.message : "The signup file could not be read.");
  }
  if (parsed.rows.length > MAX_SIGNUP_ROWS) return fail(`This file has ${parsed.rows.length} rows. The maximum is ${MAX_SIGNUP_ROWS}.`);
  const invalidEvent = parsed.rows.find((row) => !row.eventDate || !row.eventTitle);
  if (invalidEvent) throw new InputError(`Signup row ${invalidEvent.sourceRow} needs a valid event title and start date.`);
  const eventScopes = new Set(parsed.rows.filter((row) => row.eventDate && row.eventTitle).map(signupScopeKey));
  let assignedCount = parsed.rows.filter((row) => row.assigned).length;
  const existing = await database.prepare(`SELECT i.id, i.file_name AS fileName, i.row_count AS rowCount,
    i.event_count AS eventCount, i.assigned_count AS assignedCount, COUNT(r.id) AS storedRows,
    SUM(CASE WHEN r.active = 1 THEN 1 ELSE 0 END) AS activeRows
    FROM signup_imports i LEFT JOIN signup_rows r ON r.import_id = i.id
    WHERE i.source_hash = ? GROUP BY i.id`).bind(hash).first();
  if (existing) {
    const storedRows = Number(existing.storedRows ?? 0);
    const activeRows = Number(existing.activeRows ?? 0);
    if (storedRows === Number(existing.rowCount) && activeRows > 0) {
      return responseJson({ ok: true, duplicate: true, import: existing });
    }
    if (storedRows === Number(existing.rowCount)) {
      // A previous request uploaded every staged row but lost or failed its final response.
      // D1 batch is transactional, so this swap either activates the whole roster or none.
      await database.batch([
        database.prepare(`UPDATE signup_rows SET active = 0 WHERE active = 1 AND import_id <> ?
          AND EXISTS (SELECT 1 FROM signup_rows incoming WHERE incoming.import_id = ?
            AND incoming.event_date = signup_rows.event_date AND incoming.event_title = signup_rows.event_title)`).bind(existing.id, existing.id),
        database.prepare("UPDATE signup_rows SET active = 1 WHERE import_id = ?").bind(existing.id),
      ]);
      return responseJson({ ok: true, duplicate: false, resumed: true, import: existing });
    }
    // A failed insertion is safe to discard because its rows were never activated.
    await database.batch([
      database.prepare("DELETE FROM signup_rows WHERE import_id = ?").bind(existing.id),
      database.prepare("DELETE FROM signup_imports WHERE id = ?").bind(existing.id),
    ]);
  }
  const inserted = await database.prepare(`INSERT INTO signup_imports
    (file_name, sheet_name, source_hash, row_count, event_count, assigned_count)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(file.name.slice(0, 240), parsed.sheetName, hash, parsed.rows.length, eventScopes.size, assignedCount).run();
  const importId = Number(inserted.meta?.last_row_id);
  if (!importId) throw new Error("The signup file could not be registered.");

  // A corrected file for a meet already under way must not discard the morning's work,
  // so check-ins recorded at the desk are carried onto the matching row of the new import.
  const shiftKey = (row) => [row.eventDate, row.eventTitle, row.jobName, row.slot, row.volunteerName].join("\u0000");
  const preservedCheckins = new Map();
  const live = await all(database, `SELECT event_date AS eventDate, event_title AS eventTitle,
      event_start AS eventStart, event_end AS eventEnd, account, account_name AS accountName,
      swimmer_name AS swimmerName, job_name AS jobName, credit_possible AS creditPossible,
      credit_units AS creditUnits, slot, notes, volunteer_info AS volunteerInfo,
      volunteer_name AS volunteerName, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt,
      completed, credited_value AS creditedValue, credit_earned AS creditEarned, volunteer_override AS volunteerOverride
      FROM signup_rows WHERE active = 1 AND checked_in_at IS NOT NULL`);
  for (const row of live) {
    if (eventScopes.has(signupScopeKey(row))) preservedCheckins.set(shiftKey(row), row);
  }
  // Walk-ins are stored as normal signup rows so they remain visible in the desk and
  // in the exported workbook. Carry them onto a corrected upload for the same meet;
  // otherwise a new copy of the signup file would silently erase work already done.
  const parsedKeys = new Set(parsed.rows.map(shiftKey));
  const walkins = live.filter((row) => String(row.slot ?? "").startsWith("WALK-IN-")
    && eventScopes.has(signupScopeKey(row))
    && !parsedKeys.has(shiftKey(row)));
  const nextSourceRow = parsed.rows.reduce((max, row) => Math.max(max, Number(row.sourceRow) || 0), 0) + 1;
  walkins.forEach((row, index) => {
    parsed.rows.push({
      sourceRow: nextSourceRow + index,
      assigned: true,
      eventTitle: row.eventTitle,
      eventStart: row.eventStart,
      eventEnd: row.eventEnd,
      eventDate: row.eventDate,
      account: row.account,
      accountName: row.accountName,
      swimmerName: row.swimmerName,
      jobName: row.jobName,
      creditPossible: Number(row.creditPossible),
      creditEarned: Number(row.creditEarned),
      creditUnits: row.creditUnits,
      slot: row.slot,
      completed: Boolean(row.completed),
      notes: row.notes || "Walk-in volunteer",
      volunteerInfo: row.volunteerInfo || row.volunteerName,
      volunteerName: row.volunteerName,
    });
  });
  if (walkins.length) {
    assignedCount = parsed.rows.filter((row) => row.assigned).length;
    await database.prepare("UPDATE signup_imports SET row_count = ?, assigned_count = ? WHERE id = ?")
      .bind(parsed.rows.length, assignedCount, importId).run();
  }
  const statements = parsed.rows.map((row) => {
    const kept = preservedCheckins.get(shiftKey(row));
    return database.prepare(`INSERT INTO signup_rows (
      import_id, source_row, active, assigned, event_title, event_start, event_end, event_date,
      account, account_name, swimmer_name, job_name, credit_possible, credit_earned, credit_units,
      slot, completed, notes, volunteer_info, volunteer_name, credited_value,
      checked_in_at, checked_out_at, volunteer_override
    ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      importId, row.sourceRow, row.assigned ? 1 : 0, row.eventTitle, row.eventStart, row.eventEnd, row.eventDate,
      row.account, row.accountName, row.swimmerName, row.jobName, row.creditPossible,
      kept?.completed ? kept.creditEarned : row.creditEarned,
      row.creditUnits, row.slot, (kept ? kept.completed : row.completed) ? 1 : 0,
      row.notes, row.volunteerInfo, row.volunteerName,
      kept ? kept.creditedValue : (row.completed ? row.creditEarned : row.creditPossible),
      kept?.checkedInAt ?? null, kept?.checkedOutAt ?? null, kept?.volunteerOverride ?? 0,
    );
  });
  try {
    for (let index = 0; index < statements.length; index += 75) await database.batch(statements.slice(index, index + 75));
  } catch (error) {
    await database.batch([
      database.prepare("DELETE FROM signup_rows WHERE import_id = ?").bind(importId),
      database.prepare("DELETE FROM signup_imports WHERE id = ?").bind(importId),
    ]);
    throw error;
  }
  // Only after every staged row exists do we replace matching date+title scopes. D1
  // executes this batch transactionally, so a live roster can never become partial.
  await database.batch([
    database.prepare(`UPDATE signup_rows SET active = 0 WHERE active = 1 AND import_id <> ?
      AND EXISTS (SELECT 1 FROM signup_rows incoming WHERE incoming.import_id = ?
        AND incoming.event_date = signup_rows.event_date AND incoming.event_title = signup_rows.event_title)`).bind(importId, importId),
    database.prepare("UPDATE signup_rows SET active = 1 WHERE import_id = ?").bind(importId),
  ]);
  const keptCount = parsed.rows.reduce((total, row) => total + (preservedCheckins.has(shiftKey(row)) ? 1 : 0), 0);
  return responseJson({
    ok: true,
    duplicate: false,
    import: {
      id: importId, fileName: file.name, rowCount: parsed.rows.length,
      eventCount: eventScopes.size, assignedCount, keptCheckins: keptCount,
      droppedCheckins: preservedCheckins.size - keptCount,
    },
  });
}

async function exportSignup(request, database) {
  const importId = number(new URL(request.url).searchParams.get("importId"), 1, Number.MAX_SAFE_INTEGER);
  if (!importId) return fail("Choose a signup import to download.");
  const source = await database.prepare("SELECT file_name AS fileName, sheet_name AS sheetName FROM signup_imports WHERE id = ?").bind(importId).first();
  if (!source) return fail("That signup import was not found.", 404);
  const rows = await all(database, "SELECT * FROM signup_rows WHERE import_id = ? ORDER BY source_row", importId);
  const output = makeSignupWorkbook(rows, source.sheetName);
  const stem = String(source.fileName).replace(/\.(?:xlsx?|csv)$/i, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "JTSC-JobSignup";
  return new Response(output, {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="${stem}-updated.xls"`,
      "Cache-Control": "no-store",
    },
  });
}

async function handleCheckin(request, database, bindings) {
  const body = await request.json();
  if (body.action === "signup_walkin") {
    const eventDate = requiredDate(body.eventDate, "Meet date");
    const eventTitle = requiredText(body.eventTitle, "Meet", 240);
    const jobName = requiredText(body.jobName, "Job", 160);
    const swimmerName = requiredText(body.swimmerName, "Swimmer", 160);
    const volunteerName = requiredText(body.volunteerName, "Volunteer name", 100);
    const creditedHours = number(body.creditedHours, 0.25, 24);
    if (creditedHours === null) return fail("Enter credit hours from 0.25 to 24.");
    const source = await database.prepare(`SELECT sr.id, sr.import_id AS importId,
      sr.event_start AS eventStart, sr.event_end AS eventEnd,
      sr.credit_possible AS creditPossible, sr.credit_units AS creditUnits,
      COALESCE(settings.checkin_mode, 'scheduled') AS checkinMode
      FROM signup_rows sr LEFT JOIN signup_meet_settings settings
        ON settings.event_date = sr.event_date AND settings.event_title = sr.event_title
      WHERE sr.active = 1 AND sr.event_date = ? AND sr.event_title = ? AND sr.job_name = ?
      LIMIT 1`).bind(eventDate, eventTitle, jobName).first();
    if (!source) return fail("That imported job is no longer available.", 409);
    if (!isSignupMeetOpen(eventDate, source.checkinMode, bindings)) {
      if (source.checkinMode === "closed") return fail(`Check-in for ${eventTitle} is closed by an admin.`, 409);
      return fail(`Check-in for this meet opens on ${eventDate}.`, 409);
    }
    const swimmer = await database.prepare(`SELECT 1 FROM swimmers WHERE active = 1 AND name = ?
      UNION ALL SELECT 1 FROM signup_rows WHERE active = 1 AND event_date = ? AND event_title = ? AND swimmer_name = ?
      LIMIT 1`).bind(swimmerName, eventDate, eventTitle, swimmerName).first();
    if (!swimmer) return fail("Choose a swimmer from the club roster.", 409);
    const sourceRow = await database.prepare("SELECT COALESCE(MAX(source_row), 0) + 1 AS nextSourceRow FROM signup_rows WHERE import_id = ?")
      .bind(source.importId).first();
    const slot = `WALK-IN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const inserted = await database.prepare(`INSERT INTO signup_rows (
      import_id, source_row, active, assigned, event_title, event_start, event_end, event_date,
      account, account_name, swimmer_name, job_name, credit_possible, credit_earned, credit_units,
      slot, completed, notes, volunteer_info, volunteer_name, credited_value,
      checked_in_at, checked_out_at, volunteer_override
    ) VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'Walk-in volunteer', ?, ?, ?, CURRENT_TIMESTAMP, NULL, ?)`)
      .bind(
        source.importId, Number(sourceRow?.nextSourceRow ?? 1), eventTitle, source.eventStart, source.eventEnd, eventDate,
        swimmerName, swimmerName, swimmerName, jobName, Number(source.creditPossible), source.creditUnits,
        slot, volunteerName, volunteerName, creditedHours,
        Number(creditedHours) === Number(source.creditPossible) ? 0 : 1,
      ).run();
    return responseJson({ ok: true, id: inserted.meta?.last_row_id, walkin: true });
  }
  if (body.action === "signup_checkin") {
    const id = number(body.id, 1, Number.MAX_SAFE_INTEGER);
    const hours = number(body.creditedHours, 0, 24);
    if (!id || hours === null) return fail("Choose a valid volunteer shift and credit amount.");
    const row = await database.prepare(`SELECT sr.credit_possible AS creditPossible, sr.event_date AS eventDate,
      sr.event_title AS eventTitle, COALESCE(settings.checkin_mode, 'scheduled') AS checkinMode
      FROM signup_rows sr LEFT JOIN signup_meet_settings settings
        ON settings.event_date = sr.event_date AND settings.event_title = sr.event_title
      WHERE sr.id = ? AND sr.active = 1 AND sr.assigned = 1`).bind(id).first();
    if (!row) return fail("That volunteer assignment is no longer available.", 404);
    if (!isSignupMeetOpen(row.eventDate, row.checkinMode, bindings)) {
      if (row.checkinMode === "closed") return fail(`Check-in for ${row.eventTitle} is closed by an admin.`, 409);
      return fail(`Check-in for this assignment opens on ${row.eventDate}.`, 409);
    }
    const result = await database.prepare(`UPDATE signup_rows SET checked_in_at = CURRENT_TIMESTAMP,
      credited_value = ?, volunteer_override = ? WHERE id = ? AND checked_in_at IS NULL AND completed = 0`)
      .bind(hours, Number(hours) === Number(row.creditPossible) ? 0 : 1, id).run();
    if (!result.meta?.changes) return fail("This assignment has already been checked in or completed.", 409);
    return responseJson({ ok: true });
  }
  if (body.action === "signup_checkout") {
    const id = number(body.id, 1, Number.MAX_SAFE_INTEGER);
    if (!id) return fail("Choose a volunteer assignment.");
    const result = await database.prepare(`UPDATE signup_rows SET checked_out_at = CURRENT_TIMESTAMP,
      completed = 1, credit_earned = COALESCE(credited_value, credit_possible)
      WHERE id = ? AND checked_in_at IS NOT NULL AND checked_out_at IS NULL AND completed = 0`).bind(id).run();
    if (!result.meta?.changes) return fail("This assignment is not currently checked in.", 409);
    return responseJson({ ok: true });
  }
  if (body.action === "signup_undo") {
    const id = number(body.id, 1, Number.MAX_SAFE_INTEGER);
    if (!id) return fail("Choose a volunteer assignment.");
    // Only a check-in made at this desk can be reversed. A row the signup file already
    // marked completed has no checked_in_at, so history stays exactly as the file recorded it.
    const result = await database.prepare(`UPDATE signup_rows SET checked_in_at = NULL, checked_out_at = NULL,
      credit_earned = CASE WHEN completed = 1 THEN 0 ELSE credit_earned END, completed = 0,
      credited_value = credit_possible, volunteer_override = 0
      WHERE id = ? AND active = 1 AND checked_in_at IS NOT NULL`).bind(id).run();
    if (!result.meta?.changes) return fail("Only a check-in made at this desk can be undone.", 409);
    return responseJson({ ok: true });
  }
  if (body.action === "checkout") {
    const id = number(body.id, 1, Number.MAX_SAFE_INTEGER);
    const result = id && await database.prepare(`UPDATE volunteer_entries SET checked_out_at = CURRENT_TIMESTAMP,
      status = 'checked_out' WHERE id = ? AND checked_out_at IS NULL`).bind(id).run();
    if (!result?.meta?.changes) return fail("This volunteer is not currently checked in.", 409);
    return responseJson({ ok: true });
  }
  const sessionId = number(body.sessionId, 1, Number.MAX_SAFE_INTEGER);
  const jobId = number(body.jobId, 1, Number.MAX_SAFE_INTEGER);
  const swimmerId = number(body.swimmerId, 1, Number.MAX_SAFE_INTEGER);
  const creditedHours = number(body.creditedHours, 0.25, 24);
  const volunteerName = requiredText(body.volunteerName, "Volunteer name", 100);
  if (!sessionId || !jobId || !swimmerId || creditedHours === null) return fail("Complete every check-in field.");
  const [session, job, swimmer] = await Promise.all([
    database.prepare("SELECT id, session_date AS sessionDate FROM sessions WHERE id = ? AND status = 'open'").bind(sessionId).first(),
    database.prepare("SELECT name, default_hours AS defaultHours FROM jobs WHERE id = ? AND session_id = ?").bind(jobId, sessionId).first(),
    database.prepare("SELECT name FROM swimmers WHERE id = ? AND active = 1").bind(swimmerId).first(),
  ]);
  if (!session || !job || !swimmer) return fail("That session, job, or swimmer is no longer available.", 409);
  if (!isEarlyCheckinAllowed(bindings) && session.sessionDate !== clubIsoDate()) {
    return fail(`Walk-in check-in for this session opens on ${session.sessionDate}.`, 409);
  }
  const inserted = await database.prepare(`INSERT INTO volunteer_entries
    (session_id, job_id, swimmer_id, volunteer_name, swimmer_name, job_name, credited_hours, volunteer_override)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      sessionId, jobId, swimmerId, volunteerName, swimmer.name, job.name, creditedHours,
      Number(creditedHours) === Number(job.defaultHours) ? 0 : 1,
    ).run();
  return responseJson({ ok: true, id: inserted.meta?.last_row_id });
}

async function handleAdminMutation(request, database, bindings) {
  const body = await request.json();
  if (body.action === "create_session") {
    const title = requiredText(body.title, "Session name");
    const date = requiredDate(body.date);
    const start = requiredTime(body.startTime, "Start time");
    const end = requiredTime(body.endTime, "End time");
    validateTimeRange(start, end);
    const location = requiredText(body.location, "Location");
    const result = await database.prepare(`INSERT INTO sessions (title, session_date, start_time, end_time, location)
      VALUES (?, ?, ?, ?, ?)`).bind(title, date, start, end, location).run();
    return responseJson({ ok: true, id: result.meta?.last_row_id });
  }
  if (body.action === "add_job") {
    const sessionId = number(body.sessionId, 1, Number.MAX_SAFE_INTEGER);
    const name = requiredText(body.name, "Job name");
    const start = requiredTime(body.startTime, "Start time");
    const end = requiredTime(body.endTime, "End time");
    validateTimeRange(start, end);
    const hours = number(body.defaultHours, 0.25, 24);
    if (!sessionId || hours === null) return fail("Choose a session and valid credit hours.");
    const session = await database.prepare("SELECT id FROM sessions WHERE id = ? AND status = 'open'").bind(sessionId).first();
    if (!session) return fail("That session is no longer open.", 409);
    const result = await database.prepare(`INSERT INTO jobs (session_id, name, start_time, end_time, default_hours)
      VALUES (?, ?, ?, ?, ?)`).bind(sessionId, name, start, end, hours).run();
    return responseJson({ ok: true, id: result.meta?.last_row_id });
  }
  if (body.action === "add_swimmer") {
    const name = requiredText(body.name, "Swimmer name", 100);
    const group = requiredText(body.groupName, "Training group", 100);
    const result = await database.prepare("INSERT INTO swimmers (name, group_name) VALUES (?, ?)").bind(name, group).run();
    return responseJson({ ok: true, id: result.meta?.last_row_id });
  }
  if (body.action === "update_hours") {
    const id = number(body.id, 1, Number.MAX_SAFE_INTEGER);
    const hours = number(body.hours, 0, 24);
    if (!id || hours === null) return fail("Enter valid volunteer hours.");
    const result = await database.prepare("UPDATE volunteer_entries SET credited_hours = ?, volunteer_override = 1 WHERE id = ?").bind(hours, id).run();
    if (!result.meta?.changes) return fail("That volunteer entry was not found.", 404);
    return responseJson({ ok: true });
  }
  if (body.action === "set_session_status") {
    const id = number(body.id, 1, Number.MAX_SAFE_INTEGER);
    const status = body.status === "closed" ? "closed" : body.status === "open" ? "open" : "";
    if (!id || !status) return fail("Choose a valid session status.");
    const result = await database.prepare("UPDATE sessions SET status = ? WHERE id = ?").bind(status, id).run();
    if (!result.meta?.changes) return fail("That session was not found.", 404);
    return responseJson({ ok: true });
  }
  if (body.action === "set_signup_meet_checkin") {
    const eventDate = requiredDate(body.eventDate, "Meet date");
    const eventTitle = requiredText(body.eventTitle, "Meet", 240);
    const checkinMode = ["scheduled", "open", "closed"].includes(body.checkinMode) ? body.checkinMode : "";
    if (!checkinMode) return fail("Choose scheduled, open, or closed check-in.");
    const meet = await database.prepare(`SELECT 1 FROM signup_rows
      WHERE active = 1 AND event_date = ? AND event_title = ? LIMIT 1`).bind(eventDate, eventTitle).first();
    if (!meet) return fail("That imported meet is no longer available.", 404);
    await database.prepare(`INSERT INTO signup_meet_settings
      (event_date, event_title, checkin_mode, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(event_date, event_title) DO UPDATE SET
        checkin_mode = excluded.checkin_mode, updated_at = CURRENT_TIMESTAMP`)
      .bind(eventDate, eventTitle, checkinMode).run();
    return responseJson({ ok: true, checkinMode });
  }
  if (body.action === "signup_checkout_all") {
    // End of meet sweep. Volunteers routinely leave without checking out, and an
    // uncheckedout shift earns nothing, so the club would silently lose those hours.
    const eventDate = requiredDate(body.eventDate, "Meet date");
    const eventTitle = requiredText(body.eventTitle, "Meet", 240);
    const result = await database.prepare(`UPDATE signup_rows SET checked_out_at = CURRENT_TIMESTAMP,
      completed = 1, credit_earned = COALESCE(credited_value, credit_possible)
      WHERE active = 1 AND checked_in_at IS NOT NULL AND checked_out_at IS NULL AND completed = 0
        AND event_date = ? AND event_title = ?`).bind(eventDate, eventTitle).run();
    return responseJson({ ok: true, closed: result.meta?.changes ?? 0 });
  }
  if (body.action === "clear_signup_import") {
    const importId = number(body.importId, 1, Number.MAX_SAFE_INTEGER);
    if (!importId) return fail("Choose a signup import to clear.");
    if (String(body.confirm ?? "").trim().toUpperCase() !== "CLEAR") {
      return fail("Type CLEAR to confirm removing this imported roster.");
    }
    const source = await database.prepare("SELECT id, file_name AS fileName FROM signup_imports WHERE id = ?")
      .bind(importId).first();
    if (!source) return fail("That signup import was not found.", 404);
    const count = await database.prepare("SELECT COUNT(*) AS rowCount FROM signup_rows WHERE import_id = ?")
      .bind(importId).first();
    // Keep a meet override only when another active import still owns that same
    // event-date/title scope. The selected file can be an older, inactive import.
    await database.batch([
      database.prepare(`DELETE FROM signup_meet_settings AS settings
        WHERE EXISTS (SELECT 1 FROM signup_rows target
          WHERE target.import_id = ? AND target.event_date = settings.event_date
            AND target.event_title = settings.event_title)
          AND NOT EXISTS (SELECT 1 FROM signup_rows active
            WHERE active.import_id <> ? AND active.active = 1
              AND active.event_date = settings.event_date
              AND active.event_title = settings.event_title)`).bind(importId, importId),
      database.prepare("DELETE FROM signup_rows WHERE import_id = ?").bind(importId),
      database.prepare("DELETE FROM signup_imports WHERE id = ?").bind(importId),
    ]);
    return responseJson({ ok: true, fileName: source.fileName, clearedRows: Number(count?.rowCount ?? 0) });
  }
  if (body.action === "reset_signup_data") {
    // Enforced here, not just hidden in the page: a control that wipes every roster must
    // not be reachable on a live deployment even by calling the endpoint directly.
    if (!isResetAllowed(bindings)) return fail("Clearing data is disabled on this deployment.", 403);
    if (String(body.confirm ?? "").trim().toUpperCase() !== "RESET") {
      return fail("Type RESET to confirm clearing every imported signup roster.");
    }
    // Every table, child rows first so foreign keys stay satisfied, and the autoincrement
    // counters too so a fresh demo starts from id 1 rather than continuing the old run.
    await database.batch([
      database.prepare("DELETE FROM volunteer_entries"),
      database.prepare("DELETE FROM signup_meet_settings"),
      database.prepare("DELETE FROM signup_rows"),
      database.prepare("DELETE FROM signup_imports"),
      database.prepare("DELETE FROM jobs"),
      database.prepare("DELETE FROM sessions"),
      database.prepare("DELETE FROM swimmers"),
      database.prepare(`DELETE FROM sqlite_sequence WHERE name IN
        ('volunteer_entries','signup_rows','signup_imports','jobs','sessions','swimmers')`),
    ]);
    return responseJson({ ok: true });
  }
  return fail("Unknown admin action.", 404);
}

async function loginKey(request, bindings) {
  const address = request.headers.get("CF-Connecting-IP") || "local-development";
  return hmac(address, sessionSecret(bindings));
}

async function loginThrottle(database, request, bindings) {
  const key = await loginKey(request, bindings);
  const now = Math.floor(Date.now() / 1000);
  const attempt = await database.prepare("SELECT window_start AS windowStart, attempts FROM admin_login_attempts WHERE login_key = ?")
    .bind(key).first();
  if (!attempt || Number(attempt.windowStart) <= now - LOGIN_WINDOW_SECONDS || Number(attempt.attempts) < LOGIN_MAX_FAILURES) {
    return { key, blocked: false, retryAfter: 0 };
  }
  return { key, blocked: true, retryAfter: Math.max(1, Number(attempt.windowStart) + LOGIN_WINDOW_SECONDS - now) };
}

async function recordLoginFailure(database, key) {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - LOGIN_WINDOW_SECONDS;
  await database.prepare(`INSERT INTO admin_login_attempts (login_key, window_start, attempts) VALUES (?, ?, 1)
    ON CONFLICT(login_key) DO UPDATE SET
      window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
      attempts = CASE WHEN window_start <= ? THEN 1 ELSE attempts + 1 END`)
    .bind(key, now, cutoff, cutoff).run();
}

export async function handleVolunteerRequest(request, bindings) {
  if (!sameOrigin(request)) return fail("Please submit this form from the JTSC website.", 403);
  const url = new URL(request.url);
  try {
    await ensureDatabase(bindings);
    const database = db(bindings);
    if (url.pathname === "/api/public" && request.method === "GET") return responseJson(await publicData(database, bindings));
    if (url.pathname === "/api/checkins" && request.method === "POST") return await handleCheckin(request, database, bindings);
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      const body = await request.json();
      // Fail closed. A fallback PIN in the source would be the real admin code for any
      // deployment that never set the secret, and it is readable by anyone with the repo.
      const adminPin = String(bindings.ADMIN_PIN ?? "").trim();
      if (!adminPin) return fail("Admin access is not configured on this deployment.", 503);
      const throttle = await loginThrottle(database, request, bindings);
      if (throttle.blocked) {
        return fail("Too many sign-in attempts. Please wait before trying again.", 429, { "Retry-After": String(throttle.retryAfter) });
      }
      const secret = sessionSecret(bindings);
      const [actual, supplied] = await Promise.all([hmac(adminPin, secret), hmac(String(body.pin ?? ""), secret)]);
      if (supplied !== actual) {
        await recordLoginFailure(database, throttle.key);
        return fail("That access code is not correct.", 401);
      }
      await database.prepare("DELETE FROM admin_login_attempts WHERE login_key = ?").bind(throttle.key).run();
      const value = await makeSessionCookie(bindings);
      return responseJson({ ok: true }, 200, { "Set-Cookie": cookieHeader(request, value, 60 * 60 * 12) });
    }
    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      return responseJson({ ok: true }, 200, { "Set-Cookie": cookieHeader(request, "", 0) });
    }
    if (url.pathname.startsWith("/api/admin") && !(await isAdmin(request, bindings))) return fail("Sign in required.", 401);
    if (url.pathname === "/api/admin" && request.method === "GET") return responseJson(await adminData(database, bindings));
    if (url.pathname === "/api/admin" && request.method === "POST") return await handleAdminMutation(request, database, bindings);
    if (url.pathname === "/api/admin/signup-import" && request.method === "POST") return await importSignup(request, database);
    if (url.pathname === "/api/admin/signup-export" && request.method === "GET") return await exportSignup(request, database);
    return fail("Not found.", 404);
  } catch (error) {
    if (error instanceof InputError || error instanceof SyntaxError) {
      return fail(error instanceof Error ? error.message : "The request is not valid.");
    }
    console.error("Volunteer API request failed", error);
    return fail("The volunteer desk could not complete this request.", 500);
  }
}
