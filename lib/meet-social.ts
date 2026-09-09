import { POSTER_WIDTH, POSTER_HEIGHT, sessionDate, type MeetBlock } from "./meet-day";

export const meetExportFormats = {
  instagram: { label: "Instagram portrait", width: 1080, height: 1350 },
  facebook: { label: "Facebook square", width: 1080, height: 1080 },
  poster: { label: "Original poster", width: 1080, height: 1620 },
};
export type MeetExportFormat = keyof typeof meetExportFormats;
export function meetExportSize(format: MeetExportFormat, quality: 1 | 2) {
  const { width, height } = meetExportFormats[format];
  return { width: width * quality, height: height * quality };
}
export function fitMeetPoster(width: number, height: number) {
  const scale = Math.min(width / POSTER_WIDTH, height / POSTER_HEIGHT);
  return { scale, x: (width - POSTER_WIDTH * scale) / 2, y: (height - POSTER_HEIGHT * scale) / 2 };
}

function limitedCaption(parts: string[], limit: number) {
  const tags = "#JTSC #JenksTrojans";
  const text = parts.filter(Boolean).join("\n\n");
  if (text.length + tags.length + 2 <= limit) return [text, tags].filter(Boolean).join("\n\n");
  const suffix = `\n\nSee the full schedule in the image.\n\n${tags}`;
  let shortened = text.slice(0, limit - suffix.length - 1);
  const boundary = shortened.lastIndexOf("\n");
  if (boundary > shortened.length / 2) shortened = shortened.slice(0, boundary);
  return shortened.trimEnd() + "…" + suffix;
}

export function createMeetCaptions(blocks: MeetBlock[], hasQr: boolean) {
  const visible = blocks.filter(b => !b.hidden);
  const text = (id: string) => visible.find(b => b.id === id)?.text?.trim() || "";
  const headings = ["title", "age", "subtitle", "dates", "venue"];
  const intro = headings.map(text).filter(Boolean).join("\n");
  const sessions = visible.filter(b => b.kind === "session").sort((a, b) => a.y - b.y || a.x - b.x).map(b => {
    return [
      [b.day, sessionDate(b.date), b.text, b.ageGroup].filter(Boolean).join(" · "),
      b.warmup ? `${b.warmupLabel || "Warm-up"}: ${b.warmup}` : "",
      b.start ? `${b.startLabel || "Start"}: ${b.start}` : "",
    ].filter(Boolean).join("\n");
  }).filter(Boolean);
  const other = visible.filter(b => b.kind === "text" && !headings.includes(b.id) && !b.id.startsWith("qr-") && b.id !== "footer").map(b => b.text?.trim()).filter(Boolean).join("\n");
  const body = [intro, sessions.length ? "SESSION SCHEDULE\n" + sessions.join("\n\n") : "", other, hasQr ? "Scan the QR code on the poster for details." : ""];
  return {
    instagram: limitedCaption(["Meet day with the Trojans!", ...body], 2200),
    facebook: limitedCaption(["Join Jenks Trojan Swim Club for meet day!", ...body], 5000),
  };
}
