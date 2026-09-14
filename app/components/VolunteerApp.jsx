"use client";

// Recovered from the existing Volunteer Crew production bundle; preserves its workflows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { jobHourOptions } from "../../lib/volunteer-jobs.mjs";

function localIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function displayDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T12:00:00Z`));
}
function displayTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(2020, 0, 1, hours, minutes));
}
function Brand({ compact = false }) {
  return jsxs("div", {
    className: `brand ${compact ? "brand-compact" : ""}`,
    children: [jsxs("span", {
      className: "brand-mark",
      "aria-hidden": "true",
      children: [jsx("span", { children: "JT" }), jsx("i", {})]
    }), jsxs("span", { children: [jsx("strong", { children: "JENKS TROJAN" }), jsx("small", { children: "SWIM CLUB" })] })]
  });
}
function VolunteerApp() {
  const [data, setData] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [swimmerId, setSwimmerId] = useState("");
  const [jobId, setJobId] = useState("");
  const [hours, setHours] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/public?date=${localIsoDate()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load today's volunteer session.");
      setData(result);
      setSessionId((current) => current || result.sessions.find((session2) => session2.sessionDate === localIsoDate())?.id || result.sessions[0]?.id || "");
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Unable to load today's session."
      });
    }
  }, []);
  useEffect(() => {
    // Fetch initializes this view from the authoritative volunteer service.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const refresh = () => { void load(); };
    window.addEventListener("jtsc:refresh-volunteers", refresh);
    return () => window.removeEventListener("jtsc:refresh-volunteers", refresh);
  }, [load]);
  const session = data?.sessions.find((item) => item.id === Number(sessionId));
  const selectedJob = session?.jobs.find((job) => job.id === Number(jobId));
  // A long job list reads far better alphabetically than in the order it was created.
  const sortedJobs = useMemo(
    () => [...(session?.jobs ?? [])].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true })),
    [session]
  );
  const jobCount = sortedJobs.length;
  // Shifts of this name have historically been credited these amounts.
  const hourPresets = useMemo(() => {
    const options = jobHourOptions(selectedJob?.name);
    const withDefault = selectedJob ? [...options, Number(selectedJob.defaultHours)] : options;
    return [...new Set(withDefault.filter((value) => Number(value) > 0))].sort((a, b) => a - b);
  }, [selectedJob]);
  const activeEntries = data?.activeEntries.filter((entry) => entry.sessionId === Number(sessionId)) ?? [];
  const ready = Boolean(volunteerName.trim() && swimmerId && selectedJob && Number(hours) > 0);
  async function checkIn(event) {
    event.preventDefault();
    if (!ready || !session) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin",
          sessionId: session.id,
          jobId,
          swimmerId,
          volunteerName,
          creditedHours: Number(hours)
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Check-in could not be saved.");
      setNotice({
        kind: "success",
        text: `You're checked in, ${volunteerName.trim().split(" ")[0]}! Thank you for making this meet happen.`
      });
      setVolunteerName("");
      setSwimmerId("");
      setJobId("");
      setHours("");
      await load();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Check-in could not be saved."
      });
    } finally {
      setBusy(false);
    }
  }
  async function checkOut(entry) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          id: entry.id
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Check-out could not be saved.");
      setNotice({
        kind: "success",
        text: `${entry.volunteerName} is checked out. ${entry.creditedHours} volunteer hours recorded.`
      });
      await load();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Check-out could not be saved."
      });
    } finally {
      setBusy(false);
    }
  }
  return jsxs("main", {
    className: "site-shell",
    children: [
      jsxs("header", {
        className: "public-header page-width",
        children: [jsx(Brand, {}), jsxs("a", {
          className: "quiet-link",
          href: "#admin",
          children: [jsx("span", { className: "lock-dot" }), "Admin portal"]
        })]
      }),
      jsxs("section", {
        className: "hero page-width",
        children: [jsxs("div", {
          className: "hero-copy",
          children: [
            jsxs("span", {
              className: "eyebrow",
              children: ["03 / VOLUNTEER CREW"]
            }),
            jsx("h1", { children: "Volunteer check-in" }),
            jsx("p", { children: "Check in for your shift. We\u2019ll handle the timekeeping." })
          ]
        }), jsxs("div", {
          className: "lane-art",
          "aria-hidden": "true",
          children: [
            jsx("span", {}),
            jsx("span", {}),
            jsx("span", {}),
            jsx("b", { children: "01" })
          ]
        })]
      }),
      jsxs("div", {
        className: "page-width content-grid",
        children: [jsxs("section", {
          className: "checkin-card",
          children: [
            jsxs("div", {
              className: "card-head",
              children: [jsxs("div", { children: [jsx("span", {
                className: "step-number",
                children: "01"
              }), jsx("h2", { children: "Volunteer check-in" })] }), jsxs("span", {
                className: "live-pill",
                children: [jsx("i", {}), " LIVE"]
              })]
            }),
            !data ? jsxs("div", {
              className: "loading-state",
              children: [jsx("i", {}), jsx("span", { children: "Preparing today\u2019s volunteer desk\u2026" })]
            }) : data.sessions.length === 0 ? jsxs("div", {
              className: "empty-state",
              children: [jsx("strong", { children: "No open sessions yet" }), jsx("span", { children: "An admin can create the next volunteer session." })]
            }) : jsxs("form", {
              onSubmit: checkIn,
              children: [
                data.sessions.length > 1 && jsxs("label", {
                  className: "field",
                  children: [jsx("span", { children: "Session" }), jsx("select", {
                    value: sessionId,
                    onChange: (event) => { setSessionId(Number(event.target.value)); setJobId(""); setHours(""); },
                    children: data.sessions.map((item) => jsxs("option", {
                      value: item.id,
                      children: [
                        item.title,
                        " \xB7 ",
                        item.sessionDate
                      ]
                    }, item.id))
                  })]
                }),
                session && jsxs("div", {
                  className: "session-strip",
                  children: [jsxs("div", { children: [jsx("strong", { children: session.title }), jsx("span", { children: displayDate(session.sessionDate) })] }), jsxs("div", { children: [jsxs("strong", { children: [
                    displayTime(session.startTime),
                    "\u2013",
                    displayTime(session.endTime)
                  ] }), jsx("span", { children: session.location })] })]
                }),
                jsxs("div", {
                  className: "form-row",
                  children: [jsxs("label", {
                    className: "field",
                    children: [jsx("span", { children: "Your full name" }), jsx("input", {
                      value: volunteerName,
                      onChange: (event) => setVolunteerName(event.target.value),
                      placeholder: "First and last name",
                      autoComplete: "name"
                    })]
                  }), jsxs("label", {
                    className: "field",
                    children: [jsx("span", { children: "Your swimmer" }), jsxs("select", {
                      value: swimmerId,
                      onChange: (event) => setSwimmerId(Number(event.target.value) || ""),
                      children: [jsx("option", {
                        value: "",
                        children: "Select swimmer"
                      }), data.swimmers.map((swimmer) => jsxs("option", {
                        value: swimmer.id,
                        children: [
                          swimmer.name,
                          " \xB7 ",
                          swimmer.groupName
                        ]
                      }, swimmer.id))]
                    })]
                  })]
                }),
                jsxs("label", {
                  className: "field job-select-field",
                  children: [
                    jsx("span", { children: "Select your assignment" }),
                    jsxs("select", {
                      value: jobId,
                      onChange: (event) => {
                        const nextId = Number(event.target.value) || "";
                        setJobId(nextId);
                        const picked = session?.jobs.find((job) => job.id === nextId);
                        setHours(picked ? String(picked.defaultHours) : "");
                      },
                      children: [
                        jsx("option", {
                          value: "",
                          children: jobCount ? `Choose from ${jobCount} ${jobCount === 1 ? "job" : "jobs"}\u2026` : "No jobs posted yet"
                        }),
                        ...sortedJobs.map((job) => jsx("option", {
                          value: job.id,
                          children: `${job.name} \xB7 ${displayTime(job.startTime)}\u2013${displayTime(job.endTime)} \xB7 ${job.defaultHours} hrs`
                        }, job.id))
                      ]
                    })
                  ]
                }),
                selectedJob && jsxs("div", {
                  className: "job-detail-strip",
                  children: [
                    jsxs("div", {
                      children: [
                        jsx("strong", { children: selectedJob.name }),
                        jsxs("span", { children: [
                          displayTime(selectedJob.startTime),
                          "\u2013",
                          displayTime(selectedJob.endTime)
                        ] })
                      ]
                    }),
                    jsxs("b", { children: [selectedJob.defaultHours, " hrs"] })
                  ]
                }),
                jsxs("div", {
                  className: "hours-row",
                  children: [jsxs("label", {
                    className: "field compact-field",
                    children: [jsx("span", { children: "Hours to credit" }), jsxs("div", {
                      className: "number-wrap",
                      children: [jsx("input", {
                        type: "number",
                        min: "0.25",
                        max: "24",
                        step: "0.25",
                        value: hours,
                        onChange: (event) => setHours(event.target.value)
                      }), jsx("b", { children: "HRS" })]
                    })]
                  }), hourPresets.length > 1 ? jsxs("div", {
                    className: "hour-presets",
                    children: [
                      jsx("span", {
                        className: "preset-label",
                        children: "Common for this job"
                      }),
                      jsx("div", {
                        className: "preset-chips",
                        role: "group",
                        "aria-label": "Common credit hours for this job",
                        children: hourPresets.map((value) => jsxs("button", {
                          type: "button",
                          className: `preset-chip ${Number(hours) === value ? "selected" : ""}`,
                          "aria-pressed": Number(hours) === value,
                          onClick: () => setHours(String(value)),
                          children: [value, " hrs"]
                        }, value))
                      })
                    ]
                  }) : jsx("p", { children: "Need a different amount? You can adjust it here before checking in." })]
                }),
                jsxs("button", {
                  className: "primary-button",
                  type: "submit",
                  disabled: !ready || busy,
                  children: [jsx("span", { children: busy ? "Saving\u2026" : "Check in now" }), jsx("b", {
                    "aria-hidden": "true",
                    children: "\u2192"
                  })]
                })
              ]
            }),
            notice && jsxs("div", {
              className: `notice ${notice.kind}`,
              role: "status",
              children: [
                jsx("b", { children: notice.kind === "success" ? "\u2713" : "!" }),
                jsx("span", { children: notice.text }),
                jsx("button", {
                  onClick: () => setNotice(null),
                  "aria-label": "Dismiss",
                  children: "\xD7"
                })
              ]
            })
          ]
        }), jsxs("aside", {
          className: "on-deck-card",
          children: [
            jsxs("div", {
              className: "card-head",
              children: [jsxs("div", { children: [jsx("span", {
                className: "step-number",
                children: "02"
              }), jsx("h2", { children: "On deck now" })] }), jsx("span", {
                className: "count-badge",
                children: activeEntries.length
              })]
            }),
            jsx("p", {
              className: "aside-intro",
              children: "Finished your shift? Find your name and check out."
            }),
            jsx("div", {
              className: "active-list",
              children: activeEntries.length ? activeEntries.map((entry) => jsxs("div", {
                className: "active-person",
                children: [
                  jsx("span", {
                    className: "avatar",
                    children: entry.volunteerName.split(" ").map((part) => part[0]).slice(0, 2).join("")
                  }),
                  jsxs("div", { children: [
                    jsx("strong", { children: entry.volunteerName }),
                    jsxs("span", { children: [
                      entry.jobName,
                      " \xB7 ",
                      entry.creditedHours,
                      " hrs"
                    ] }),
                    jsxs("small", { children: ["For ", entry.swimmerName] })
                  ] }),
                  jsx("button", {
                    onClick: () => void checkOut(entry),
                    disabled: busy,
                    children: "Check out"
                  })
                ]
              }, entry.id)) : jsxs("div", {
                className: "deck-empty",
                children: [
                  jsx("span", { children: "\u3030" }),
                  jsx("strong", { children: "The deck is clear" }),
                  jsx("small", { children: "Checked-in volunteers will appear here." })
                ]
              })
            }),
            jsxs("div", {
              className: "help-note",
              children: [jsx("b", { children: "Need help?" }), jsx("span", { children: "See the check-in operator at the volunteer desk." })]
            })
          ]
        })]
      }),
      jsxs("footer", {
        className: "public-footer page-width",
        children: [
          jsx(Brand, { compact: true }),
          jsx("p", { children: "Jenks Trojan Swim Club" }),
          jsx("span", { children: "JENKS, OKLAHOMA" })
        ]
      })
    ]
  });
}

export default VolunteerApp;
