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
export function initialMeetBlocks(): MeetBlock[] {
  const text = (id: string, label: string, value: string, x: number, y: number, w: number, h: number, fontSize: number, tone: MeetBlock["tone"] = "light"): MeetBlock => ({ id, label, kind: "text", text: value, x, y, w, h, fontSize, tone });
  const dates = ["2026-07-23", "2026-07-24", "2026-07-24", "2026-07-25", "2026-07-25", "2026-07-26", "2026-07-26"];
  return [
    { id: "photo", label: "Header photo", kind: "image", x: 0, y: 0, w: 1080, h: 340, fontSize: 20, fit: "cover", opacity: 0.3 },
    { id: "logo", label: "Club logo", kind: "image", x: 34, y: 48, w: 166, h: 230, fontSize: 20, fit: "contain" },
    text("title", "Meet title", "2026 OKS", 234, 33, 800, 76, 68),
    text("age", "Meet age group", "11 & OVER", 234, 110, 800, 112, 96, "accent"),
    text("subtitle", "Meet subtitle", "CHAMPIONSHIPS", 234, 236, 800, 71, 65),
    text("dates", "Meet dates", "JULY 23–26, 2026", 36, 369, 470, 60, 38),
    text("venue", "Venue / location", "JENKS TROJAN AQUATIC CENTER\nJENKS, OK", 556, 360, 484, 83, 28),
    text("amenities", "Meet information", "RIBBONS & MEDALS  ·  ATHLETE PARADES\nHEAT SHEETS ON MEET MOBILE  ·  CONCESSIONS & MERCH", 36, 487, 1008, 75, 24, "ink"),
    { id: "qr-panel", label: "Livestream panel", kind: "panel", x: 776, y: 596, w: 268, h: 862, fontSize: 20 },
    text("qr-title", "QR heading", "WATCH LIVE!", 794, 634, 232, 74, 38),
    text("qr-prompt", "QR instruction", "SCAN TO VIEW", 794, 725, 232, 45, 24),
    { id: "qr", label: "QR code", kind: "qr", x: 790, y: 795, w: 240, h: 240, fontSize: 20 },
    text("qr-copy", "QR supporting text", "CAN’T MAKE IT\nTO THE POOL?\n\nCATCH ALL THE ACTION\nLIVE ONLINE!", 797, 1110, 225, 266, 26),
    ...dates.map((date, i): MeetBlock => ({ id: `session-${i}`, label: `Session ${i + 1}`, kind: "session", x: 36, y: 596 + i * 122, w: 708, h: 112, fontSize: 20, date, day: `DAY ${i === 0 ? 1 : Math.floor((i + 1) / 2) + 1}`, text: i === 0 ? "1500M TIMED FINALS" : i % 2 ? "PRELIMS" : "FINALS", ageGroup: "11 & Over", warmupLabel: "WARM-UP", startLabel: "MEET STARTS", warmup: i === 0 ? "3:00–4:35 PM" : i % 2 ? "7:20–7:50 AM" : "3:30–4:50 PM", start: i % 2 ? "9:00 AM" : "5:00 PM" })),
    text("footer", "Footer motto", "ONE TEAM.  /  ONE GOAL.  /  TROJAN PRIDE.", 36, 1519, 1008, 65, 36),
  ];
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
