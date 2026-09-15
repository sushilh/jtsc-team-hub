export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1620;
export type ThemeId = "trojan" | "gold" | "midnight";
export const meetThemes = {
  trojan: { label: "Trojan Maroon", primary: "#730f2b", dark: "#160b10", paper: "#faf9fa", ink: "#26131b", accent: "#d2b2bd" },
  gold: { label: "Championship Gold", primary: "#57182f", dark: "#1b1414", paper: "#fffdf7", ink: "#301b21", accent: "#efc443" },
  midnight: { label: "Midnight Blue", primary: "#16364e", dark: "#091622", paper: "#f5fafc", ink: "#152e42", accent: "#71d1e8" },
};
export type MeetBlock = {
  id: string; label: string; kind: "text" | "session" | "image" | "qr" | "panel";
  x: number; y: number; w: number; h: number;
  text?: string; fontSize: number; color?: string; background?: string;
  tone?: "light" | "accent" | "ink"; align?: "left" | "center" | "right";
  date?: string; day?: string; ageGroup?: string; warmup?: string; start?: string;
  warmupLabel?: string; startLabel?: string; fit?: "contain" | "cover";
  opacity?: number; hidden?: boolean;
};
/** Poster presets. The club runs everything from a one-session dual up to a
 *  four-day championship, and a seven-session layout leaves a one-session meet
 *  looking like a mistake, so small meets get their own proportions. */
export const meetLayouts = [
  { id: "single", sessions: 1, label: "1 session", detail: "Dual or intrasquad" },
  { id: "double", sessions: 2, label: "2 sessions", detail: "Two-day meet" },
  { id: "triple", sessions: 3, label: "3 sessions", detail: "Weekend invitational" },
  { id: "championship", sessions: 7, label: "Championship", detail: "Prelims and finals" },
] as const;
export type MeetLayoutId = typeof meetLayouts[number]["id"];

const SESSION_TOP = 596;
const COLUMN_LEFT = 36;
/** Sessions share a column with the livestream panel only on the big layout. */
const WIDE_COLUMN = 1008;
const NARROW_COLUMN = 708;

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function initialMeetBlocks(sessionCount = 7): MeetBlock[] {
  const text = (id: string, label: string, value: string, x: number, y: number, w: number, h: number, fontSize: number, tone: MeetBlock["tone"] = "light"): MeetBlock => ({ id, label, kind: "text", text: value, x, y, w, h, fontSize, tone });
  const count = Math.max(1, Math.min(7, Math.round(Number(sessionCount) || 7)));
  const compact = count <= 3;

  const header: MeetBlock[] = [
    { id: "photo", label: "Header photo", kind: "image", x: 0, y: 0, w: 1080, h: 340, fontSize: 20, fit: "cover", opacity: 0.3 },
    { id: "logo", label: "Club logo", kind: "image", x: 34, y: 48, w: 166, h: 230, fontSize: 20, fit: "contain" },
    text("title", "Meet title", compact ? "2026 JTSC" : "2026 OKS", 234, 33, 800, 76, 68),
    text("age", "Meet age group", compact ? "ALL AGES" : "11 & OVER", 234, 110, 800, 112, 96, "accent"),
    text("subtitle", "Meet subtitle", compact ? "INVITATIONAL" : "CHAMPIONSHIPS", 234, 236, 800, 71, 65),
    text("dates", "Meet dates", compact ? "JULY 23, 2026" : "JULY 23–26, 2026", 36, 369, 470, 60, 38),
    text("venue", "Venue / location", "JENKS TROJAN AQUATIC CENTER\nJENKS, OK", 556, 360, 484, 83, 28),
    text("amenities", "Meet information", "RIBBONS & MEDALS  ·  ATHLETE PARADES\nHEAT SHEETS ON MEET MOBILE  ·  CONCESSIONS & MERCH", 36, 487, 1008, 75, 24, "ink"),
  ];

  // Small meets: full-width sessions, then the livestream panel as a band beneath.
  // Big meet: a narrow session column beside a tall livestream panel.
  //
  // Sizes are capped rather than stretched to fill. A single session grown to
  // fill the column just spreads its own contents out and reads as a mistake,
  // so small layouts keep readable block sizes and centre the group instead,
  // which puts the leftover space above and below as deliberate margin.
  const REGION_TOP = SESSION_TOP;
  const REGION_BOTTOM = 1495;
  const BAND_GAP = 28;
  const geometry = compact
    ? { width: WIDE_COLUMN, height: count <= 2 ? 240 : 200, gap: count === 2 ? 18 : 16, band: count <= 2 ? 320 : 240 }
    : { width: NARROW_COLUMN, height: 112, gap: 10, band: 0 };

  const groupHeight = compact
    ? count * geometry.height + (count - 1) * geometry.gap + BAND_GAP + geometry.band
    : 0;
  const top = compact
    ? REGION_TOP + Math.max(0, Math.round((REGION_BOTTOM - REGION_TOP - groupHeight) / 2))
    : SESSION_TOP;

  const sessions: MeetBlock[] = Array.from({ length: count }, (_, i) => {
    const date = compact ? addDays("2026-07-23", i) : ["2026-07-23", "2026-07-24", "2026-07-24", "2026-07-25", "2026-07-25", "2026-07-26", "2026-07-26"][i];
    return {
      id: `session-${i}`, label: `Session ${i + 1}`, kind: "session",
      x: COLUMN_LEFT, y: top + i * (geometry.height + geometry.gap),
      w: geometry.width, h: geometry.height, fontSize: 20,
      date,
      day: compact ? `DAY ${i + 1}` : `DAY ${i === 0 ? 1 : Math.floor((i + 1) / 2) + 1}`,
      text: compact ? "TIMED FINALS" : i === 0 ? "1500M TIMED FINALS" : i % 2 ? "PRELIMS" : "FINALS",
      ageGroup: compact ? "All Ages" : "11 & Over",
      warmupLabel: "WARM-UP", startLabel: "MEET STARTS",
      warmup: compact ? "7:30–8:45 AM" : i === 0 ? "3:00–4:35 PM" : i % 2 ? "7:20–7:50 AM" : "3:30–4:50 PM",
      start: compact ? "9:00 AM" : i % 2 ? "9:00 AM" : "5:00 PM",
    };
  });

  const sessionsBottom = top + count * geometry.height + (count - 1) * geometry.gap;
  const qr: MeetBlock[] = [];
  if (compact) {
    const bandTop = sessionsBottom + BAND_GAP;
    const bandHeight = geometry.band;
    const code = Math.min(240, bandHeight - 56);
    const codeX = COLUMN_LEFT + WIDE_COLUMN - 30 - code;
    const copyWidth = codeX - COLUMN_LEFT - 60;
    // Centre the text stack against the QR so neither floats in the panel.
    const stack = 62 + 8 + 40 + 12 + 76;
    const textTop = bandTop + Math.max(24, Math.round((bandHeight - stack) / 2));
    qr.push(
      { id: "qr-panel", label: "Livestream panel", kind: "panel", x: COLUMN_LEFT, y: bandTop, w: WIDE_COLUMN, h: bandHeight, fontSize: 20 },
      text("qr-title", "QR heading", "WATCH LIVE!", COLUMN_LEFT + 30, textTop, copyWidth, 62, 38),
      text("qr-prompt", "QR instruction", "SCAN TO VIEW", COLUMN_LEFT + 30, textTop + 70, copyWidth, 40, 24),
      { id: "qr", label: "QR code", kind: "qr", x: codeX, y: bandTop + Math.round((bandHeight - code) / 2), w: code, h: code, fontSize: 20 },
      text("qr-copy", "QR supporting text", "CAN'T MAKE IT TO THE POOL?\nCATCH ALL THE ACTION LIVE ONLINE!", COLUMN_LEFT + 30, textTop + 122, copyWidth, 76, 26),
    );
  } else {
    qr.push(
      { id: "qr-panel", label: "Livestream panel", kind: "panel", x: 776, y: 596, w: 268, h: 862, fontSize: 20 },
      text("qr-title", "QR heading", "WATCH LIVE!", 794, 634, 232, 74, 38),
      text("qr-prompt", "QR instruction", "SCAN TO VIEW", 794, 725, 232, 45, 24),
      { id: "qr", label: "QR code", kind: "qr", x: 790, y: 795, w: 240, h: 240, fontSize: 20 },
      text("qr-copy", "QR supporting text", "CAN'T MAKE IT\nTO THE POOL?\n\nCATCH ALL THE ACTION\nLIVE ONLINE!", 797, 1110, 225, 266, 26),
    );
  }

  return [...header, ...qr, ...sessions, text("footer", "Footer motto", "ONE TEAM.  /  ONE GOAL.  /  TROJAN PRIDE.", 36, 1519, 1008, 65, 36)];
}

export function clampBlock(block: MeetBlock): MeetBlock {
  const w = Math.min(POSTER_WIDTH, Math.max(60, Number(block.w) || 60));
  const h = block.kind === "qr" ? w : Math.min(POSTER_HEIGHT, Math.max(35, Number(block.h) || 35));
  return { ...block, w, h, x: Math.max(0, Math.min(POSTER_WIDTH - w, Number(block.x) || 0)), y: Math.max(0, Math.min(POSTER_HEIGHT - h, Number(block.y) || 0)), fontSize: Math.max(12, Math.min(160, Number(block.fontSize) || 20)) };
}
export function hitTest(blocks: MeetBlock[], x: number, y: number) {
  return [...blocks].reverse().find(b => !b.hidden && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}
export function sessionDate(value = "") {
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" }).format(date).toUpperCase();
}
