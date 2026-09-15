"use client";

// Recovered from the existing Volunteer Crew production bundle; preserves its workflows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { volunteerJobCatalog, volunteerJobNames, defaultJobHours } from "../../lib/volunteer-jobs.mjs";

function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function timeLabel(value) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(2020, 0, 1, hour, minute));
}
function dateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T12:00:00Z`));
}
function stamp(value) {
  if (!value) return "\u2014";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(normalized));
}
function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 1440;
  return Math.round(minutes / 60 * 100) / 100;
}
function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
function Brand2() {
  return jsxs("div", {
    className: "admin-brand",
    children: [jsx("span", { children: "JT" }), jsxs("div", { children: [jsx("strong", { children: "VOLUNTEER CREW" }), jsx("small", { children: "JTSC ADMIN" })] })]
  });
}
function AdminApp() {
  const [authenticated, setAuthenticated] = useState(null);
  const [pin, setPin] = useState("");
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reportMeet, setReportMeet] = useState("all");
  const [ledgerView, setLedgerView] = useState("people");
  const [showPin, setShowPin] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      setData(null);
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load admin data.");
    setAuthenticated(true);
    setData(result);
  }, []);
  useEffect(() => {
    // Fetch restores the current upstream session, including its authorization state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((error) => {
      setAuthenticated(false);
      setMessage({ kind: "error", text: error.message });
    });
  }, [load]);
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      setPin("");
      await load();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Unable to sign in."
      });
    } finally {
      setBusy(false);
    }
  }
  async function mutate(payload, success) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save your change.");
      setMessage({
        kind: "success",
        text: success
      });
      await load();
      return true;
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Unable to save your change."
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  // Posting the standard job list one shift at a time, then refreshing once at the end.
  async function bulkAddJobs(sessionId, jobsToAdd) {
    setBusy(true);
    setMessage(null);
    const failed = [];
    let added = 0;
    try {
      for (const job of jobsToAdd) {
        try {
          const response = await fetch("/api/admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add_job",
              sessionId,
              name: job.name,
              startTime: job.startTime,
              endTime: job.endTime,
              defaultHours: Number(job.defaultHours)
            })
          });
          if (!response.ok) { failed.push(job.name); continue; }
          added += 1;
        } catch {
          failed.push(job.name);
        }
      }
      setMessage(failed.length ? {
        kind: "error",
        text: `Added ${added} ${added === 1 ? "job" : "jobs"}. ${failed.length} could not be added: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}`
      } : {
        kind: "success",
        text: `${added} standard ${added === 1 ? "job is" : "jobs are"} now on this session.`
      });
      await load();
      return added;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setData(null);
  }
  async function importSignup(file) {
    if (!/\.(?:xlsx?|csv)$/i.test(file.name)) {
      setMessage({ kind: "error", text: "Choose a Job Signup .xls, .xlsx, or .csv file." });
      return false;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setMessage({ kind: "error", text: file.size ? "The signup file must be smaller than 5 MB." : "The signup file is empty." });
      return false;
    }
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/signup-import", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The signup file could not be imported.");
      const imported = result.import;
      setMessage({
        kind: "success",
        text: result.duplicate
          ? `${imported.fileName || file.name} was already imported. No duplicate rows were added.`
          : result.resumed
          ? `${imported.fileName || file.name} finished activating after an interrupted upload. The full roster is ready.`
          : imported.assignedCount === 0
          ? `${imported.rowCount} shifts were imported, but no volunteer names are in this file yet. Export the Job Signup again once parents have signed up, then re-import it here.`
          : [
            `${imported.assignedCount} assigned volunteers are ready to check in across ${imported.eventCount} events.`,
            imported.keptCheckins ? `${imported.keptCheckins} check-in${imported.keptCheckins === 1 ? "" : "s"} already recorded at the desk ${imported.keptCheckins === 1 ? "was" : "were"} kept.` : "",
            imported.droppedCheckins ? `${imported.droppedCheckins} earlier check-in${imported.droppedCheckins === 1 ? " no longer matches a shift in this file and was" : "s no longer match a shift in this file and were"} set aside.` : "",
          ].filter(Boolean).join(" "),
      });
      await load();
      window.dispatchEvent(new Event("jtsc:refresh-volunteers"));
      return true;
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "The signup file could not be imported." });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const sessions2 = useMemo(() => data?.sessions ?? [], [data]);
  const jobs2 = useMemo(() => data?.jobs ?? [], [data]);
  const swimmers2 = useMemo(() => data?.swimmers ?? [], [data]);
  // The overview has to count the signup roster, which is how a meet actually runs, as
  // well as walk-ins. Counting entries alone left these tiles frozen all meet long.
  const overviewStats = useMemo(() => {
    const roster = data?.signupRows ?? [];
    const done = roster.filter((row) => row.completed);
    const onDeck = roster.filter((row) => row.checkedInAt && !row.completed);
    const credit = (row) => Number(row.creditedValue ?? row.creditEarned ?? 0);
    return {
      hours: done.filter((row) => row.creditUnits !== "Pts.").reduce((sum, row) => sum + credit(row), 0)
        + entries.filter((entry) => entry.checkedOutAt).reduce((sum, entry) => sum + Number(entry.creditedHours), 0),
      points: done.filter((row) => row.creditUnits === "Pts.").reduce((sum, row) => sum + credit(row), 0),
      onDeck: onDeck.length + entries.filter((entry) => !entry.checkedOutAt).length,
      completed: done.length + entries.filter((entry) => entry.checkedOutAt).length,
      // Swimmers come from the roster once one is imported; the swimmer table is only
      // used by the walk-in flow and stays empty on a signup-driven meet.
      people: new Set([
        ...roster.map((row) => row.swimmerName).filter(Boolean),
        ...entries.map((entry) => entry.swimmerName).filter(Boolean),
      ]).size || swimmers2.length,
    };
  }, [data, entries, swimmers2]);
  const creditedTotal = overviewStats.hours;
  const activeCount = overviewStats.onDeck;
  const completedCount = overviewStats.completed;

  // The hour ledger has to cover both ways a shift gets credited: the signup roster,
  // which is the normal meet-day path, and walk-in entries recorded against a manual
  // session. Points-based jobs (donations) are counted apart from hours, never summed in.
  const signupRows2 = useMemo(() => data?.signupRows ?? [], [data]);
  const ledgerMeets = useMemo(() => {
    const seen = new Map();
    for (const row of signupRows2) {
      const key = `${row.eventDate}|||${row.eventTitle}`;
      if (!seen.has(key)) seen.set(key, { key, eventDate: row.eventDate, eventTitle: row.eventTitle });
    }
    return [...seen.values()].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }, [signupRows2]);

  const creditLedger = useMemo(() => {
    const fromSignup = signupRows2
      .filter((row) => row.completed && (reportMeet === "all" || `${row.eventDate}|||${row.eventTitle}` === reportMeet))
      .map((row) => ({
        id: `signup-${row.id}`,
        source: "Signup roster",
        volunteerName: row.volunteerName,
        swimmerName: row.swimmerName,
        jobName: row.jobName,
        meet: row.eventTitle,
        meetDate: row.eventDate,
        credit: Number(row.creditedValue ?? row.creditEarned ?? 0),
        units: row.creditUnits === "Pts." ? "Pts." : "Hrs.",
        checkedInAt: row.checkedInAt,
        checkedOutAt: row.checkedOutAt,
        adjusted: Boolean(row.volunteerOverride),
      }));
    // Walk-ins only belong in an all-meets view; they are not tied to a signup meet.
    const fromWalkIn = reportMeet !== "all" ? [] : entries.filter((entry) => entry.checkedOutAt).map((entry) => ({
      id: `entry-${entry.id}`,
      source: "Walk-in",
      volunteerName: entry.volunteerName,
      swimmerName: entry.swimmerName,
      jobName: entry.jobName,
      meet: sessions2.find((item) => item.id === entry.sessionId)?.title ?? "Manual session",
      meetDate: sessions2.find((item) => item.id === entry.sessionId)?.sessionDate ?? "",
      credit: Number(entry.creditedHours),
      units: "Hrs.",
      checkedInAt: entry.checkedInAt,
      checkedOutAt: entry.checkedOutAt,
      adjusted: Boolean(entry.volunteerOverride),
    }));
    return [...fromSignup, ...fromWalkIn].sort(
      (a, b) => a.volunteerName.localeCompare(b.volunteerName) || a.jobName.localeCompare(b.jobName),
    );
  }, [signupRows2, entries, sessions2, reportMeet]);

  // Shifts checked in but not yet checked out. They have earned nothing yet, so they are
  // reported apart from completed credit rather than folded into it.
  const pendingLedger = useMemo(() => signupRows2
    .filter((row) => row.checkedInAt && !row.completed
      && (reportMeet === "all" || `${row.eventDate}|||${row.eventTitle}` === reportMeet))
    .map((row) => ({
      id: `pending-${row.id}`,
      volunteerName: row.volunteerName,
      swimmerName: row.swimmerName,
      jobName: row.jobName,
      meet: row.eventTitle,
      meetDate: row.eventDate,
      credit: Number(row.creditedValue ?? row.creditPossible ?? 0),
      units: row.creditUnits === "Pts." ? "Pts." : "Hrs.",
    })), [signupRows2, reportMeet]);

  const pendingTotals = useMemo(() => ({
    shifts: pendingLedger.length,
    hours: pendingLedger.filter((row) => row.units === "Hrs.").reduce((sum, row) => sum + row.credit, 0),
  }), [pendingLedger]);

  const ledgerTotals = useMemo(() => ({
    shifts: creditLedger.length,
    hours: creditLedger.filter((row) => row.units === "Hrs.").reduce((sum, row) => sum + row.credit, 0),
    points: creditLedger.filter((row) => row.units === "Pts.").reduce((sum, row) => sum + row.credit, 0),
    people: new Set(creditLedger.map((row) => row.volunteerName)).size,
  }), [creditLedger]);

  // Families care about their own total, so roll the ledger up per volunteer too.
  const ledgerByVolunteer = useMemo(() => {
    const totals = new Map();
    for (const row of creditLedger) {
      const current = totals.get(row.volunteerName) ?? { name: row.volunteerName, swimmerName: row.swimmerName, shifts: 0, hours: 0, points: 0 };
      current.shifts += 1;
      if (row.units === "Pts.") current.points += row.credit; else current.hours += row.credit;
      totals.set(row.volunteerName, current);
    }
    return [...totals.values()].sort((a, b) => b.hours - a.hours || b.points - a.points);
  }, [creditLedger]);
  // Same correction as the tiles: the breakdown covers completed roster shifts as well
  // as walk-ins, so it reflects the meet rather than only manual entries.
  const jobTotals = useMemo(() => {
    const totals = new Map();
    const add = (jobName, hours) => {
      const current = totals.get(jobName) ?? { people: 0, hours: 0 };
      totals.set(jobName, { people: current.people + 1, hours: current.hours + hours });
    };
    for (const row of (data?.signupRows ?? [])) {
      if (!row.completed || row.creditUnits === "Pts.") continue;
      add(row.jobName, Number(row.creditedValue ?? row.creditEarned ?? 0));
    }
    for (const entry of entries) {
      if (!entry.checkedOutAt) continue;
      add(entry.jobName, Number(entry.creditedHours));
    }
    return [...totals.entries()].sort((a, b) => b[1].hours - a[1].hours);
  }, [data, entries]);
  if (authenticated === null) return jsxs("main", {
    className: "admin-loading",
    children: [jsx("span", { className: "spinner" }), "Loading volunteer desk\u2026"]
  });
  if (!authenticated) return jsxs("main", {
    className: "login-page",
    children: [jsxs("div", {
      className: "login-wave",
      "aria-hidden": "true",
      children: [
        jsx("i", {}),
        jsx("i", {}),
        jsx("i", {})
      ]
    }), jsxs("section", {
      className: "login-card",
      children: [
        jsx(Brand2, {}),
        jsx("span", {
          className: "login-kicker",
          children: "ADMINISTRATION"
        }),
        jsxs("h1", { children: [
          "Volunteer",
          jsx("br", {}),
          "admin"
        ] }),
        jsx("p", { children: "Manage sessions, swimmers, volunteer hours, and meet reports." }),
        jsxs("form", {
          noValidate: true,
          onSubmit: login,
          children: [jsx("label", { htmlFor: "admin-pin", children: jsx("span", { children: "Admin access code" }) }), jsxs("span", {
            className: "login-secret",
            children: [jsx("input", {
              id: "admin-pin",
              type: showPin ? "text" : "password",
              inputMode: "numeric",
              autoComplete: "current-password",
              autoFocus: true,
              value: pin,
              onChange: (event) => setPin(event.target.value),
              placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022"
            }), jsx("button", {
              type: "button",
              className: "login-reveal",
              onClick: () => setShowPin((current) => !current),
              "aria-label": showPin ? "Hide admin access code" : "Show admin access code",
              "aria-pressed": showPin,
              children: showPin ? "Hide" : "Show"
            })]
          }), jsxs("button", {
            disabled: !pin || busy,
            "aria-busy": busy,
            children: [busy ? "Checking\u2026" : "Enter admin portal", jsx("b", { children: "\u2192" })]
          })]
        }),
        message && jsx("div", {
          className: "login-error",
          children: message.text
        }),
        jsx("a", {
          href: "#volunteers",
          children: "\u2190 Back to volunteer check-in"
        })
      ]
    })]
  });
  function exportCsv() {
    // Hours and points are different currencies, so they get their own columns
    // rather than being added together.
    const rows = creditLedger.map((row) => [
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
    const totalHours = creditLedger.filter((row) => row.units === "Hrs.").reduce((sum, row) => sum + row.credit, 0);
    const totalPoints = creditLedger.filter((row) => row.units === "Pts.").reduce((sum, row) => sum + row.credit, 0);
    const csv = [
      ["Volunteer", "Swimmer / account", "Job", "Meet", "Meet date", "Hours", "Points", "Check in", "Check out", "Credit adjusted", "Source"],
      ...rows,
      [],
      ["TOTAL", "", "", "", "", totalHours, totalPoints, "", "", "", `${creditLedger.length} shifts`],
    ].map((row) => row.map(csvCell).join(",")).join("\n");
    const label = reportMeet === "all" ? "all-meets" : reportMeet.split("|||")[0];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `JTSC-volunteer-hours-${label}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return jsxs("main", {
    className: "admin-shell",
    children: [jsxs("aside", {
      className: "admin-sidebar",
      children: [
        jsx(Brand2, {}),
        jsx("nav", {
          "aria-label": "Admin sections",
          children: [
            [
              "overview",
              "Overview",
              "01"
            ],
            [
              "sessions",
              "Sessions & jobs",
              "02"
            ],
            [
              "swimmers",
              "Swimmer roster",
              "03"
            ],
            [
              "reports",
              "Reports",
              "04"
            ]
          ].map(([value, label, index]) => jsxs("button", {
            className: tab === value ? "active" : "",
            onClick: () => setTab(value),
            children: [jsx("small", { children: index }), jsx("span", { children: label })]
          }, value))
        }),
        jsxs("div", {
          className: "sidebar-bottom",
          children: [jsx("a", {
            href: "#volunteers",
            children: "\u2197 Open check-in desk"
          }), jsx("button", {
            onClick: () => void logout(),
            children: "Sign out"
          })]
        })
      ]
    }), jsxs("section", {
      className: "admin-main",
      children: [
        jsxs("header", {
          className: "admin-topbar",
          children: [jsxs("div", { children: [jsx("span", {
            className: "eyebrow dark",
            children: "JTSC OPERATIONS"
          }), jsx("h1", { children: tab === "overview" ? "Meet-day overview" : tab === "sessions" ? "Sessions & assignments" : tab === "swimmers" ? "Swimmer roster" : "Volunteer reports" })] }), jsxs("div", {
            className: "admin-date",
            children: [jsx("small", { children: "TODAY" }), jsx("strong", { children: dateLabel(today()) })]
          })]
        }),
        message && jsxs("div", {
          className: `admin-notice ${message.kind}`,
          children: [jsx("span", { children: message.text }), jsx("button", {
            onClick: () => setMessage(null),
            children: "\xD7"
          })]
        }),
        tab === "overview" && jsxs(Fragment, { children: [jsxs("div", {
          className: "metric-grid",
          children: [
            jsx(Metric, {
              label: "Credited hours",
              value: creditedTotal.toFixed(1),
              detail: overviewStats.points ? `Plus ${overviewStats.points} points \u00b7 roster and walk-ins` : "Roster and walk-ins",
              accent: true
            }),
            jsx(Metric, {
              label: "On deck now",
              value: String(activeCount),
              detail: "Currently checked in"
            }),
            jsx(Metric, {
              label: "Completed shifts",
              value: String(completedCount),
              detail: "Checked out"
            }),
            jsx(Metric, {
              label: "Swimmers covered",
              value: String(overviewStats.people),
              detail: "On this meet roster"
            })
          ]
        }), jsxs("div", {
          className: "admin-two-col",
          children: [jsxs("section", {
            className: "panel",
            children: [jsxs("div", {
              className: "panel-head",
              children: [jsxs("div", { children: [jsx("span", {
                className: "panel-kicker",
                children: "TODAY\u2019S PULSE"
              }), jsx("h2", { children: "Assignments by hours" })] }), jsx("button", {
                onClick: () => setTab("reports"),
                children: "View report \u2192"
              })]
            }), jsx("div", {
              className: "bar-list",
              children: jobTotals.length ? jobTotals.map(([name, total]) => jsxs("div", {
                className: "bar-item",
                children: [
                  jsxs("div", { children: [jsx("strong", { children: name }), jsxs("span", { children: [
                    total.people,
                    " volunteer",
                    total.people === 1 ? "" : "s"
                  ] })] }),
                  jsx("div", {
                    className: "bar-track",
                    children: jsx("i", { style: { width: `${Math.max(8, total.hours / Math.max(...jobTotals.map((item) => item[1].hours)) * 100)}%` } })
                  }),
                  jsxs("b", { children: [total.hours.toFixed(1), "h"] })
                ]
              }, name)) : jsx(PanelEmpty, { text: "Check-ins will appear here." })
            })]
          }), jsxs("section", {
            className: "panel",
            children: [jsxs("div", {
              className: "panel-head",
              children: [jsxs("div", { children: [jsx("span", {
                className: "panel-kicker",
                children: "NEXT UP"
              }), jsx("h2", { children: "Open sessions" })] }), jsx("button", {
                onClick: () => setTab("sessions"),
                children: "Manage \u2192"
              })]
            }), jsx("div", {
              className: "compact-sessions",
              children: sessions2.filter((session) => session.status === "open").slice(0, 4).map((session) => jsxs("div", { children: [
                jsxs("span", {
                  className: "date-block",
                  children: [jsx("b", { children: (new Date(`${session.sessionDate}T12:00:00Z`)).getUTCDate() }), jsx("small", { children: (new Date(`${session.sessionDate}T12:00:00Z`)).toLocaleDateString("en-US", {
                    month: "short",
                    timeZone: "UTC"
                  }) })]
                }),
                jsxs("div", { children: [jsx("strong", { children: session.title }), jsxs("span", { children: [
                  timeLabel(session.startTime),
                  "\u2013",
                  timeLabel(session.endTime)
                ] })] }),
                jsxs("b", { children: [jobs2.filter((job) => job.sessionId === session.id).length, " jobs"] })
              ] }, session.id))
            })]
          })]
        })] }),
        tab === "sessions" && jsx(SessionsPanel, {
          sessions: sessions2,
          jobs: jobs2,
          signupImports: data?.signupImports ?? [],
          signupDates: data?.signupDates ?? [],
          busy,
          mutate,
          bulkAddJobs,
          importSignup,
          resetAllowed: data?.resetAllowed === true
        }),
        tab === "swimmers" && jsx(SwimmersPanel, {
          swimmers: swimmers2,
          busy,
          mutate
        }),
        tab === "reports" && <section className="panel reports-panel">
          <div className="panel-head report-head">
            <div>
              <span className="panel-kicker">HOUR LEDGER</span>
              <h2>Completed volunteer credit</h2>
            </div>
            <div>
              <select value={reportMeet} onChange={(event) => setReportMeet(event.target.value)}>
                <option value="all">All meets{ledgerMeets.length ? "" : " (no roster yet)"}</option>
                {ledgerMeets.map((meet) => <option key={meet.key} value={meet.key}>{meet.eventDate} · {meet.eventTitle}</option>)}
              </select>
              <button className="export-button" onClick={exportCsv}>Export CSV ↓</button>
            </div>
          </div>

          <div className="ledger-tiles">
            <div className="ledger-tile">
              <b>{ledgerTotals.hours.toFixed(2).replace(/\.?0+$/, "")}</b>
              <span>hours completed</span>
            </div>
            {ledgerTotals.points > 0 && <div className="ledger-tile">
              <b>{ledgerTotals.points.toFixed(2).replace(/\.?0+$/, "")}</b>
              <span>points completed</span>
            </div>}
            {pendingTotals.shifts > 0 && <div className="ledger-tile pending">
              <b>{pendingTotals.hours.toFixed(2).replace(/\.?0+$/, "")}</b>
              <span>still on deck</span>
            </div>}
            <div className="ledger-tile">
              <b>{ledgerTotals.shifts}</b>
              <span>{ledgerTotals.shifts === 1 ? "shift" : "shifts"}</span>
            </div>
            <div className="ledger-tile">
              <b>{ledgerTotals.people}</b>
              <span>{ledgerTotals.people === 1 ? "volunteer" : "volunteers"}</span>
            </div>
          </div>

          {pendingTotals.shifts > 0 && <div className="pending-banner">
            <div>
              <strong>{pendingTotals.shifts} {pendingTotals.shifts === 1 ? "volunteer is" : "volunteers are"} still checked in</strong>
              <span>Credit is earned at check-out, so these {pendingTotals.hours.toFixed(2).replace(/\.?0+$/, "")} hours are not counted yet. People often leave without checking out.</span>
            </div>
            {reportMeet !== "all" && <button type="button" className="admin-primary" disabled={busy}
              onClick={() => {
                const [eventDate, eventTitle] = reportMeet.split("|||");
                void mutate({ action: "signup_checkout_all", eventDate, eventTitle },
                  `Checked out everyone still on deck for ${eventTitle}.`);
              }}>Check out all {pendingTotals.shifts} →</button>}
          </div>}

          <div className="ledger-switch" role="group" aria-label="Ledger view">
            <button type="button" className={ledgerView === "people" ? "active" : ""} aria-pressed={ledgerView === "people"}
              onClick={() => setLedgerView("people")}>By volunteer</button>
            <button type="button" className={ledgerView === "shifts" ? "active" : ""} aria-pressed={ledgerView === "shifts"}
              onClick={() => setLedgerView("shifts")}>Every shift</button>
          </div>

          <div className="table-scroll">
            {ledgerView === "people"
              ? <table>
                <thead><tr><th>Volunteer</th><th>Swimmer / account</th><th>Shifts</th><th>Hours</th><th>Points</th></tr></thead>
                <tbody>
                  {ledgerByVolunteer.map((person) => <tr key={person.name}>
                    <td><strong>{person.name}</strong></td>
                    <td>{person.swimmerName}</td>
                    <td>{person.shifts}</td>
                    <td><b>{person.hours ? person.hours.toFixed(2).replace(/\.?0+$/, "") : "—"}</b></td>
                    <td>{person.points ? person.points.toFixed(2).replace(/\.?0+$/, "") : "—"}</td>
                  </tr>)}
                </tbody>
              </table>
              : <table>
                <thead><tr><th>Volunteer</th><th>Swimmer / account</th><th>Job</th><th>Meet</th><th>Credit</th><th>Source</th></tr></thead>
                <tbody>
                  {creditLedger.map((row) => <tr key={row.id}>
                    <td><strong>{row.volunteerName}</strong>{row.adjusted ? <small>Credit adjusted</small> : null}</td>
                    <td>{row.swimmerName}</td>
                    <td>{row.jobName}</td>
                    <td>{row.meetDate ? `${row.meetDate} · ` : ""}{row.meet}</td>
                    <td><b>{row.credit}</b> {row.units === "Pts." ? "pts" : "hrs"}</td>
                    <td><span className="ledger-source">{row.source}</span></td>
                  </tr>)}
                </tbody>
              </table>}
            {!creditLedger.length && <PanelEmpty text={pendingTotals.shifts
              ? `Nobody has checked out yet. ${pendingTotals.shifts} ${pendingTotals.shifts === 1 ? "volunteer is" : "volunteers are"} on deck and will earn credit once checked out.`
              : "No completed shifts yet. Credit appears here once volunteers are checked out at the desk."} />}
          </div>
        </section>
      ]
    })]
  });
}
function Metric({ label, value, detail, accent = false }) {
  return jsxs("div", {
    className: `metric-card ${accent ? "accent" : ""}`,
    children: [
      jsx("span", { children: label }),
      jsx("strong", { children: value }),
      jsx("small", { children: detail }),
      jsx("i", {})
    ]
  });
}
function PanelEmpty({ text: text2 }) {
  return jsxs("div", {
    className: "panel-empty",
    children: [jsx("span", { children: "\u3030" }), text2]
  });
}
function SignupImportPanel({ signupImports, signupDates, busy, importSignup, mutate, resetAllowed }) {
  const [file, setFile] = useState(null);
  const [localMessage, setLocalMessage] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [controlBusy, setControlBusy] = useState("");
  const [clearImportId, setClearImportId] = useState("");
  const [clearImportConfirm, setClearImportConfirm] = useState("");
  async function submit(event) {
    event.preventDefault();
    // React clears currentTarget once the event finishes dispatching, so the form
    // has to be captured before the upload is awaited.
    const form = event.currentTarget;
    if (!file) {
      setLocalMessage("Choose the Job Signup file first.");
      return;
    }
    setLocalMessage("");
    if (await importSignup(file)) {
      setFile(null);
      form?.reset();
    }
  }
  async function setMeetCheckin(meet, checkinMode) {
    const key = `${meet.eventDate}|||${meet.eventTitle}`;
    setControlBusy(key);
    const verb = checkinMode === "open" ? "opened" : checkinMode === "closed" ? "closed" : "returned to its schedule";
    try {
      if (await mutate({
        action: "set_signup_meet_checkin",
        eventDate: meet.eventDate,
        eventTitle: meet.eventTitle,
        checkinMode
      }, `${meet.eventTitle} check-in was ${verb}.`)) {
        window.dispatchEvent(new Event("jtsc:refresh-volunteers"));
      }
    } finally {
      setControlBusy("");
    }
  }
  return <section className="panel signup-import-panel">
    <div className="signup-import-copy">
      <span className="panel-kicker">MEET ROSTER</span>
      <h2>Import Job Signup</h2>
      <p>Upload the club’s <strong>.xls, .xlsx or .csv</strong> export. Assigned names, swimmer / account names, jobs, times, slots, and credit will become the check-in list.</p>
      <ul>
        <li>Unfilled slots stay in the saved workbook.</li>
        <li>Uploading the same file twice will not duplicate volunteers.</li>
        <li>Re-uploading a corrected file keeps check-ins already taken at the desk.</li>
        <li>Download keeps the original 12 columns in the same order.</li>
      </ul>
    </div>
    <form className="signup-upload-form" noValidate onSubmit={submit}>
      <label>
        <span>Job Signup file</span>
        <input type="file" accept=".xls,.xlsx,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setLocalMessage("");
        }} />
      </label>
      <button className="admin-primary" disabled={busy || !file}>{busy ? "Importing…" : "Import signup file →"}</button>
      <p className="upload-hint">{file ? `${file.name} is ready to import.` : "Maximum file size: 5 MB"}</p>
      {localMessage && <p className="upload-error" role="status">{localMessage}</p>}
    </form>
    <div className="meet-checkin-controls">
      <div className="meet-checkin-head">
        <div><strong>Check-in controls</strong><span>Override the meet date when the desk needs to open early or close.</span></div>
        <span>{signupDates.length}</span>
      </div>
      {signupDates.length ? signupDates.map((meet) => {
        const key = `${meet.eventDate}|||${meet.eventTitle}`;
        const isPending = controlBusy === key;
        const status = meet.checkinMode === "open"
          ? "Manually open"
          : meet.checkinMode === "closed"
            ? "Manually closed"
            : meet.checkinOpen ? "Open today" : "Follows schedule";
        return <div className="meet-checkin-row" key={key}>
          <div className="meet-checkin-copy">
            <strong>{meet.eventTitle}</strong>
            <span>{dateLabel(meet.eventDate)} · {meet.assignedCount} assigned</span>
          </div>
          <span className={`meet-checkin-status ${meet.checkinOpen ? "is-open" : "is-closed"}`}>{status}</span>
          <div className="meet-checkin-actions">
            <button type="button" className={meet.checkinOpen ? "checkin-close" : "admin-primary"}
              disabled={busy} aria-busy={isPending}
              aria-label={`${meet.checkinOpen ? "Close" : "Open"} check-in for ${meet.eventTitle} on ${dateLabel(meet.eventDate)}`}
              onClick={() => void setMeetCheckin(meet, meet.checkinOpen ? "closed" : "open")}>
              {isPending ? "Saving…" : meet.checkinOpen ? "Close check-in" : "Open check-in"}
            </button>
            {meet.checkinMode !== "scheduled" && <button type="button" className="schedule-link" disabled={busy}
              aria-label={`Use scheduled check-in for ${meet.eventTitle} on ${dateLabel(meet.eventDate)}`}
              onClick={() => void setMeetCheckin(meet, "scheduled")}>Use schedule</button>}
          </div>
        </div>;
      }) : <div className="panel-empty compact"><span>〰</span>Import a signup file to control meet check-in.</div>}
      <p className="meet-checkin-note">Closing blocks new check-ins. Volunteers already on deck can still check out.</p>
    </div>
    <div className="import-history">
      <div className="import-history-head"><strong>Recent imports</strong><span>{signupImports.length}</span></div>
      {signupImports.length ? signupImports.map((item) => <Fragment key={item.id}>
        <div className="import-history-row">
          <div><strong>{item.fileName}</strong><span>{item.assignedCount} assigned · {item.eventCount} events · {item.rowCount} rows</span><small>Uploaded {stamp(item.uploadedAt)}</small></div>
          <div className="import-history-actions">
            <a className="export-button" href={`/api/admin/signup-export?importId=${item.id}`}>Download .xls ↓</a>
            <button type="button" className="danger-link" onClick={() => { setClearImportId(item.id); setClearImportConfirm(""); }}>Clear roster…</button>
          </div>
        </div>
        {clearImportId === item.id && <div className="danger-confirm import-clear-confirm">
          <strong>Clear {item.fileName}?</strong>
          <p>This permanently removes this file’s saved assignments, check-ins, earned credit, and meet open/close setting. Other imports and manual sessions stay intact. There is no undo.</p>
          <label>
            <span>Type CLEAR to confirm</span>
            <input value={clearImportConfirm} onChange={(event) => setClearImportConfirm(event.target.value)} placeholder="CLEAR" autoComplete="off" />
          </label>
          <div className="danger-actions">
            <button type="button" className="danger-primary" disabled={busy || clearImportConfirm.trim().toUpperCase() !== "CLEAR"}
              onClick={async () => {
                if (await mutate({ action: "clear_signup_import", importId: item.id, confirm: clearImportConfirm }, `${item.fileName} was cleared.`)) {
                  setClearImportId("");
                  setClearImportConfirm("");
                  window.dispatchEvent(new Event("jtsc:refresh-volunteers"));
                }
              }}>Clear roster</button>
            <button type="button" className="bulk-toggle" onClick={() => { setClearImportId(""); setClearImportConfirm(""); }}>Cancel</button>
          </div>
        </div>}
      </Fragment>) : <div className="panel-empty compact"><span>〰</span>No signup file imported yet.</div>}
    </div>
    {resetAllowed && <div className="danger-zone">
      {!resetOpen
        ? <>
          <button type="button" className="danger-link" onClick={() => setResetOpen(true)}>Clear all data…</button>
          <span className="demo-tag">Irreversible</span>
        </>
        : <div className="danger-confirm">
          <strong>Clear every roster and check-in?</strong>
          <p>This empties every table: imported rosters, check-ins, walk-in entries, sessions, jobs and swimmers — including volunteer hours already earned. There is no undo and no backup. <strong>Export the signup file and the hour ledger first</strong> if this meet’s credit still matters.</p>
          <label>
            <span>Type RESET to confirm</span>
            <input value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} placeholder="RESET" autoComplete="off" />
          </label>
          <div className="danger-actions">
            <button type="button" className="danger-primary" disabled={busy || resetConfirm.trim().toUpperCase() !== "RESET"}
              onClick={async () => {
                if (await mutate({ action: "reset_signup_data", confirm: resetConfirm }, "All rosters and check-ins were cleared.")) {
                  setResetOpen(false);
                  setResetConfirm("");
                  window.dispatchEvent(new Event("jtsc:refresh-volunteers"));
                }
              }}>Clear all data</button>
            <button type="button" className="bulk-toggle" onClick={() => { setResetOpen(false); setResetConfirm(""); }}>Cancel</button>
          </div>
        </div>}
    </div>}
  </section>;
}
function SessionsPanel({ sessions: sessions2, jobs: jobs2, signupImports, signupDates, busy, mutate, bulkAddJobs, importSignup, resetAllowed }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("13:00");
  const [location, setLocation] = useState("Jenks Trojan Aquatic Center");
  const [selectedSessionId, setSelectedSession] = useState(sessions2[0]?.id ?? "");
  const selectedSession = sessions2.some(session => session.id === Number(selectedSessionId)) ? selectedSessionId : sessions2[0]?.id ?? "";
  const [jobName, setJobName] = useState("Timer");
  const [jobStart, setJobStart] = useState("07:00");
  const [jobEnd, setJobEnd] = useState("12:00");
  const [jobHours, setJobHours] = useState("5");
  const [bulkPicks, setBulkPicks] = useState(() => new Set());
  const sessionRecord = sessions2.find((session) => session.id === Number(selectedSession));
  // Standard jobs this session does not already carry, so a second run adds nothing twice.
  const missingStandardJobs = useMemo(() => {
    const present = new Set(
      jobs2.filter((job) => job.sessionId === Number(selectedSession)).map((job) => job.name.trim().toLowerCase())
    );
    return volunteerJobCatalog.filter((job) => !present.has(job.name.toLowerCase()));
  }, [jobs2, selectedSession]);
  const pickedJobs = missingStandardJobs.filter((job) => bulkPicks.has(job.name));
  function toggleBulkPick(name) {
    setBulkPicks((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }
  async function addStandardJobs() {
    if (!selectedSession || !pickedJobs.length) return;
    const start = sessionRecord?.startTime || jobStart;
    const end = sessionRecord?.endTime || jobEnd;
    await bulkAddJobs(selectedSession, pickedJobs.map((job) => ({
      name: job.name,
      startTime: start,
      endTime: end,
      defaultHours: defaultJobHours(job.name) ?? hoursBetween(start, end)
    })));
    setBulkPicks(new Set());
  }
  async function createSession(event) {
    event.preventDefault();
    if (await mutate({
      action: "create_session",
      title,
      date,
      startTime,
      endTime,
      location
    }, `${title} was created.`)) setTitle("");
  }
  async function addJob(event) {
    event.preventDefault();
    if (await mutate({
      action: "add_job",
      sessionId: selectedSession,
      name: jobName,
      startTime: jobStart,
      endTime: jobEnd,
      defaultHours: Number(jobHours)
    }, `${jobName} was added.`)) setJobName("");
  }
  return jsxs("div", {
    className: "manage-grid",
    children: [jsx(SignupImportPanel, { signupImports, signupDates, busy, importSignup, mutate, resetAllowed }), jsxs("div", { children: [jsxs("section", {
      className: "panel form-panel",
      children: [jsx("div", {
        className: "panel-head",
        children: jsxs("div", { children: [jsx("span", {
          className: "panel-kicker",
          children: "NEW MEET"
        }), jsx("h2", { children: "Create a session" })] })
      }), jsxs("form", {
        noValidate: true,
        onSubmit: createSession,
        className: "admin-form",
        children: [
          jsxs("label", {
            className: "wide",
            children: [jsx("span", { children: "Session name" }), jsx("input", {
              value: title,
              onChange: (event) => setTitle(event.target.value),
              placeholder: "e.g. Turkey Swim Invitational"
            })]
          }),
          jsxs("label", { children: [jsx("span", { children: "Date" }), jsx("input", {
            type: "date",
            value: date,
            onChange: (event) => setDate(event.target.value)
          })] }),
          jsxs("label", { children: [jsx("span", { children: "Start" }), jsx("input", {
            type: "time",
            value: startTime,
            onChange: (event) => setStartTime(event.target.value)
          })] }),
          jsxs("label", { children: [jsx("span", { children: "End" }), jsx("input", {
            type: "time",
            value: endTime,
            onChange: (event) => setEndTime(event.target.value)
          })] }),
          jsxs("label", {
            className: "wide",
            children: [jsx("span", { children: "Location" }), jsx("input", {
              value: location,
              onChange: (event) => setLocation(event.target.value)
            })]
          }),
          jsx("button", {
            className: "admin-primary",
            disabled: busy || !title,
            children: "Create session \u2192"
          })
        ]
      })]
    }), jsxs("section", {
      className: "panel form-panel",
      children: [jsx("div", {
        className: "panel-head",
        children: jsxs("div", { children: [jsx("span", {
          className: "panel-kicker",
          children: "ASSIGNMENTS"
        }), jsx("h2", { children: "Add a volunteer job" })] })
      }), jsxs("form", {
        noValidate: true,
        onSubmit: addJob,
        className: "admin-form",
        children: [
          jsxs("label", {
            className: "wide",
            children: [jsx("span", { children: "Session" }), jsx("select", {
              value: selectedSession,
              onChange: (event) => setSelectedSession(Number(event.target.value)),
              children: sessions2.map((session) => jsx("option", {
                value: session.id,
                children: session.title
              }, session.id))
            })]
          }),
          jsxs("label", {
            className: "wide",
            children: [
              jsx("span", { children: "Job name" }),
              jsx("input", {
                list: "job-suggestions",
                value: jobName,
                placeholder: "Start typing, or pick a standard job",
                onChange: (event) => {
                  const next = event.target.value;
                  setJobName(next);
                  // A standard job carries its usual credit; the admin can still override it.
                  const standard = defaultJobHours(next);
                  if (standard) setJobHours(String(standard));
                }
              }),
              jsx("datalist", {
                id: "job-suggestions",
                children: volunteerJobNames.map((name) => jsx("option", { value: name }, name))
              })
            ]
          }),
          jsxs("label", { children: [jsx("span", { children: "Start" }), jsx("input", {
            type: "time",
            value: jobStart,
            onChange: (event) => {
              setJobStart(event.target.value);
              setJobHours(String(hoursBetween(event.target.value, jobEnd)));
            }
          })] }),
          jsxs("label", { children: [jsx("span", { children: "End" }), jsx("input", {
            type: "time",
            value: jobEnd,
            onChange: (event) => {
              setJobEnd(event.target.value);
              setJobHours(String(hoursBetween(jobStart, event.target.value)));
            }
          })] }),
          jsxs("label", { children: [jsx("span", { children: "Credit hours" }), jsx("input", {
            type: "number",
            min: "0.25",
            max: "24",
            step: "0.25",
            value: jobHours,
            onChange: (event) => setJobHours(event.target.value)
          })] }),
          jsx("button", {
            className: "admin-primary",
            disabled: busy || !selectedSession || !jobName,
            children: "Add job \u2192"
          })
        ]
      })]
    }), jsxs("section", {
      className: "panel form-panel bulk-jobs-panel",
      children: [
        jsxs("div", {
          className: "panel-head",
          children: [jsxs("div", { children: [
            jsx("span", { className: "panel-kicker", children: "STANDARD JOBS" }),
            jsx("h2", { children: "Add the club job list" })
          ] }), jsxs("span", {
            className: "count-badge",
            children: [missingStandardJobs.length, " left"]
          })]
        }),
        jsx("p", {
          className: "bulk-intro",
          children: missingStandardJobs.length
            ? `Pick the jobs this meet needs. Each is added across the session's hours (${sessionRecord ? `${sessionRecord.startTime}\u2013${sessionRecord.endTime}` : "session times"}) with its usual credit, and you can fine-tune any of them afterwards.`
            : "Every standard job is already on this session."
        }),
        missingStandardJobs.length > 0 && jsxs("div", {
          className: "bulk-actions",
          children: [
            jsx("button", {
              type: "button",
              className: "bulk-toggle",
              onClick: () => setBulkPicks(new Set(missingStandardJobs.map((job) => job.name))),
              children: "Select all"
            }),
            jsx("button", {
              type: "button",
              className: "bulk-toggle",
              onClick: () => setBulkPicks(new Set()),
              children: "Clear"
            })
          ]
        }),
        missingStandardJobs.length > 0 && jsx("div", {
          className: "bulk-job-list",
          role: "group",
          "aria-label": "Standard jobs to add",
          children: missingStandardJobs.map((job) => jsxs("label", {
            className: `bulk-job ${bulkPicks.has(job.name) ? "selected" : ""}`,
            children: [
              jsx("input", {
                type: "checkbox",
                checked: bulkPicks.has(job.name),
                onChange: () => toggleBulkPick(job.name)
              }),
              jsx("span", { children: job.name }),
              jsxs("b", { children: [defaultJobHours(job.name) ?? "\u2014", " hrs"] })
            ]
          }, job.name))
        }),
        missingStandardJobs.length > 0 && jsxs("button", {
          type: "button",
          className: "admin-primary",
          disabled: busy || !selectedSession || !pickedJobs.length,
          onClick: () => void addStandardJobs(),
          children: [
            busy ? "Adding\u2026" : pickedJobs.length ? `Add ${pickedJobs.length} ${pickedJobs.length === 1 ? "job" : "jobs"}` : "Select jobs to add",
            " \u2192"
          ]
        })
      ]
    })] }), jsxs("section", {
      className: "panel session-list-panel",
      children: [jsxs("div", {
        className: "panel-head",
        children: [jsxs("div", { children: [jsx("span", {
          className: "panel-kicker",
          children: "SCHEDULE"
        }), jsx("h2", { children: "All sessions" })] }), jsxs("span", {
          className: "total-pill",
          children: [sessions2.length, " total"]
        })]
      }), jsx("div", {
        className: "session-list",
        children: sessions2.map((session) => jsxs("article", {
          className: session.status === "closed" ? "closed" : "",
          children: [jsxs("div", {
            className: "session-title",
            children: [
              jsxs("span", {
                className: "date-block",
                children: [jsx("b", { children: (new Date(`${session.sessionDate}T12:00:00Z`)).getUTCDate() }), jsx("small", { children: (new Date(`${session.sessionDate}T12:00:00Z`)).toLocaleDateString("en-US", {
                  month: "short",
                  timeZone: "UTC"
                }) })]
              }),
              jsxs("div", { children: [
                jsx("strong", { children: session.title }),
                jsxs("span", { children: [
                  dateLabel(session.sessionDate),
                  " \xB7 ",
                  timeLabel(session.startTime),
                  "\u2013",
                  timeLabel(session.endTime)
                ] }),
                jsx("small", { children: session.location })
              ] }),
              jsx("button", {
                onClick: () => void mutate({
                  action: "set_session_status",
                  id: session.id,
                  status: session.status === "open" ? "closed" : "open"
                }, `${session.title} is now ${session.status === "open" ? "closed" : "open"}.`),
                children: session.status
              })
            ]
          }), jsxs("div", {
            className: "job-lines",
            children: [jobs2.filter((job) => job.sessionId === session.id).map((job) => jsxs("div", { children: [
              jsx("strong", { children: job.name }),
              jsxs("span", { children: [
                timeLabel(job.startTime),
                "\u2013",
                timeLabel(job.endTime)
              ] }),
              jsxs("b", { children: [job.defaultHours, "h"] })
            ] }, job.id)), !jobs2.some((job) => job.sessionId === session.id) && jsx("span", {
              className: "no-jobs",
              children: "No assignments yet."
            })]
          })]
        }, session.id))
      })]
    })]
  });
}
function SwimmersPanel({ swimmers: swimmers2, busy, mutate }) {
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("Age Group");
  const [query, setQuery] = useState("");
  const visible = swimmers2.filter((swimmer) => `${swimmer.name} ${swimmer.groupName}`.toLowerCase().includes(query.toLowerCase()));
  async function submit(event) {
    event.preventDefault();
    if (await mutate({
      action: "add_swimmer",
      name,
      groupName
    }, `${name} was added to the roster.`)) setName("");
  }
  return jsxs("div", {
    className: "roster-grid",
    children: [jsxs("section", {
      className: "panel form-panel",
      children: [jsx("div", {
        className: "panel-head",
        children: jsxs("div", { children: [jsx("span", {
          className: "panel-kicker",
          children: "ROSTER"
        }), jsx("h2", { children: "Add a swimmer" })] })
      }), jsxs("form", {
        noValidate: true,
        onSubmit: submit,
        className: "admin-form single",
        children: [
          jsxs("label", { children: [jsx("span", { children: "Swimmer name" }), jsx("input", {
            value: name,
            onChange: (event) => setName(event.target.value),
            placeholder: "First and last name"
          })] }),
          jsxs("label", { children: [jsx("span", { children: "Training group" }), jsxs("select", {
            value: groupName,
            onChange: (event) => setGroupName(event.target.value),
            children: [
              jsx("option", { children: "Development" }),
              jsx("option", { children: "Age Group" }),
              jsx("option", { children: "Senior" }),
              jsx("option", { children: "National" }),
              jsx("option", { children: "JTSC" })
            ]
          })] }),
          jsx("button", {
            className: "admin-primary",
            disabled: busy || !name,
            children: "Add swimmer \u2192"
          })
        ]
      })]
    }), jsxs("section", {
      className: "panel roster-panel",
      children: [jsxs("div", {
        className: "panel-head",
        children: [jsxs("div", { children: [jsxs("span", {
          className: "panel-kicker",
          children: [swimmers2.length, " ACTIVE"]
        }), jsx("h2", { children: "Swimmer roster" })] }), jsx("input", {
          className: "search-input",
          value: query,
          onChange: (event) => setQuery(event.target.value),
          placeholder: "Search roster"
        })]
      }), jsx("div", {
        className: "roster-list",
        children: visible.map((swimmer) => jsxs("div", { children: [
          jsx("span", { children: swimmer.name.split(" ").map((part) => part[0]).slice(0, 2).join("") }),
          jsxs("div", { children: [jsx("strong", { children: swimmer.name }), jsx("small", { children: swimmer.groupName })] }),
          jsx("b", { children: "ACTIVE" })
        ] }, swimmer.id))
      })]
    })]
  });
}

export default AdminApp;
