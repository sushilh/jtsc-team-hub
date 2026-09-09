export type BookSession = { title: string; date: string; day: string; ageGroup: string; warmup: string; start: string; source: string };
export type BookDraft = { sessions: BookSession[]; events: string[] };
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function readDate(line: string, year: string) {
  const iso = line.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const named = line.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,?\s+(20\d{2}))?\b/i);
  const numeric = line.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  const value = iso?.[1] || (named && (named[3] || year) ? `${named[3] || year}-${String(months.indexOf(named[1].slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}-${named[2].padStart(2, "0")}` : numeric ? `${numeric[3]}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}` : "");
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

// Heuristic drafts only. Do not infer a time, age group, or date absent from the text.
export function parseMeetBook(text: string): BookDraft {
  const lines = text.slice(0, 200000).split(/\r?\n/).map(line => line.trim().replace(/\s+/g, " ")).filter(Boolean);
  const year = text.match(/\b(20\d{2})\b/)?.[1] || "";
  const sessions: BookSession[] = [], events: string[] = [];
  let current: BookSession | undefined, date = "", day = "";
  const time = "(?:\\d{1,2}:\\d{2}(?:\\s*[AP]\\.?M\\.?)?|\\d{1,2}\\s*[AP]\\.?M\\.?)";
  for (const line of lines) {
    const nextDate = readDate(line, year);
    const nextDay = line.match(/\bDAY\s+\d+\b/i)?.[0];
    if (nextDate && nextDate !== date) { date = nextDate; current = undefined; day = ""; }
    if (nextDay) day = nextDay;
    const isEvent = /^(?:event\s*#?\s*)?\d{1,3}[.)\s]+.*(?:freestyle|backstroke|breaststroke|butterfly|medley|relay|\bfree\b|\bback\b|\bbreast\b|\bfly\b|\bIM\b)/i.test(line);
    if (isEvent) { if (!events.includes(line)) events.push(line); continue; }
    const heading = line.match(/(?:^|\b)(session\s*#?\s*\d+[^:]*|(?:morning\s+|afternoon\s+|evening\s+)?prelims?\b|preliminaries\b|(?:timed\s+)?finals\b)/i);
    if (heading && !/warm[- ]?up|will|must|shall|entry|entries|deadline|qualifying/i.test(line)) {
      current = { title: line, date, day, ageGroup: "", warmup: "", start: "", source: line };
      sessions.push(current);
    }
    if (!current) continue;
    if (current.source !== line) current.source = `${current.source}\n${line}`.slice(0, 1500);
    const age = line.match(/\b(?:\d{1,2}\s*(?:&|and)\s*(?:over|under)|\d{1,2}\s*[-–]\s*\d{1,2}|open|senior)\b/i)?.[0];
    if (age && !current.ageGroup) current.ageGroup = age;
    const warmup = line.match(new RegExp(`warm[- ]?ups?\\s*(?:starts?|begins?|from)?\\s*[:–-]?\\s*(${time}(?:\\s*(?:-|–|—|to)\\s*${time})?)`, "i"));
    const start = line.match(new RegExp(`(?:meet\\s*(?:starts?|begins?)|session\\s*(?:starts?|begins?)|start(?:\\s*time)?|competition(?:\\s*(?:starts?|begins?))?)\\s*[:–-]?\\s*(${time})`, "i"));
    if (warmup) current.warmup = warmup[1];
    if (start) current.start = start[1];
  }
  const unique = sessions.filter((s, i) => sessions.findIndex(other => other.title === s.title && other.date === s.date) === i);
  return { sessions: unique.slice(0, 50), events: events.slice(0, 200) };
}

export async function readMeetBook(file: File, progress: (message: string) => void): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Choose a meet book smaller than 15 MB.");
  if (/\.txt$/i.test(file.name) || file.type === "text/plain") return (await file.text()).slice(0, 200000);
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error("Choose a PDF or plain-text meet book.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  // Password-protected PDFs should fail promptly instead of waiting for an invisible prompt.
  loading.onPassword = () => { void loading.destroy(); };
  try {
    const document = await loading.promise;
    if (document.numPages > 60) throw new Error("This book has more than 60 pages. Upload only the schedule pages or paste their text below.");
    let text = "";
    for (let number = 1; number <= document.numPages; number++) {
      progress(`Reading page ${number} of ${document.numPages}…`);
      const page = await document.getPage(number), content = await page.getTextContent();
      const rows: { y: number; items: { x: number; text: string }[] }[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5], x = item.transform[4];
        let row = rows.find(row => Math.abs(row.y - y) < 3);
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x, text: item.str });
      }
      text += rows.sort((a, b) => b.y - a.y).map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.text).join(" ")).join("\n") + "\n\n";
      page.cleanup();
      if (text.length > 200000) break;
    }
    if (text.trim().length < 30) throw new Error("This PDF appears to be scanned or has no readable text. Paste the schedule below, or upload a text-searchable PDF. OCR is not available here.");
    return text.slice(0, 200000);
  } finally { await loading.destroy(); }
}
