"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COURSES, formatSwimTime, getQualifyingSeries, getTeamRecords, standardsForAge, STROKES } from "../../lib/state-qualifying-times.mjs";

type Gender = "girls" | "boys";
type Point = { distance: number; seconds: number; timeText: string };
type Series = { id: string; name: string; color: string; sourceUrl: string; ageGroupLabel: string; points: Point[] };
type Standard = { id: string; name: string; color: string; sourceUrl: string };
type TeamRecord = { distance: number; seconds: number; timeText: string };

const STROKE_LABELS: Record<string, string> = { Free: "Freestyle", Back: "Backstroke", Breast: "Breaststroke", Fly: "Butterfly", IM: "IM" };
const COURSE_LABELS: Record<string, string> = { SCY: "Yards (SCY)", SCM: "Meters — Short Course (SCM)", LCM: "Meters — Long Course (LCM)" };

function eventLabel(stroke: string, distance: number) {
  return `${distance} ${stroke === "IM" ? "IM" : stroke}`;
}

/** Mixes `hex` toward white (positive amount) or black (negative), for the extruded faces. */
function shade(hex: string, amount: number) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (channel: number) => Math.round(channel + (target - channel) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

const DEPTH_X = 8;
const DEPTH_Y = 6;

/** A 3D-extruded column: a front face, a top parallelogram, and a side parallelogram. */
function Bar3D({ x, y, width, height, color, label, title }: { x: number; y: number; width: number; height: number; color: string; label: string; title: string }) {
  if (height <= 0) return null;
  const front = `M${x},${y + height} L${x},${y} L${x + width},${y} L${x + width},${y + height} Z`;
  const top = `M${x},${y} L${x + DEPTH_X},${y - DEPTH_Y} L${x + width + DEPTH_X},${y - DEPTH_Y} L${x + width},${y} Z`;
  const side = `M${x + width},${y} L${x + width + DEPTH_X},${y - DEPTH_Y} L${x + width + DEPTH_X},${y - DEPTH_Y + height} L${x + width},${y + height} Z`;
  return <g className="qt-bar3d">
    <title>{title}</title>
    <path d={side} fill={shade(color, -0.32)} />
    <path d={top} fill={shade(color, 0.4)} />
    <path d={front} fill={color} />
    <text x={x + width / 2} y={y - DEPTH_Y - 8} textAnchor="middle" className="qt-bar-label">{label}</text>
  </g>;
}

function DistanceChart({ distance, stroke, entries, record }: { distance: number; stroke: string; entries: { standard: Standard; point?: Point }[]; record?: TeamRecord }) {
  const present = entries.filter((entry): entry is { standard: Standard; point: Point } => Boolean(entry.point));
  if (!present.length && !record) return null;
  const maxSeconds = Math.max(...present.map((entry) => entry.point.seconds), ...(record ? [record.seconds] : []));
  const barWidth = 28;
  const gap = 16;
  const chartHeight = 108;
  const recordGutter = record ? 36 : 0;
  const padding = { top: 30, bottom: 20, side: 14 };
  const width = Math.max(present.length, 1) * barWidth + Math.max(present.length - 1, 0) * gap;
  const svgWidth = width + padding.side * 2 + DEPTH_X + recordGutter;
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const baselineY = svgHeight - padding.bottom;
  const recordY = record ? baselineY - (record.seconds / maxSeconds) * chartHeight : null;

  return (
    <figure className="qt-card">
      <figcaption>{eventLabel(stroke, distance)}</figcaption>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label={`${eventLabel(stroke, distance)} qualifying times by standard${record ? `, with the JTSC team record` : ""}`}>
        <path d={`M${padding.side},${baselineY} L${padding.side + width},${baselineY} L${padding.side + width + DEPTH_X},${baselineY - DEPTH_Y} L${padding.side + DEPTH_X},${baselineY - DEPTH_Y} Z`} className="qt-floor" />
        {present.map((entry, index) => {
          const x = padding.side + index * (barWidth + gap);
          const barHeight = (entry.point.seconds / maxSeconds) * chartHeight;
          return <Bar3D key={entry.standard.id} x={x} y={baselineY - barHeight} width={barWidth} height={barHeight}
            color={entry.standard.color} label={entry.point.timeText} title={`${entry.standard.name}: ${entry.point.timeText}`} />;
        })}
        {recordY != null && <g className="qt-record">
          <title>{`JTSC team record: ${record!.timeText}`}</title>
          <line x1={padding.side - 4} y1={recordY} x2={padding.side + width + DEPTH_X + 4} y2={recordY} className="qt-record-line" />
          <text x={svgWidth} y={recordY - 4} textAnchor="end" className="qt-record-label">{record!.timeText}</text>
        </g>}
      </svg>
    </figure>
  );
}

export default function StateTimesApp() {
  const [age, setAge] = useState(11);
  const [gender, setGender] = useState<Gender>("girls");
  const [stroke, setStroke] = useState("Free");
  const [course, setCourse] = useState("SCY");

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
      <p className="state-times-lede">Enter an age, gender, and stroke to see every state and regional qualifying standard that applies, side by side.</p>
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
        JTSC Team Record (SCY only)
      </li>}
    </ul>}

    {distances.length === 0
      ? <p className="state-times-empty">No {STROKE_LABELS[stroke].toLowerCase()} standards are published for a {age}-year-old in {COURSE_LABELS[course]}. Try a different course — most events qualify from any of the three.</p>
      : <div className="state-times-grid">
        {distances.map((distance) => <DistanceChart key={distance} distance={distance} stroke={stroke}
          record={recordByDistance.get(distance)}
          entries={applicableStandards.map((standard) => ({
            standard,
            point: seriesById.get(standard.id)?.points.find((point) => point.distance === distance),
          }))} />)}
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
      {teamRecords.length > 0 && <p>JTSC Team Records are the club&rsquo;s own SCY bests, from the team&rsquo;s 2026 records list.</p>}
      {applicableStandards.length > 0 && <ul>
        {applicableStandards.map((standard) => <li key={standard.id}><a href={standard.sourceUrl} target="_blank" rel="noreferrer noopener">{standard.name} (PDF)</a></li>)}
      </ul>}
    </footer>
  </main>;
}
