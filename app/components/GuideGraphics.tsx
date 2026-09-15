/**
 * Hand-drawn SVG for the parent guide.
 *
 * All of it is inline and uses the brand CSS variables, so there are no image
 * requests and nothing to keep in sync with the palette. Graphics that restate
 * information already written in text are aria-hidden: the text stays the
 * accessible source, and these are the visual aid beside it.
 */

/** Forearm marked up the way a swimmer's is before warmups. */
export function ArmMarkingDiagram() {
  const rows = [
    { event: "2", heat: "1", lane: "8", stroke: "50 FR" },
    { event: "12", heat: "2", lane: "5", stroke: "25 FLY" },
    { event: "22", heat: "3", lane: "1", stroke: "50 BK" },
  ];
  return (
    <svg className="guide-arm-svg" viewBox="0 0 260 300" role="img"
      aria-label="A forearm marked with three events, each showing event number, heat, lane and stroke.">
      <defs>
        <linearGradient id="armSkin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--guide-arm-light, #f6e2d4)" />
          <stop offset="100%" stopColor="var(--guide-arm-dark, #e8cdb9)" />
        </linearGradient>
      </defs>

      {/* Forearm and hand, drawn as one silhouette so the marks sit on skin. */}
      <path
        d="M96 14 C82 14 74 26 74 42 L70 196 C68 226 62 238 56 252
           C48 270 56 288 78 290 L166 290 C188 288 196 270 188 252
           C182 238 176 226 174 196 L170 42 C170 26 162 14 148 14 Z"
        fill="url(#armSkin)" stroke="var(--maroon)" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Wrist crease, so the hand end reads correctly. */}
      <path d="M72 208 C104 218 140 218 172 208" fill="none"
        stroke="var(--maroon)" strokeWidth="2" opacity=".35" strokeLinecap="round" />

      {/* Column headings, small like real marker writing. */}
      <g className="guide-arm-ink" fill="var(--ink)">
        <text x="92" y="48" className="guide-arm-head">E</text>
        <text x="120" y="48" className="guide-arm-head">H</text>
        <text x="146" y="48" className="guide-arm-head">L</text>
        <line x1="84" y1="56" x2="164" y2="56" stroke="var(--ink)" strokeWidth="1.5" opacity=".45" />

        {rows.map((row, index) => {
          const y = 84 + index * 46;
          return (
            <g key={row.event} className="guide-arm-row" style={{ "--row": index } as React.CSSProperties}>
              <text x="92" y={y} className="guide-arm-num">{row.event}</text>
              <text x="120" y={y} className="guide-arm-num">{row.heat}</text>
              <text x="146" y={y} className="guide-arm-num">{row.lane}</text>
              <text x="84" y={y + 19} className="guide-arm-stroke">{row.stroke}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Twelve months from September, so neither season wraps the year end. */
export function SeasonTimeline() {
  const months = ["S", "O", "N", "D", "J", "F", "M", "A", "M", "J", "J", "A"];
  const full = ["September", "October", "November", "December", "January", "February",
    "March", "April", "May", "June", "July", "August"];
  const step = 100 / 12;
  return (
    <div className="guide-timeline" role="img"
      aria-label="Short Course runs September through February; Long Course runs March through August.">
      <div className="guide-timeline-track">
        <div className="guide-timeline-band scy" style={{ left: 0, width: `${step * 6}%` }}>
          <span>Short Course · SCY</span>
        </div>
        <div className="guide-timeline-band lcm" style={{ left: `${step * 6}%`, width: `${step * 6}%` }}>
          <span>Long Course · LCM</span>
        </div>
      </div>
      <div className="guide-timeline-months" aria-hidden="true">
        {months.map((m, i) => <span key={full[i]} title={full[i]}>{m}</span>)}
      </div>
    </div>
  );
}

/* ── Gear icons ─────────────────────────────────────────────────────────────
   One 24×24 stroke grid, currentColor, so they inherit the list's text colour. */

const ICON_PATHS: Record<string, React.ReactNode> = {
  suit: <><path d="M7 3h10l-1 6c0 4-1 7-4 12-3-5-4-8-4-12L7 3Z" /><path d="M9.5 3c.6 1.4 1.4 2 2.5 2s1.9-.6 2.5-2" /></>,
  cap: <><path d="M4 13a8 8 0 0 1 16 0" /><path d="M4 13c2.4 1.6 5.2 2.4 8 2.4s5.6-.8 8-2.4" /><path d="M12 5v8" /></>,
  goggles: <><circle cx="7.5" cy="12" r="3.6" /><circle cx="16.5" cy="12" r="3.6" /><path d="M11.1 12h1.8" /><path d="M3.9 12H2m18.1 0H22" /></>,
  towel: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 4v16M4 9h16" /></>,
  marker: <><path d="M14 3.5 20.5 10l-9 9H5v-6.5l9-9Z" /><path d="M12 5.5 18.5 12" /></>,
  shirt: <><path d="M8 3 4 5.5 6 9l2-1v11h8V8l2 1 2-3.5L16 3l-2 1.6h-4L8 3Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>,
  bottle: <><path d="M10 2h4v3l1.5 2v13a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7L10 5V2Z" /><path d="M8.5 12h7" /></>,
  bag: <><path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8.5v7M8.5 12h7" /></>,
};

export function GearIcon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg className="guide-gear-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

/** A list whose items carry an icon. Falls back to a plain bullet if unnamed. */
export function GearList({ items }: { items: Array<{ icon: keyof typeof ICON_PATHS; text: string }> }) {
  return (
    <ul className="guide-gear-list">
      {items.map((item) => (
        <li key={item.text}><GearIcon name={item.icon} /><span>{item.text}</span></li>
      ))}
    </ul>
  );
}
