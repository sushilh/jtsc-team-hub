"use client";

// Recovered from the existing Volunteer Crew production bundle; preserves its workflows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  const [reportSession, setReportSession] = useState("all");
  const [hourEdits, setHourEdits] = useState({});
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
    setHourEdits(Object.fromEntries(result.entries.map((entry) => [entry.id, String(entry.creditedHours)])));
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
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setData(null);
  }
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const sessions2 = data?.sessions ?? [];
  const jobs2 = data?.jobs ?? [];
  const swimmers2 = data?.swimmers ?? [];
  const creditedTotal = entries.reduce((sum, entry) => sum + Number(entry.creditedHours), 0);
  const activeCount = entries.filter((entry) => !entry.checkedOutAt).length;
  const completedCount = entries.filter((entry) => entry.checkedOutAt).length;
  const filteredEntries = reportSession === "all" ? entries : entries.filter((entry) => entry.sessionId === Number(reportSession));
  const jobTotals = useMemo(() => {
    const totals = new Map();
    for (const entry of entries) {
      const current = totals.get(entry.jobName) ?? {
        people: 0,
        hours: 0
      };
      totals.set(entry.jobName, {
        people: current.people + 1,
        hours: current.hours + Number(entry.creditedHours)
      });
    }
    return [...totals.entries()].sort((a, b) => b[1].hours - a[1].hours);
  }, [entries]);
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
          onSubmit: login,
          children: [jsxs("label", { children: [jsx("span", { children: "Admin access code" }), jsx("input", {
            type: "password",
            inputMode: "numeric",
            autoFocus: true,
            value: pin,
            onChange: (event) => setPin(event.target.value),
            placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022"
          })] }), jsxs("button", {
            disabled: !pin || busy,
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
    const csv = [[
      "Session",
      "Date",
      "Volunteer",
      "Swimmer",
      "Job",
      "Check in",
      "Check out",
      "Credited hours",
      "Volunteer override"
    ], ...filteredEntries.map((entry) => {
      const session = sessions2.find((item) => item.id === entry.sessionId);
      return [
        session?.title,
        session?.sessionDate,
        entry.volunteerName,
        entry.swimmerName,
        entry.jobName,
        entry.checkedInAt,
        entry.checkedOutAt,
        entry.creditedHours,
        entry.volunteerOverride ? "Yes" : "No"
      ];
    })].map((row) => row.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `JTSC-volunteer-report-${today()}.csv`;
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
        tab === "overview" && jsxs(import_jsx_runtime4.Fragment, { children: [jsxs("div", {
          className: "metric-grid",
          children: [
            jsx(Metric, {
              label: "Credited hours",
              value: creditedTotal.toFixed(1),
              detail: "Across all sessions",
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
              label: "Active swimmers",
              value: String(swimmers2.length),
              detail: "Available at check-in"
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
          busy,
          mutate
        }),
        tab === "swimmers" && jsx(SwimmersPanel, {
          swimmers: swimmers2,
          busy,
          mutate
        }),
        tab === "reports" && jsxs("section", {
          className: "panel reports-panel",
          children: [
            jsxs("div", {
              className: "panel-head report-head",
              children: [jsxs("div", { children: [jsx("span", {
                className: "panel-kicker",
                children: "HOUR LEDGER"
              }), jsx("h2", { children: "Volunteer activity" })] }), jsxs("div", { children: [jsxs("select", {
                value: reportSession,
                onChange: (event) => setReportSession(event.target.value),
                children: [jsx("option", {
                  value: "all",
                  children: "All sessions"
                }), sessions2.map((session) => jsx("option", {
                  value: session.id,
                  children: session.title
                }, session.id))]
              }), jsx("button", {
                className: "export-button",
                onClick: exportCsv,
                children: "Export CSV \u2193"
              })] })]
            }),
            jsxs("div", {
              className: "report-summary",
              children: [jsxs("span", { children: [jsx("b", { children: filteredEntries.length }), " shifts"] }), jsxs("span", { children: [jsx("b", { children: filteredEntries.reduce((sum, entry) => sum + Number(entry.creditedHours), 0).toFixed(1) }), " total hours"] })]
            }),
            jsxs("div", {
              className: "table-scroll",
              children: [jsxs("table", { children: [jsx("thead", { children: jsxs("tr", { children: [
                jsx("th", { children: "Volunteer" }),
                jsx("th", { children: "Swimmer" }),
                jsx("th", { children: "Assignment" }),
                jsx("th", { children: "Check in" }),
                jsx("th", { children: "Check out" }),
                jsx("th", { children: "Hours" }),
                jsx("th", {})
              ] }) }), jsx("tbody", { children: filteredEntries.map((entry) => jsxs("tr", { children: [
                jsxs("td", { children: [jsx("strong", { children: entry.volunteerName }), entry.volunteerOverride ? jsx("small", { children: "Volunteer adjusted" }) : null] }),
                jsx("td", { children: entry.swimmerName }),
                jsx("td", { children: entry.jobName }),
                jsx("td", { children: stamp(entry.checkedInAt) }),
                jsx("td", { children: stamp(entry.checkedOutAt) }),
                jsx("td", { children: jsx("input", {
                  className: "hour-edit",
                  type: "number",
                  step: "0.25",
                  min: "0",
                  max: "24",
                  value: hourEdits[entry.id] ?? "",
                  onChange: (event) => setHourEdits((current) => ({
                    ...current,
                    [entry.id]: event.target.value
                  }))
                }) }),
                jsx("td", { children: jsx("button", {
                  className: "save-link",
                  disabled: busy || Number(hourEdits[entry.id]) === Number(entry.creditedHours),
                  onClick: () => void mutate({
                    action: "update_hours",
                    id: entry.id,
                    hours: Number(hourEdits[entry.id])
                  }, `Hours updated for ${entry.volunteerName}.`),
                  children: "Save"
                }) })
              ] }, entry.id)) })] }), !filteredEntries.length && jsx(PanelEmpty, { text: "No volunteer activity matches this report." })]
            })
          ]
        })
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
function SessionsPanel({ sessions: sessions2, jobs: jobs2, busy, mutate }) {
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
    children: [jsxs("div", { children: [jsxs("section", {
      className: "panel form-panel",
      children: [jsx("div", {
        className: "panel-head",
        children: jsxs("div", { children: [jsx("span", {
          className: "panel-kicker",
          children: "NEW MEET"
        }), jsx("h2", { children: "Create a session" })] })
      }), jsxs("form", {
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
                onChange: (event) => setJobName(event.target.value)
              }),
              jsxs("datalist", {
                id: "job-suggestions",
                children: [
                  jsx("option", { value: "Timer" }),
                  jsx("option", { value: "Console Operator" }),
                  jsx("option", { value: "Concessions" }),
                  jsx("option", { value: "Check-in Operator" })
                ]
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
