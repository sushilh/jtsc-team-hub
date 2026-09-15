"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { jobHourOptions } from "../../lib/volunteer-jobs.mjs";

function localIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function displayDate(value) {
  if (!value) return "Date not listed";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function displayTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2020, 0, 1, hours, minutes));
}

function shiftTime(start, end) {
  const extract = (value) => String(value ?? "").match(/\b(\d{1,2}:\d{2})(?::\d{2})?\s*([AP]M)\b/i);
  const startParts = extract(start);
  const endParts = extract(end);
  if (!startParts || !endParts) return "Time listed in signup file";
  return `${startParts[1]} ${startParts[2].toUpperCase()}–${endParts[1]} ${endParts[2].toUpperCase()}`;
}

function initials(name) {
  return String(name || "JT").replace(",", " ").split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function Brand({ compact = false }) {
  return <div className={`brand ${compact ? "brand-compact" : ""}`}>
    <span className="brand-mark" aria-hidden="true"><span>JT</span><i /></span>
    <span><strong>JENKS TROJAN</strong><small>SWIM CLUB</small></span>
  </div>;
}

function VolunteerApp() {
  const [data, setData] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [swimmerId, setSwimmerId] = useState("");
  const [jobId, setJobId] = useState("");
  const [hours, setHours] = useState("");
  const [signupDate, setSignupDate] = useState("");
  const [query, setQuery] = useState("");
  const [signupCredits, setSignupCredits] = useState({});
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/public?date=${localIsoDate()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load the volunteer desk.");
      setData(result);
      setSessionId((current) => current || result.sessions.find((session) => session.sessionDate === localIsoDate())?.id || result.sessions[0]?.id || "");
      setSignupDate((current) => {
        const keys = result.signupDates.map((item) => `${item.eventDate}|||${item.eventTitle}`);
        if (keys.includes(current)) return current;
        const todayKey = keys.find((key) => key.startsWith(`${localIsoDate()}|||`));
        const upcoming = [...result.signupDates].reverse().find((item) => item.eventDate >= localIsoDate());
        return todayKey || (upcoming ? `${upcoming.eventDate}|||${upcoming.eventTitle}` : keys[0]) || "";
      });
      setSignupCredits((current) => ({
        ...Object.fromEntries(result.signupRows.map((row) => [row.id, current[row.id] ?? String(row.creditedValue ?? row.creditPossible)])),
      }));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to load the volunteer desk." });
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("jtsc:refresh-volunteers", refresh);
    return () => window.removeEventListener("jtsc:refresh-volunteers", refresh);
  }, [load]);

  const session = data?.sessions.find((item) => item.id === Number(sessionId));
  const selectedJob = session?.jobs.find((job) => job.id === Number(jobId));
  const sortedJobs = useMemo(
    () => [...(session?.jobs ?? [])].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true })),
    [session],
  );
  const hourPresets = useMemo(() => {
    const options = jobHourOptions(selectedJob?.name);
    const withDefault = selectedJob ? [...options, Number(selectedJob.defaultHours)] : options;
    return [...new Set(withDefault.filter((value) => Number(value) > 0))].sort((a, b) => a - b);
  }, [selectedJob]);

  const [selectedEventDate, selectedEventTitle] = signupDate.split("|||");
  const signupRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.signupRows ?? []).filter((row) => (
      row.eventDate === selectedEventDate && row.eventTitle === selectedEventTitle
      && (!normalized || `${row.volunteerName} ${row.swimmerName} ${row.jobName} ${row.slot}`.toLowerCase().includes(normalized))
    )).sort((a, b) => {
      const rank = (row) => row.checkedInAt && !row.completed ? 0 : row.completed ? 2 : 1;
      return rank(a) - rank(b) || a.volunteerName.localeCompare(b.volunteerName);
    });
  }, [data, query, selectedEventDate, selectedEventTitle]);

  const selectedProgress = (data?.signupDates ?? []).find(
    (item) => item.eventDate === selectedEventDate && item.eventTitle === selectedEventTitle,
  );
  const importedActive = (data?.signupRows ?? []).filter((row) => row.checkedInAt && !row.completed);
  const manualActive = (data?.activeEntries ?? []).filter((entry) => entry.sessionId === Number(sessionId));
  const ready = Boolean(volunteerName.trim() && swimmerId && selectedJob && Number(hours) > 0);

  async function postCheckin(payload, successText, id) {
    setBusyId(id);
    setNotice(null);
    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The volunteer update could not be saved.");
      setNotice({ kind: "success", text: successText });
      await load();
      return true;
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "The volunteer update could not be saved." });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function signupCheckIn(row) {
    const credit = Number(signupCredits[row.id]);
    if (!Number.isFinite(credit) || credit < 0 || credit > 24) {
      setNotice({ kind: "error", text: "Enter a credit amount from 0 to 24." });
      return;
    }
    await postCheckin(
      { action: "signup_checkin", id: row.id, creditedHours: credit },
      `${row.volunteerName} is checked in for ${row.jobName}.`,
      `signup-${row.id}`,
    );
  }

  async function signupUndo(row) {
    await postCheckin(
      { action: "signup_undo", id: row.id },
      `${row.volunteerName} is back on the expected list.`,
      `signup-${row.id}`,
    );
  }

  async function signupCheckOut(row) {
    await postCheckin(
      { action: "signup_checkout", id: row.id },
      `${row.volunteerName} is checked out. ${row.creditedValue} ${row.creditUnits || "hours"} recorded.`,
      `signup-${row.id}`,
    );
  }

  async function manualCheckIn(event) {
    event.preventDefault();
    if (!ready || !session) return;
    const saved = await postCheckin({
      action: "checkin", sessionId: session.id, jobId, swimmerId, volunteerName, creditedHours: Number(hours),
    }, `You're checked in, ${volunteerName.trim().split(" ")[0]}!`, "manual");
    if (saved) {
      setVolunteerName(""); setSwimmerId(""); setJobId(""); setHours("");
    }
  }

  async function manualCheckOut(entry) {
    await postCheckin(
      { action: "checkout", id: entry.id },
      `${entry.volunteerName} is checked out. ${entry.creditedHours} volunteer hours recorded.`,
      `manual-${entry.id}`,
    );
  }

  return <main className="site-shell volunteer-desk">
    <header className="public-header page-width">
      <Brand />
      <a className="quiet-link" href="#admin"><span className="lock-dot" />Admin portal</a>
    </header>

    <section className="hero page-width">
      <div className="hero-copy">
        <span className="eyebrow">03 / VOLUNTEER CREW</span>
        <h1>Meet-day check-in</h1>
        <p>Find your signup, confirm the listed credit, and check in with one click.</p>
      </div>
    </section>

    <div className="page-width content-grid volunteer-grid">
      <section className="checkin-card expected-card">
        <div className="card-head">
          <div><span className="step-number">01</span><h2>Expected volunteers</h2></div>
          <span className="live-pill"><i /> LIVE</span>
        </div>

        {!data ? <div className="loading-state"><i /><span>Preparing the meet roster…</span></div>
          : data.signupDates.length ? <>
            <div className="signup-toolbar">
              <label className="field">
                <span>Meet date and event</span>
                <select value={signupDate} onChange={(event) => { setSignupDate(event.target.value); setQuery(""); }}>
                  {data.signupDates.map((item) => <option key={`${item.eventDate}-${item.eventTitle}`} value={`${item.eventDate}|||${item.eventTitle}`}>
                    {displayDate(item.eventDate)} · {item.eventTitle}
                  </option>)}
                </select>
              </label>
              <label className="field signup-search">
                <span>Find your name, swimmer / account, or job</span>
                <span className="search-wrap">
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start typing a name or job" type="search" autoComplete="off" />
                  {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear volunteer search">×</button>}
                </span>
              </label>
            </div>

            <div className="signup-result-head" aria-live="polite">
              <span><strong>{signupRows.length}</strong> matching {signupRows.length === 1 ? "assignment" : "assignments"}</span>
              {selectedProgress && <span className="signup-progress">
                <b className="progress-on-deck">{selectedProgress.checkedInCount}</b> on deck
                <i aria-hidden="true">·</i>
                <b className="progress-done">{selectedProgress.completedCount}</b> completed
                <i aria-hidden="true">·</i>
                <b>{selectedProgress.assignedCount}</b> expected
              </span>}
              <small>Credit comes from the signup file and can be adjusted before check-in.</small>
            </div>

            <div className="signup-list">
              {signupRows.slice(0, 120).map((row) => {
                const active = row.checkedInAt && !row.completed;
                const unit = row.creditUnits === "Pts." ? "pts" : "hrs";
                return <article className={`signup-person ${active ? "checked-in" : ""} ${row.completed ? "completed" : ""}`} key={row.id}>
                  <span className="avatar">{initials(row.volunteerName)}</span>
                  <div className="signup-person-copy">
                    <div className="signup-name-line">
                      <strong>{row.volunteerName}</strong>
                      <span className={`signup-status ${row.completed ? "done" : active ? "live" : "ready"}`}>
                        {row.completed ? "Completed" : active ? "On deck" : "Ready"}
                      </span>
                    </div>
                    <span>{row.jobName} · {shiftTime(row.eventStart, row.eventEnd)} · {row.slot}</span>
                    <small>Swimmer / account: {row.swimmerName || "Not listed"}</small>
                  </div>
                  <label className="signup-credit">
                    <span>Credit</span>
                    <span><input
                      type="number" min="0" max="24" step="0.25"
                      value={signupCredits[row.id] ?? row.creditPossible}
                      disabled={active || row.completed}
                      onChange={(event) => setSignupCredits((current) => ({ ...current, [row.id]: event.target.value }))}
                      aria-label={`Credit for ${row.volunteerName}`}
                    /><b>{unit}</b></span>
                  </label>
                  <div className="signup-person-actions">
                    {row.completed
                      ? <span className="completed-mark" aria-label="Shift completed">✓</span>
                      : <button
                        className={active ? "checkout-button" : "roster-checkin-button"}
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void (active ? signupCheckOut(row) : signupCheckIn(row))}
                      >{busyId === `signup-${row.id}` ? "Saving…" : active ? "Check out" : "Check in"}</button>}
                    {/* Only a check-in made at this desk can be undone; rows the file marked
                        completed have no checkedInAt and stay exactly as the file recorded them. */}
                    {row.checkedInAt && <button
                      className="undo-button"
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void signupUndo(row)}
                      title={`Undo the check-in for ${row.volunteerName}`}
                    >Undo</button>}
                  </div>
                </article>;
              })}
              {!signupRows.length && <div className="deck-empty"><span>⌕</span><strong>No matching signup</strong><small>Try a last name, swimmer / account name, or job.</small></div>}
              {signupRows.length > 120 && <p className="signup-limit">Showing the first 120 matches. Add a name or job to narrow the list.</p>}
            </div>
          </> : <div className="empty-state"><strong>No signup roster uploaded yet</strong><span>An admin can import the meet’s Job Signup Excel file.</span></div>}

        {notice && <div className={`notice ${notice.kind}`} role="status">
          <b>{notice.kind === "success" ? "✓" : "!"}</b><span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button>
        </div>}

        <details className="walkin-panel" open={!data?.signupDates.length}>
          <summary>Walk-in volunteer <span>Not listed in the signup file?</span></summary>
          {!data?.sessions.length ? <div className="empty-state compact"><strong>No manual session is open</strong><span>An admin can create one for walk-ins.</span></div>
            : <form noValidate onSubmit={manualCheckIn}>
              {data.sessions.length > 1 && <label className="field"><span>Session</span><select value={sessionId} onChange={(event) => { setSessionId(Number(event.target.value)); setJobId(""); setHours(""); }}>
                {data.sessions.map((item) => <option value={item.id} key={item.id}>{item.title} · {item.sessionDate}</option>)}
              </select></label>}
              {session && <div className="session-strip"><div><strong>{session.title}</strong><span>{displayDate(session.sessionDate)}</span></div><div><strong>{displayTime(session.startTime)}–{displayTime(session.endTime)}</strong><span>{session.location}</span></div></div>}
              <div className="form-row">
                <label className="field"><span>Your full name</span><input value={volunteerName} onChange={(event) => setVolunteerName(event.target.value)} placeholder="First and last name" autoComplete="name" /></label>
                <label className="field"><span>Your swimmer</span><select value={swimmerId} onChange={(event) => setSwimmerId(Number(event.target.value) || "")}>
                  <option value="">Select swimmer</option>
                  {data.swimmers.map((swimmer) => <option value={swimmer.id} key={swimmer.id}>{swimmer.name} · {swimmer.groupName}</option>)}
                </select></label>
              </div>
              <label className="field job-select-field"><span>Select your assignment</span><select value={jobId} onChange={(event) => {
                const nextId = Number(event.target.value) || ""; setJobId(nextId);
                const picked = session?.jobs.find((job) => job.id === nextId); setHours(picked ? String(picked.defaultHours) : "");
              }}>
                <option value="">{sortedJobs.length ? `Choose from ${sortedJobs.length} jobs…` : "No jobs posted yet"}</option>
                {sortedJobs.map((job) => <option value={job.id} key={job.id}>{job.name} · {displayTime(job.startTime)}–{displayTime(job.endTime)} · {job.defaultHours} hrs</option>)}
              </select></label>
              <div className="hours-row">
                <label className="field compact-field"><span>Hours to credit</span><div className="number-wrap"><input type="number" min="0.25" max="24" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} /><b>HRS</b></div></label>
                {hourPresets.length > 1 && <div className="hour-presets"><span className="preset-label">Common for this job</span><div className="preset-chips" role="group" aria-label="Common credit hours">
                  {hourPresets.map((value) => <button type="button" className={`preset-chip ${Number(hours) === value ? "selected" : ""}`} aria-pressed={Number(hours) === value} onClick={() => setHours(String(value))} key={value}>{value} hrs</button>)}
                </div></div>}
              </div>
              <button className="primary-button" type="submit" disabled={!ready || busyId !== null}><span>{busyId === "manual" ? "Saving…" : "Check in walk-in"}</span><b aria-hidden="true">→</b></button>
            </form>}
        </details>
      </section>

      <aside className="on-deck-card">
        <div className="card-head"><div><span className="step-number">02</span><h2>On deck now</h2></div><span className="count-badge">{importedActive.length + manualActive.length}</span></div>
        <p className="aside-intro">Finished your shift? Find your name and check out.</p>
        <div className="active-list">
          {importedActive.map((row) => <div className="active-person" key={`signup-${row.id}`}>
            <span className="avatar">{initials(row.volunteerName)}</span><div><strong>{row.volunteerName}</strong><span>{row.jobName} · {row.creditedValue} {row.creditUnits === "Pts." ? "pts" : "hrs"}</span><small>For {row.swimmerName}</small></div>
            <button type="button" onClick={() => void signupCheckOut(row)} disabled={busyId !== null}>Check out</button>
          </div>)}
          {manualActive.map((entry) => <div className="active-person" key={`manual-${entry.id}`}>
            <span className="avatar">{initials(entry.volunteerName)}</span><div><strong>{entry.volunteerName}</strong><span>{entry.jobName} · {entry.creditedHours} hrs</span><small>For {entry.swimmerName}</small></div>
            <button type="button" onClick={() => void manualCheckOut(entry)} disabled={busyId !== null}>Check out</button>
          </div>)}
          {!importedActive.length && !manualActive.length && <div className="deck-empty"><span>〰</span><strong>The deck is clear</strong><small>Checked-in volunteers will appear here.</small></div>}
        </div>
        <div className="help-note"><b>Need help?</b><span>See the check-in operator at the volunteer desk.</span></div>
      </aside>
    </div>

    <footer className="public-footer page-width"><Brand compact /><p>Every shift makes a splash.</p><span>JENKS, OKLAHOMA</span></footer>
  </main>;
}

export default VolunteerApp;
