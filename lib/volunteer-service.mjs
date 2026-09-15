import { env } from "cloudflare:workers";
import { makeSignupWorkbook, parseSignupWorkbook } from "./job-signup.mjs";

const COOKIE_NAME = "jtsc_admin";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SIGNUP_ROWS = 2500;
let schemaPromise;

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
  "CREATE INDEX IF NOT EXISTS idx_jobs_session ON jobs(session_id)",
  "CREATE INDEX IF NOT EXISTS idx_entries_session ON volunteer_entries(session_id)",
  "CREATE INDEX IF NOT EXISTS idx_signup_rows_active_date ON signup_rows(active, event_date)",
  "CREATE INDEX IF NOT EXISTS idx_signup_rows_import ON signup_rows(import_id, source_row)",
];

// Demo builds expose a destructive "clear everything" control. Production simply does not
// set DEMO_MODE, and the server refuses the action regardless of what the page shows.
function isDemoMode(bindings) {
  return ["1", "true", "yes", "on"].includes(String(bindings?.DEMO_MODE ?? "").trim().toLowerCase());
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

function fail(message, status = 400) {
  return responseJson({ error: message }, status);
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

async function makeSessionCookie(bindings) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
  const signature = await hmac(String(expires), bindings.SESSION_SECRET || "jtsc-local-development-secret");
  return `${expires}.${signature}`;
}

async function isAdmin(request, bindings) {
  const token = readCookie(request, COOKIE_NAME);
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) <= Date.now() / 1000) return false;
  return signature === await hmac(expires, bindings.SESSION_SECRET || "jtsc-local-development-secret");
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
  if (!clean) throw new Error(`${label} is required.`);
  if (clean.length > max) throw new Error(`${label} is too long.`);
  return clean;
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

async function publicData(database) {
  const [sessions, jobs, swimmers, activeEntries, signupRows, signupDates, unassignedMeets] = await Promise.all([
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
      volunteer_name AS volunteerName, swimmer_name AS swimmerName, job_name AS jobName,
      credit_possible AS creditPossible, credit_earned AS creditEarned, credit_units AS creditUnits,
      slot, completed, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt,
      credited_value AS creditedValue, volunteer_override AS volunteerOverride
      FROM signup_rows WHERE active = 1 AND assigned = 1
      ORDER BY event_date DESC, event_start, job_name, volunteer_name LIMIT 2500`),
    all(database, `SELECT event_date AS eventDate, event_title AS eventTitle, COUNT(*) AS assignedCount,
      SUM(CASE WHEN checked_in_at IS NOT NULL AND completed = 0 THEN 1 ELSE 0 END) AS checkedInCount,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completedCount
      FROM signup_rows WHERE active = 1 AND assigned = 1
      GROUP BY event_date, event_title ORDER BY event_date DESC, event_title`),
    // A roster whose slots nobody has signed up for yet. The desk shows only assigned
    // shifts, so without this the page cannot tell "nothing uploaded" from "nobody signed up".
    all(database, `SELECT event_date AS eventDate, event_title AS eventTitle, COUNT(*) AS openCount
      FROM signup_rows WHERE active = 1 AND assigned = 0
      GROUP BY event_date, event_title ORDER BY event_date DESC, event_title`),
  ]);
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
    signupDates: signupDates.map((item) => ({
      ...item,
      assignedCount: Number(item.assignedCount),
      checkedInCount: Number(item.checkedInCount),
      completedCount: Number(item.completedCount),
    })),
    unassignedMeets: unassignedMeets.map((item) => ({ ...item, openCount: Number(item.openCount) })),
  };
}

async function adminData(database, bindings) {
  const publicResult = await publicData(database);
  const demoMode = isDemoMode(bindings);
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
    demoMode,
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
  if (!(file instanceof File)) return fail("Choose a Job Signup .xls or .xlsx file.");
  if (!/\.xlsx?$/i.test(file.name)) return fail("Choose an Excel .xls or .xlsx file.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("The signup file must be smaller than 5 MB.");
  const buffer = await file.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const existing = await database.prepare(`SELECT id, file_name AS fileName, row_count AS rowCount,
    event_count AS eventCount, assigned_count AS assignedCount FROM signup_imports WHERE source_hash = ?`).bind(hash).first();
  if (existing) return responseJson({ ok: true, duplicate: true, import: existing });

  const parsed = parseSignupWorkbook(buffer);
  if (parsed.rows.length > MAX_SIGNUP_ROWS) return fail(`This file has ${parsed.rows.length} rows. The maximum is ${MAX_SIGNUP_ROWS}.`);
  const eventTitles = [...new Set(parsed.rows.map((row) => row.eventTitle).filter(Boolean))];
  const assignedCount = parsed.rows.filter((row) => row.assigned).length;
  const inserted = await database.prepare(`INSERT INTO signup_imports
    (file_name, sheet_name, source_hash, row_count, event_count, assigned_count)
    VALUES (?, ?, ?, ?, ?, ?)`).bind(file.name.slice(0, 240), parsed.sheetName, hash, parsed.rows.length, eventTitles.length, assignedCount).run();
  const importId = Number(inserted.meta?.last_row_id);
  if (!importId) throw new Error("The signup file could not be registered.");

  // A corrected file for a meet already under way must not discard the morning's work,
  // so check-ins recorded at the desk are carried onto the matching row of the new import.
  const shiftKey = (row) => [row.eventDate, row.eventTitle, row.jobName, row.slot, row.volunteerName].join("\u0000");
  const preservedCheckins = new Map();
  if (eventTitles.length) {
    const placeholders = eventTitles.map(() => "?").join(",");
    const live = await all(database, `SELECT event_date AS eventDate, event_title AS eventTitle, job_name AS jobName,
      slot, volunteer_name AS volunteerName, checked_in_at AS checkedInAt, checked_out_at AS checkedOutAt,
      completed, credited_value AS creditedValue, credit_earned AS creditEarned, volunteer_override AS volunteerOverride
      FROM signup_rows WHERE active = 1 AND checked_in_at IS NOT NULL AND event_title IN (${placeholders})`, ...eventTitles);
    for (const row of live) preservedCheckins.set(shiftKey(row), row);
    await database.prepare(`UPDATE signup_rows SET active = 0 WHERE active = 1 AND event_title IN (${placeholders})`)
      .bind(...eventTitles).run();
  }
  const statements = parsed.rows.map((row) => {
    const kept = preservedCheckins.get(shiftKey(row));
    return database.prepare(`INSERT INTO signup_rows (
      import_id, source_row, active, assigned, event_title, event_start, event_end, event_date,
      account, account_name, swimmer_name, job_name, credit_possible, credit_earned, credit_units,
      slot, completed, notes, volunteer_info, volunteer_name, credited_value,
      checked_in_at, checked_out_at, volunteer_override
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
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
  for (let index = 0; index < statements.length; index += 75) await database.batch(statements.slice(index, index + 75));
  const keptCount = parsed.rows.reduce((total, row) => total + (preservedCheckins.has(shiftKey(row)) ? 1 : 0), 0);
  return responseJson({
    ok: true,
    duplicate: false,
    import: {
      id: importId, fileName: file.name, rowCount: parsed.rows.length,
      eventCount: eventTitles.length, assignedCount, keptCheckins: keptCount,
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
  const stem = String(source.fileName).replace(/\.xlsx?$/i, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "JTSC-JobSignup";
  return new Response(output, {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="${stem}-updated.xls"`,
      "Cache-Control": "no-store",
    },
  });
}

async function handleCheckin(request, database) {
  const body = await request.json();
  if (body.action === "signup_checkin") {
    const id = number(body.id, 1, Number.MAX_SAFE_INTEGER);
    const hours = number(body.creditedHours, 0, 24);
    if (!id || hours === null) return fail("Choose a valid volunteer shift and credit amount.");
    const row = await database.prepare("SELECT credit_possible AS creditPossible FROM signup_rows WHERE id = ? AND active = 1 AND assigned = 1").bind(id).first();
    if (!row) return fail("That volunteer assignment is no longer available.", 404);
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
    database.prepare("SELECT id FROM sessions WHERE id = ? AND status = 'open'").bind(sessionId).first(),
    database.prepare("SELECT name, default_hours AS defaultHours FROM jobs WHERE id = ? AND session_id = ?").bind(jobId, sessionId).first(),
    database.prepare("SELECT name FROM swimmers WHERE id = ? AND active = 1").bind(swimmerId).first(),
  ]);
  if (!session || !job || !swimmer) return fail("That session, job, or swimmer is no longer available.", 409);
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
    const date = requiredText(body.date, "Date", 10);
    const start = requiredText(body.startTime, "Start time", 8);
    const end = requiredText(body.endTime, "End time", 8);
    const location = requiredText(body.location, "Location");
    const result = await database.prepare(`INSERT INTO sessions (title, session_date, start_time, end_time, location)
      VALUES (?, ?, ?, ?, ?)`).bind(title, date, start, end, location).run();
    return responseJson({ ok: true, id: result.meta?.last_row_id });
  }
  if (body.action === "add_job") {
    const sessionId = number(body.sessionId, 1, Number.MAX_SAFE_INTEGER);
    const name = requiredText(body.name, "Job name");
    const start = requiredText(body.startTime, "Start time", 8);
    const end = requiredText(body.endTime, "End time", 8);
    const hours = number(body.defaultHours, 0.25, 24);
    if (!sessionId || hours === null) return fail("Choose a session and valid credit hours.");
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
    await database.prepare("UPDATE volunteer_entries SET credited_hours = ?, volunteer_override = 1 WHERE id = ?").bind(hours, id).run();
    return responseJson({ ok: true });
  }
  if (body.action === "set_session_status") {
    const id = number(body.id, 1, Number.MAX_SAFE_INTEGER);
    const status = body.status === "closed" ? "closed" : body.status === "open" ? "open" : "";
    if (!id || !status) return fail("Choose a valid session status.");
    await database.prepare("UPDATE sessions SET status = ? WHERE id = ?").bind(status, id).run();
    return responseJson({ ok: true });
  }
  if (body.action === "signup_checkout_all") {
    // End of meet sweep. Volunteers routinely leave without checking out, and an
    // uncheckedout shift earns nothing, so the club would silently lose those hours.
    const eventDate = String(body.eventDate ?? "").trim();
    const eventTitle = String(body.eventTitle ?? "").trim();
    if (!eventDate || !eventTitle) return fail("Choose the meet to close out.");
    const result = await database.prepare(`UPDATE signup_rows SET checked_out_at = CURRENT_TIMESTAMP,
      completed = 1, credit_earned = COALESCE(credited_value, credit_possible)
      WHERE active = 1 AND checked_in_at IS NOT NULL AND checked_out_at IS NULL AND completed = 0
        AND event_date = ? AND event_title = ?`).bind(eventDate, eventTitle).run();
    return responseJson({ ok: true, closed: result.meta?.changes ?? 0 });
  }
  if (body.action === "reset_signup_data") {
    // Enforced here, not just hidden in the page: a control that wipes every roster must
    // not be reachable on a live deployment even by calling the endpoint directly.
    if (!isDemoMode(bindings)) return fail("Clearing data is disabled on this deployment.", 403);
    if (String(body.confirm ?? "").trim().toUpperCase() !== "RESET") {
      return fail("Type RESET to confirm clearing every imported signup roster.");
    }
    await database.batch([
      database.prepare("DELETE FROM signup_rows"),
      database.prepare("DELETE FROM signup_imports"),
      database.prepare("DELETE FROM volunteer_entries"),
    ]);
    return responseJson({ ok: true });
  }
  return fail("Unknown admin action.", 404);
}

export async function handleVolunteerRequest(request, bindings = env) {
  if (!sameOrigin(request)) return fail("Please submit this form from the JTSC website.", 403);
  const url = new URL(request.url);
  try {
    await ensureDatabase(bindings);
    const database = db(bindings);
    if (url.pathname === "/api/public" && request.method === "GET") return responseJson(await publicData(database));
    if (url.pathname === "/api/checkins" && request.method === "POST") return await handleCheckin(request, database);
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      const body = await request.json();
      // Fail closed. A fallback PIN in the source would be the real admin code for any
      // deployment that never set the secret, and it is readable by anyone with the repo.
      const adminPin = String(bindings.ADMIN_PIN ?? "").trim();
      if (!adminPin) return fail("Admin access is not configured on this deployment.", 503);
      if (String(body.pin ?? "") !== adminPin) return fail("That access code is not correct.", 401);
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
    const message = error instanceof Error ? error.message : "The volunteer desk could not complete this request.";
    return fail(message, 500);
  }
}
