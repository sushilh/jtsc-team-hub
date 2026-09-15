"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { jobHourOptions } from "../../lib/volunteer-jobs.mjs";

function localIsoDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
  const [signupWalkinName, setSignupWalkinName] = useState("");
  const [signupWalkinSwimmer, setSignupWalkinSwimmer] = useState("");
  const [signupWalkinJob, setSignupWalkinJob] = useState("");
  const [signupWalkinHours, setSignupWalkinHours] = useState("");
  const [signupDate, setSignupDate] = useState("");
  const [showPastMeets, setShowPastMeets] = useState(false);
  const [swimmerPick, setSwimmerPick] = useState("");
  const [volunteerPick, setVolunteerPick] = useState("");
  const [query, setQuery] = useState("");
  const [signupCredits, setSignupCredits] = useState({});
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/public?date=${localIsoDate()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load the volunteer desk.");
      setLoadFailed(false);
      setData(result);
      setSessionId((current) => current || result.sessions.find((session) => session.sessionDate === localIsoDate())?.id || result.sessions[0]?.id || "");
      setSignupDate((current) => {
        const keys = result.signupDates.map((item) => `${item.eventDate}|||${item.eventTitle}`);
        if (keys.includes(current)) return current;
        const todayKey = keys.find((key) => key.startsWith(`${localIsoDate()}|||`));
        // Oldest-first, so this lands on the next meet rather than the furthest away one.
        const upcoming = [...result.signupDates].reverse().find((item) => item.checkinOpen || item.eventDate >= localIsoDate());
        return todayKey || (upcoming ? `${upcoming.eventDate}|||${upcoming.eventTitle}` : "");
      });
      setSignupCredits((current) => ({
        ...Object.fromEntries(result.signupRows.map((row) => [row.id, current[row.id] ?? String(row.creditedValue ?? row.creditPossible)])),
      }));
      return result;
    } catch (error) {
      setLoadFailed(true);
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to load the volunteer desk." });
      throw error;
    }
  }, []);

  useEffect(() => {
    // The fetch owns restoring the server-backed desk state after this route mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch(() => {});
    const refresh = () => void load().catch(() => {});
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
  const clubToday = localIsoDate();
  const meetRows = useMemo(() => (data?.signupRows ?? []).filter(
    (row) => row.eventDate === selectedEventDate && row.eventTitle === selectedEventTitle,
  ), [data, selectedEventDate, selectedEventTitle]);

  const byName = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });
  // Pick a family first and the volunteer list narrows to the people on that account.
  const swimmerOptions = useMemo(
    () => [...new Set(meetRows.map((row) => row.swimmerName).filter(Boolean))].sort(byName),
    [meetRows],
  );
  const importedWalkinJobs = useMemo(
    () => (data?.signupJobs ?? []).filter((job) => job.eventDate === selectedEventDate && job.eventTitle === selectedEventTitle)
      .sort((a, b) => a.jobName.localeCompare(b.jobName, "en", { sensitivity: "base" }) || String(a.eventStart).localeCompare(String(b.eventStart))),
    [data, selectedEventDate, selectedEventTitle],
  );
  const importedWalkinSwimmers = useMemo(() => {
    const imported = (data?.signupSwimmers ?? [])
      .filter((item) => item.eventDate === selectedEventDate && item.eventTitle === selectedEventTitle)
      .map((item) => item.swimmerName);
    return [...new Set([...imported, ...(data?.swimmers ?? []).map((item) => item.name)])].filter(Boolean).sort(byName);
  }, [data, selectedEventDate, selectedEventTitle]);
  const selectedImportedJob = importedWalkinJobs.find((job) => `${job.jobName}|||${job.eventStart}|||${job.eventEnd}` === signupWalkinJob);
  const volunteerOptions = useMemo(
    () => [...new Set(meetRows
      .filter((row) => !swimmerPick || row.swimmerName === swimmerPick)
      .map((row) => row.volunteerName).filter(Boolean))].sort(byName),
    [meetRows, swimmerPick],
  );

  const signupRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return meetRows.filter((row) => (
      (!swimmerPick || row.swimmerName === swimmerPick)
      && (!volunteerPick || row.volunteerName === volunteerPick)
      && (!normalized || `${row.volunteerName} ${row.swimmerName} ${row.jobName} ${row.slot}`.toLowerCase().includes(normalized))
    )).sort((a, b) => {
      const rank = (row) => row.checkedInAt && !row.completed ? 0 : row.completed ? 2 : 1;
      return rank(a) - rank(b) || a.volunteerName.localeCompare(b.volunteerName);
    });
  }, [meetRows, query, swimmerPick, volunteerPick]);

  // A check-in desk is always working today's meet, so past ones are out of the way
  // by default. They stay reachable: a shift checked in yesterday still needs checking out.
  const currentMeets = (data?.signupDates ?? []).filter((item) => item.checkinOpen || item.eventDate >= clubToday);
  const pastMeets = (data?.signupDates ?? []).filter((item) => !item.checkinOpen && item.eventDate < clubToday);
  const visibleMeets = showPastMeets ? [...currentMeets, ...pastMeets] : currentMeets;
  const selectedProgress = (data?.signupDates ?? []).find(
    (item) => item.eventDate === selectedEventDate && item.eventTitle === selectedEventTitle,
  );
  const importedActive = (data?.signupRows ?? []).filter((row) => row.checkedInAt && !row.completed);
  const manualActive = (data?.activeEntries ?? []).filter((entry) => entry.sessionId === Number(sessionId));
  const canCheckInSelectedMeet = Boolean(selectedProgress?.checkinOpen);
  const selectedMeetClosed = selectedProgress?.checkinMode === "closed";
  const selectedMeetManuallyOpen = selectedProgress?.checkinMode === "open";
  const sessionIsToday = session?.sessionDate === clubToday;
  const ready = Boolean(volunteerName.trim() && swimmerId && selectedJob && Number(hours) > 0 && sessionIsToday);
  const signupWalkinReady = Boolean(selectedProgress && canCheckInSelectedMeet && signupWalkinName.trim()
    && signupWalkinSwimmer && selectedImportedJob && Number(signupWalkinHours) >= 0.25);

  function mutationWasSaved(result, payload, before) {
    if (payload.action === "signup_walkin") {
      const previousIds = new Set((before?.signupRows ?? []).map((row) => row.id));
      return result.signupRows.some((row) => !previousIds.has(row.id)
        && row.eventDate === payload.eventDate
        && row.eventTitle === payload.eventTitle
        && row.jobName === payload.jobName
        && row.swimmerName === payload.swimmerName
        && row.volunteerName === String(payload.volunteerName).trim()
        && row.checkedInAt && !row.completed);
    }
    if (payload.action.startsWith("signup_")) {
      const row = result.signupRows.find((item) => item.id === Number(payload.id));
      if (!row) return false;
      if (payload.action === "signup_checkin") return Boolean(row.checkedInAt && !row.completed);
      if (payload.action === "signup_checkout") return Boolean(row.completed);
      return !row.checkedInAt && !row.completed;
    }
    if (payload.action === "checkout") {
      return !result.activeEntries.some((entry) => entry.id === Number(payload.id));
    }
    const previousIds = new Set((before?.activeEntries ?? []).map((entry) => entry.id));
    return result.activeEntries.some((entry) => !previousIds.has(entry.id)
      && entry.sessionId === Number(payload.sessionId)
      && entry.volunteerName === String(payload.volunteerName).trim()
      && entry.swimmerName === before?.swimmers?.find((swimmer) => swimmer.id === Number(payload.swimmerId))?.name
      && entry.jobName === before?.sessions?.find((item) => item.id === Number(payload.sessionId))?.jobs
        ?.find((job) => job.id === Number(payload.jobId))?.name);
  }

  async function postCheckin(payload, successText, id) {
    const before = data;
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
      await load();
      setNotice({ kind: "success", text: successText });
      return true;
    } catch (error) {
      try {
        const refreshed = await load();
        if (mutationWasSaved(refreshed, payload, before)) {
          setNotice({ kind: "success", text: `${successText} The connection was interrupted, but the saved status was confirmed.` });
          return true;
        }
      } catch {
        setNotice({
          kind: "error",
          text: "The connection was interrupted and the saved status could not be confirmed. Refresh the desk before trying again.",
        });
        return false;
      }
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

  async function signupWalkinCheckIn(event) {
    event.preventDefault();
    if (!signupWalkinReady || !selectedImportedJob) return;
    const saved = await postCheckin({
      action: "signup_walkin",
      eventDate: selectedEventDate,
      eventTitle: selectedEventTitle,
      jobName: selectedImportedJob.jobName,
      swimmerName: signupWalkinSwimmer,
      volunteerName: signupWalkinName,
      creditedHours: Number(signupWalkinHours),
    }, `${signupWalkinName.trim()} is checked in for ${selectedImportedJob.jobName}.`, "signup-walkin");
    if (saved) {
      setSignupWalkinName(""); setSignupWalkinSwimmer(""); setSignupWalkinJob(""); setSignupWalkinHours("");
    }
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

        {!data && loadFailed ? <div className="empty-state"><strong>The roster could not load</strong><span>Check the connection, then try again.</span><button type="button" className="inline-link" onClick={() => { setNotice(null); void load().catch(() => {}); }}>Retry loading</button></div>
          : !data ? <div className="loading-state"><i /><span>Preparing the meet roster…</span></div>
          : visibleMeets.length ? <>
            <div className="signup-toolbar">
              <label className="field">
                <span>Meet date and event</span>
                <select value={signupDate} onChange={(event) => {
                  setSignupDate(event.target.value);
                  setQuery(""); setSwimmerPick(""); setVolunteerPick("");
                  setSignupWalkinSwimmer(""); setSignupWalkinJob(""); setSignupWalkinHours("");
                }}>
                  {visibleMeets.map((item) => <option key={`${item.eventDate}-${item.eventTitle}`} value={`${item.eventDate}|||${item.eventTitle}`}>
                    {displayDate(item.eventDate)} · {item.eventTitle}{item.eventDate < localIsoDate() ? " (past)" : ""}
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

            <div className="signup-pickers">
              <label className="field">
                <span>Swimmer / account</span>
                <select value={swimmerPick} onChange={(event) => { setSwimmerPick(event.target.value); setVolunteerPick(""); }}>
                  <option value="">All swimmers ({swimmerOptions.length})</option>
                  {swimmerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Volunteer name</span>
                <select value={volunteerPick} onChange={(event) => setVolunteerPick(event.target.value)}>
                  <option value="">All volunteers ({volunteerOptions.length})</option>
                  {volunteerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              {(swimmerPick || volunteerPick || query) && <button type="button" className="picker-clear"
                onClick={() => { setSwimmerPick(""); setVolunteerPick(""); setQuery(""); }}
              >Show everyone</button>}
            </div>

            {pastMeets.length > 0 && <p className="past-meets-note">
              {showPastMeets
                ? <>Past meets are listed above. <button type="button" onClick={() => setShowPastMeets(false)}>Hide them</button></>
                : <>{pastMeets.length} past {pastMeets.length === 1 ? "meet is" : "meets are"} hidden. <button type="button" onClick={() => setShowPastMeets(true)}>Show past meets</button></>}
            </p>}

            <div className="signup-result-head" aria-live="polite">
              <span><strong>{signupRows.length}</strong> matching {signupRows.length === 1 ? "assignment" : "assignments"}</span>
              {selectedProgress && <span className="signup-progress">
                <b className="progress-on-deck">{selectedProgress.checkedInCount}</b> on deck
                <i aria-hidden="true">·</i>
                <b className="progress-done">{selectedProgress.completedCount}</b> completed
                <i aria-hidden="true">·</i>
                <b>{selectedProgress.assignedCount}</b> expected
              </span>}
              <small>{selectedMeetClosed
                ? "Check-in is closed by an admin. Volunteers already on deck can still check out."
                : selectedMeetManuallyOpen
                  ? "An admin opened check-in for this meet. Credit can be adjusted before check-in."
                  : canCheckInSelectedMeet
                    ? "Credit comes from the signup file and can be adjusted before check-in."
                    : `This roster is view-only. Check-in opens ${displayDate(selectedEventDate)}.`}</small>
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
                      <span className={`signup-status ${row.completed ? "done" : active ? "live" : selectedMeetClosed ? "closed" : "ready"}`}>
                        {row.completed ? "Completed" : active ? "On deck" : selectedMeetClosed ? "Closed" : canCheckInSelectedMeet ? "Ready" : "Upcoming"}
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
                        disabled={busyId !== null || (!active && !canCheckInSelectedMeet)}
                        onClick={() => void (active ? signupCheckOut(row) : signupCheckIn(row))}
                      >{busyId === `signup-${row.id}` ? "Saving…" : active ? "Check out" : canCheckInSelectedMeet ? "Check in" : selectedMeetClosed ? "Closed" : "Not open"}</button>}
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
          </> : pastMeets.length && !showPastMeets ? <div className="empty-state">
            <strong>No meet today</strong>
            <span>
              {`The most recent roster is ${displayDate(pastMeets[0].eventDate)} · ${pastMeets[0].eventTitle}. `}
              <button type="button" className="inline-link" onClick={() => setShowPastMeets(true)}>Open it anyway</button>
              {" — or import the roster for the next meet."}
            </span>
          </div>
          : data.unassignedMeets?.length ? <div className="empty-state">
            <strong>Nobody has signed up yet</strong>
            <span>
              {data.unassignedMeets.map((item) => `${item.openCount} open ${item.openCount === 1 ? "shift" : "shifts"} for ${item.eventTitle}`).join(", ")}
              {" — but no volunteer names are in the file. Export the Job Signup again once parents have signed up, then re-import it here."}
            </span>
          </div>
          : <div className="empty-state"><strong>No signup roster uploaded yet</strong><span>An admin can import the meet’s Job Signup file.</span></div>}

        {notice && <div className={`notice ${notice.kind}`} role="status">
          <b>{notice.kind === "success" ? "✓" : "!"}</b><span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button>
        </div>}

        <details className="walkin-panel" open={!data?.signupDates.length || Boolean(selectedProgress && importedWalkinJobs.length && canCheckInSelectedMeet)}>
          <summary>Walk-in volunteer <span>Add someone using an imported job or a manual session</span></summary>
          {selectedProgress && importedWalkinJobs.length > 0 && <form className="signup-walkin-form" noValidate onSubmit={signupWalkinCheckIn}>
            <div className="walkin-form-heading"><strong>Use a job from this signup</strong><span>Choose the meet’s existing job, then add the walk-in.</span></div>
            {!canCheckInSelectedMeet && <p className="past-meets-note">{selectedMeetClosed ? "An admin closed this meet’s check-in." : `Check-in opens ${displayDate(selectedEventDate)}.`}</p>}
            <div className="form-row">
              <label className="field"><span>Walk-in volunteer name</span><input value={signupWalkinName} onChange={(event) => setSignupWalkinName(event.target.value)} placeholder="First and last name" autoComplete="name" /></label>
              <label className="field"><span>Walk-in swimmer</span><select value={signupWalkinSwimmer} onChange={(event) => setSignupWalkinSwimmer(event.target.value)}>
                <option value="">Select swimmer</option>
                {importedWalkinSwimmers.map((name) => <option value={name} key={name}>{name}</option>)}
              </select></label>
            </div>
            <label className="field job-select-field"><span>Walk-in job</span><select value={signupWalkinJob} onChange={(event) => {
              const next = event.target.value; setSignupWalkinJob(next);
              const picked = importedWalkinJobs.find((job) => `${job.jobName}|||${job.eventStart}|||${job.eventEnd}` === next);
              setSignupWalkinHours(picked ? String(picked.creditPossible) : "");
            }}>
              <option value="">Choose from {importedWalkinJobs.length} imported jobs…</option>
              {importedWalkinJobs.map((job) => {
                const key = `${job.jobName}|||${job.eventStart}|||${job.eventEnd}`;
                return <option value={key} key={key}>{job.jobName} · {shiftTime(job.eventStart, job.eventEnd)} · {job.creditPossible} {job.creditUnits || "hrs"}</option>;
              })}
            </select></label>
            <div className="hours-row">
              <label className="field compact-field"><span>Walk-in hours</span><div className="number-wrap"><input type="number" min="0.25" max="24" step="0.25" value={signupWalkinHours} onChange={(event) => setSignupWalkinHours(event.target.value)} /><b>HRS</b></div></label>
              <p className="field-help">The imported credit is a starting point. You can overwrite it for this walk-in.</p>
            </div>
            <button className="primary-button" type="submit" disabled={!signupWalkinReady || busyId !== null}><span>{busyId === "signup-walkin" ? "Saving…" : "Check in walk-in"}</span><b aria-hidden="true">→</b></button>
          </form>}
          {!data?.sessions.length ? !importedWalkinJobs.length && <div className="empty-state compact"><strong>No manual session is open</strong><span>An admin can create one for walk-ins.</span></div>
            : <form noValidate onSubmit={manualCheckIn}>
              {data.sessions.length > 1 && <label className="field"><span>Session</span><select value={sessionId} onChange={(event) => { setSessionId(Number(event.target.value)); setJobId(""); setHours(""); }}>
                {data.sessions.map((item) => <option value={item.id} key={item.id}>{item.title} · {item.sessionDate}</option>)}
              </select></label>}
              {session && <div className="session-strip"><div><strong>{session.title}</strong><span>{displayDate(session.sessionDate)}</span></div><div><strong>{displayTime(session.startTime)}–{displayTime(session.endTime)}</strong><span>{session.location}</span></div></div>}
              {session && !sessionIsToday && <p className="past-meets-note">Walk-in check-in opens {displayDate(session.sessionDate)}.</p>}
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
