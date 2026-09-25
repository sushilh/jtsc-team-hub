"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COURSES, formatSwimTime, getQualifyingSeries, getTeamRecords, parseSwimTime, standardsForAge, STROKES } from "../../lib/state-qualifying-times.mjs";

type Gender = "girls" | "boys";
type Point = { distance: number; seconds: number; timeText: string };
type Series = { id: string; name: string; color: string; sourceUrl?: string; ageGroupLabel: string; points: Point[] };
type Standard = { id: string; name: string; color: string; sourceUrl?: string };
type TeamRecord = { distance: number; seconds: number; timeText: string };
type Rung = { key: string; kind: "standard" | "record" | "you"; name: string; color?: string; seconds: number; timeText: string; met: boolean };

const STROKE_LABELS: Record<string, string> = { Free: "Freestyle", Back: "Backstroke", Breast: "Breaststroke", Fly: "Butterfly", IM: "IM" };
const COURSE_LABELS: Record<string, string> = { SCY: "Yards (SCY)", SCM: "Meters — Short Course (SCM)", LCM: "Meters — Long Course (LCM)" };
// Full names live in the legend, table, and footer; the ladder rows are narrow
// enough that the full standard names would clip, so rungs use these instead.
const SHORT_STANDARD_NAMES: Record<string, string> = {
  "10u-state": "10-Under State",
  "14u-state": "14-Under State",
  "regional": "Regional",
  "11o-state-lc": "11-Over State",
  "sr-state": "Senior State",
};

function eventLabel(stroke: string, distance: number) {
  return `${distance} ${stroke === "IM" ? "IM" : stroke}`;
}

/**
 * One event's cuts as a ladder, slowest at top to fastest at bottom. A typed-in
 * time drops into its sorted position and marks every standard it's already
 * fast enough for — this answers "did my swimmer make this cut", which a bar's
 * height alone doesn't.
 */
function EventLadder({ distance, stroke, entries, record, enteredTime, onEnteredTimeChange }: {
  distance: number; stroke: string; entries: { standard: Standard; point?: Point }[]; record?: TeamRecord;
  enteredTime: string; onEnteredTimeChange: (value: string) => void;
}) {
  const present = entries.filter((entry): entry is { standard: Standard; point: Point } => Boolean(entry.point));
  if (!present.length && !record) return null;

  const yourSeconds = enteredTime.trim() ? parseSwimTime(enteredTime.trim()) : null;
  const invalid = enteredTime.trim().length > 0 && yourSeconds == null;

  const rungs: Rung[] = present.map((entry) => ({
    key: entry.standard.id, kind: "standard", name: SHORT_STANDARD_NAMES[entry.standard.id] ?? entry.standard.name, color: entry.standard.color,
    seconds: entry.point.seconds, timeText: entry.point.timeText,
    met: yourSeconds != null && yourSeconds <= entry.point.seconds,
  }));
  if (record) rungs.push({ key: "record", kind: "record", name: "Team Record", seconds: record.seconds, timeText: record.timeText, met: yourSeconds != null && yourSeconds <= record.seconds });
  rungs.sort((a, b) => b.seconds - a.seconds);
  if (yourSeconds != null) {
    const index = rungs.findIndex((rung) => rung.seconds < yourSeconds);
    const you: Rung = { key: "you", kind: "you", name: "Your time", seconds: yourSeconds, timeText: formatSwimTime(yourSeconds), met: true };
    rungs.splice(index === -1 ? rungs.length : index, 0, you);
  }

  return (
    <figure className="qt-card">
      <figcaption>{eventLabel(stroke, distance)}</figcaption>
      <label className="qt-time-field">
        <span>Your time</span>
        <input type="text" inputMode="decimal" placeholder="e.g. 31.09" value={enteredTime}
          className={invalid ? "qt-time-invalid" : ""}
          onChange={(event) => onEnteredTimeChange(event.target.value)} />
      </label>
      {invalid && <p className="qt-time-hint">Use ss.hh or m:ss.hh</p>}
      <ol className="qt-ladder">
        {rungs.map((rung) => <li key={rung.key} className={`qt-rung qt-rung-${rung.kind}${rung.met ? " qt-rung-met" : ""}`}>
          <span className="qt-rung-dot" style={rung.color ? { background: rung.color } : undefined} aria-hidden="true" />
          <span className="qt-rung-name">{rung.name}</span>
          <span className="qt-rung-time">{rung.timeText}</span>
          {rung.met && rung.kind !== "you" && <span className="qt-rung-check" aria-label="Already met">✓</span>}
        </li>)}
      </ol>
    </figure>
  );
}

export default function StateTimesApp() {
  const [age, setAge] = useState(11);
  const [gender, setGender] = useState<Gender>("girls");
  const [stroke, setStroke] = useState("Free");
  const [course, setCourse] = useState("SCY");
  const [enteredTimes, setEnteredTimes] = useState<Record<string, string>>({});

  const series: Series[] = useMemo(() => getQualifyingSeries({ age, gender, stroke, course }), [age, gender, stroke, course]);
  const applicableStandards: Standard[] = useMemo(() => standardsForAge(age), [age]);
  const teamRecords: TeamRecord[] = useMemo(() => getTeamRecords({ age, gender, stroke, course }), [age, gender, stroke, course]);

  const distances = useMemo(() => {
    const set = new Set<number>();
    for (const item of series) for (const point of item.points) set.add(point.distance);
    for (const record of teamRecords) set.add(record.distance);
    return [...set].sort((a, b) => a - b);
  }, [series, teamRecords]);

  const seriesById = useMemo(() => new Map(series.map((item) => [item.id, item])), [series]);
  const recordByDistance = useMemo(() => new Map(teamRecords.map((record) => [record.distance, record])), [teamRecords]);

  return <main className="state-times">
    <header className="state-times-hero">
      <Link className="state-times-back" href="/">← Back to Team Hub</Link>
      <p className="state-times-kicker">JTSC · 2025-2028 OKS Standards</p>
      <h1>State qualifying times</h1>
      <p className="state-times-lede">Enter an age, gender, and stroke to see every state and regional qualifying standard that applies — then type in a swim time to see exactly which cuts it already meets.</p>
    </header>

    <section className="state-times-controls" aria-label="Filter qualifying times">
      <label className="state-times-field">
        <span>Age</span>
        <input type="number" min={5} max={18} value={age}
          onChange={(event) => setAge(Math.min(18, Math.max(5, Number(event.target.value) || 5)))} />
      </label>

      <div className="state-times-field">
        <span>Gender</span>
        <div className="state-times-toggle" role="group" aria-label="Gender">
          {(["girls", "boys"] as const).map((value) => <button key={value} type="button"
            className={gender === value ? "active" : ""} aria-pressed={gender === value}
            onClick={() => setGender(value)}>{value === "girls" ? "Girls" : "Boys"}</button>)}
        </div>
      </div>

      <div className="state-times-field">
        <span>Stroke</span>
        <div className="state-times-toggle" role="group" aria-label="Stroke">
          {STROKES.map((value: string) => <button key={value} type="button"
            className={stroke === value ? "active" : ""} aria-pressed={stroke === value}
            onClick={() => setStroke(value)}>{STROKE_LABELS[value]}</button>)}
        </div>
      </div>

      <div className="state-times-field">
        <span>Course (where the time was swum)</span>
        <div className="state-times-toggle" role="group" aria-label="Course">
          {COURSES.map((value: string) => <button key={value} type="button"
            className={course === value ? "active" : ""} aria-pressed={course === value}
            onClick={() => setCourse(value)}>{value}</button>)}
        </div>
      </div>
    </section>

    {(applicableStandards.length > 0 || teamRecords.length > 0) && <ul className="state-times-legend" aria-label="Qualifying standards for this age">
      {applicableStandards.map((standard) => <li key={standard.id}>
        <span className="qt-swatch" style={{ background: standard.color }} aria-hidden="true" />
        {standard.name}
      </li>)}
      {teamRecords.length > 0 && <li>
        <span className="qt-swatch qt-swatch-record" aria-hidden="true" />
        JTSC Team Record ({course})
      </li>}
    </ul>}

    {distances.length === 0
      ? <p className="state-times-empty">No {STROKE_LABELS[stroke].toLowerCase()} standards are published for a {age}-year-old in {COURSE_LABELS[course]}. Try a different course — most events qualify from any of the three.</p>
      : <div className="state-times-grid">
        {distances.map((distance) => <EventLadder key={distance} distance={distance} stroke={stroke}
          record={recordByDistance.get(distance)}
          entries={applicableStandards.map((standard) => ({
            standard,
            point: seriesById.get(standard.id)?.points.find((point) => point.distance === distance),
          }))}
          enteredTime={enteredTimes[`${stroke}:${distance}`] ?? ""}
          onEnteredTimeChange={(value) => setEnteredTimes((current) => ({ ...current, [`${stroke}:${distance}`]: value }))} />)}
      </div>}

    {distances.length > 0 && <div className="state-times-table table-scroll">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            {applicableStandards.map((standard) => <th key={standard.id}>{standard.name}</th>)}
            {teamRecords.length > 0 && <th>JTSC Record</th>}
          </tr>
        </thead>
        <tbody>
          {distances.map((distance) => <tr key={distance}>
            <td><strong>{eventLabel(stroke, distance)}</strong></td>
            {applicableStandards.map((standard) => {
              const point = seriesById.get(standard.id)?.points.find((item) => item.distance === distance);
              return <td key={standard.id}>{point ? formatSwimTime(point.seconds) : "—"}</td>;
            })}
            {teamRecords.length > 0 && <td>{recordByDistance.get(distance)?.timeText ?? "—"}</td>}
          </tr>)}
        </tbody>
      </table>
    </div>}

    <footer className="state-times-footer">
      <p>Source: Oklahoma Swimming, <em>2025-2028 OKS Qualifying Times</em>, fetched September 2026. Standards can be corrected or amended by OKS after publication — confirm with your coach before entering a meet.</p>
      {teamRecords.length > 0 && <p>JTSC Team Records are the club&rsquo;s own {course} bests, from the team&rsquo;s 2026 records list. No SCM (short course meters) records are tracked.</p>}
      {applicableStandards.some((standard) => standard.id.startsWith("cz-sectionals")) &&
        <p>Central Zone Region 8 Sectionals cuts are club-provided (2026), no public source page to link, and open to any age. The Bonus standard is deliberately slower/easier than Sectionals — it&rsquo;s for adding a bonus event once a swimmer has already made Sectionals elsewhere, not a harder tier. No SCM data was provided; the mile Free events (800/1000/1500/1650) have no separate Bonus time.</p>}
      {applicableStandards.length > 0 && <ul>
        {applicableStandards.map((standard) => standard.sourceUrl
          ? <li key={standard.id}><a href={standard.sourceUrl} target="_blank" rel="noreferrer noopener">{standard.name} (PDF)</a></li>
          : <li key={standard.id}>{standard.name} (source not linkable)</li>)}
      </ul>}
    </footer>
  </main>;
}
