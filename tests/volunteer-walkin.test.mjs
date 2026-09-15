import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { clubIsoDate, handleVolunteerRequest } from "../lib/volunteer-service.mjs";
import { SIGNUP_HEADERS, makeSignupWorkbook, parseSignupWorkbook } from "../lib/job-signup.mjs";

// Run the real request handlers and SQL against an isolated SQLite database.
// This adapter mirrors the D1 operations used by the service, including atomic batches.
function localDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const database = {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; },
        async run() {
          const result = sqlite.prepare(sql).run(...values);
          return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { database, sqlite };
}

test("new parents and swimmers can walk in without changing existing signups or losing attendance on re-import", async () => {
  const { database, sqlite } = localDatabase();
  const bindings = { DB: database, ADMIN_PIN: "local-test-only", SESSION_SECRET: "local-test-session" };
  let cookie = "";
  const request = (path, data) => handleVolunteerRequest(new Request(`http://localhost${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { Cookie: cookie, ...(data instanceof FormData ? {} : { "Content-Type": "application/json" }) },
    body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
  }), bindings);
  const post = async (path, body, status = 200) => {
    const response = await request(path, body);
    const json = await response.json();
    assert.equal(response.status, status, JSON.stringify(json));
    return json;
  };
  const login = await request("/api/admin/login", { pin: "local-test-only" });
  cookie = login.headers.get("set-cookie").split(";")[0];
  const today = clubIsoDate();
  const [year, month, day] = today.split("-");
  const date = `${month}/${day}/${year}`;
  const scope = { eventDate: today, eventTitle: "Walk-in regression meet" };
  const rows = [
    { ...scope, eventStart: `${date} 7:00:00 AM`, eventEnd: `${date} 12:00:00 PM`, account: "Existing Family", volunteerInfo: "Existing Parent", jobName: "Timer", creditPossible: 5, creditUnits: "Hrs.", slot: "#1" },
    { ...scope, eventStart: `${date} 1:00:00 PM`, eventEnd: `${date} 4:00:00 PM`, account: "Another Family", volunteerInfo: "Another Parent", jobName: "Timer", creditPossible: 3, creditUnits: "Hrs.", slot: "#2" },
    { ...scope, eventStart: `${date} 1:00:00 PM`, eventEnd: `${date} 4:00:00 PM`, account: "", volunteerInfo: "", jobName: "Runner", creditPossible: 3, creditUnits: "Hrs.", slot: "#3" },
  ];
  const upload = async (sourceRows) => {
    const form = new FormData();
    form.set("file", new File([makeSignupWorkbook(sourceRows)], "signup.xls"));
    return post("/api/admin/signup-import", form);
  };
  try {
    const imported = await upload(rows);
    let desk = await (await request("/api/public")).json();
    assert.equal(desk.signupRows.length, 2);
    assert.equal(desk.signupJobs.length, 3, "same job at different times remains distinct");
    assert.equal(desk.swimmers.length, 0, "walk-ins need no preloaded swimmer directory");
    const expectedId = desk.signupRows.find((row) => row.volunteerName === "Existing Parent").id;
    await post("/api/checkins", { action: "signup_checkin", id: expectedId, creditedHours: 4.5 });
    const existingBefore = (await (await request("/api/public")).json()).signupRows;
    const job = desk.signupJobs.find((job) => job.jobName === "Timer" && job.creditPossible === 3);
    const walkin = {
      action: "signup_walkin", ...scope, sourceId: job.sourceId, jobName: job.jobName,
      volunteerName: "New Parent", swimmerName: "New Swimmer", creditedHours: 2.5,
    };
    await post("/api/checkins", { ...walkin, swimmerName: "   " }, 400);
    await post("/api/checkins", { ...walkin, creditedHours: 25 }, 400);
    await post("/api/admin", { action: "set_signup_meet_checkin", ...scope, checkinMode: "closed" });
    await post("/api/checkins", walkin, 409);
    await post("/api/admin", { action: "set_signup_meet_checkin", ...scope, checkinMode: "open" });
    const added = await post("/api/checkins", walkin);
    desk = await (await request("/api/public")).json();
    assert.deepEqual(desk.signupRows.filter((row) => row.id !== added.id), existingBefore);
    const newRow = desk.signupRows.find((row) => row.id === added.id);
    assert.equal(newRow.swimmerName, "New Swimmer");
    assert.equal(newRow.volunteerName, "New Parent");
    assert.equal(newRow.eventStart, job.eventStart, "the chosen afternoon shift is saved");
    assert.equal(newRow.creditPossible, 3);
    assert.equal(newRow.creditedValue, 2.5);
    assert.ok(newRow.checkedInAt);
    const admin = await (await request("/api/admin")).json();
    assert.equal(admin.signupImports[0].rowCount, 4);
    assert.equal(admin.signupImports[0].assignedCount, 3);

    const beforeRepeat = desk.signupRows;
    assert.equal((await upload(rows)).duplicate, true);
    assert.deepEqual((await (await request("/api/public")).json()).signupRows, beforeRepeat);
    // Older deployments appended walk-ins without updating import counts.
    sqlite.prepare("UPDATE signup_imports SET row_count = 3 WHERE id = ?").run(imported.import.id);
    assert.equal((await upload(rows)).duplicate, true);
    assert.deepEqual((await (await request("/api/public")).json()).signupRows, beforeRepeat);

    await post("/api/checkins", { action: "signup_checkout", id: added.id });
    const workbook = await (await request(`/api/admin/signup-export?importId=${imported.import.id}`)).arrayBuffer();
    const exported = parseSignupWorkbook(workbook);
    assert.deepEqual(exported.headers, SIGNUP_HEADERS);
    assert.equal(exported.rows.length, 4);
    const exportedWalkin = exported.rows.find((row) => row.volunteerName === "New Parent");
    assert.equal(exportedWalkin.swimmerName, "New Swimmer");
    assert.equal(exportedWalkin.creditEarned, 2.5);
    assert.equal(exportedWalkin.completed, true);

    await upload(rows.map((row) => ({ ...row, notes: "Corrected roster" })));
    desk = await (await request("/api/public")).json();
    assert.equal(desk.signupRows.length, 3);
    assert.ok(desk.signupRows.find((row) => row.volunteerName === "Existing Parent").checkedInAt);
    const carried = desk.signupRows.find((row) => row.volunteerName === "New Parent");
    assert.equal(carried.completed, true);
    assert.equal(carried.creditEarned, 2.5);
    assert.equal(carried.swimmerName, "New Swimmer");
  } finally {
    sqlite.close();
  }
});
