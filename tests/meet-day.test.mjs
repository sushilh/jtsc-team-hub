import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { formatMeetDate, meetDetails, createCaptions } from "../lib/social-content.mjs";

async function moduleFrom(entry) {
  const result = await build({ entryPoints: [resolve(entry)], bundle: true, write: false, format: "esm", platform: "browser", external: ["pdfjs-dist"] });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const model = await moduleFrom("lib/meet-day.ts");
const { parseMeetBook, readMeetBook } = await moduleFrom("lib/meet-book.ts");
const { drawMeetPoster } = await moduleFrom("lib/meet-renderer.ts");

test("meet date is calendar-stable, optional, and included in both captions", () => {
  assert.equal(formatMeetDate("2026-07-23"), "Jul 23, 2026");
  assert.equal(formatMeetDate("2026-02-30"), "");
  assert.equal(formatMeetDate("2028-02-29"), "Feb 29, 2028");
  assert.equal(formatMeetDate("bad date"), "");
  assert.equal(meetDetails("", ""), "");
  assert.equal(meetDetails("Zones", ""), "Zones");
  assert.equal(meetDetails("", "2026-07-23"), "Jul 23, 2026");
  for (const caption of Object.values(createCaptions({ meetName: "Central Zone", meetDate: "2026-07-23" }))) assert.match(caption, /Central Zone · Jul 23, 2026/);
});

test("template components are unique, bounded, and QR stays square when resized", () => {
  const blocks = model.initialMeetBlocks();
  assert.equal(new Set(blocks.map(b => b.id)).size, blocks.length);
  assert.equal(blocks.filter(b => b.kind === "session").length, 7);
  for (const b of blocks) assert.deepEqual(model.clampBlock(b), b);
  const qr = model.clampBlock({ ...blocks.find(b => b.kind === "qr"), x: 2000, y: -100, w: 400, h: 100 });
  assert.equal(qr.h, qr.w); assert.equal(qr.x, 680); assert.equal(qr.y, 0);
  assert.equal(model.sessionDate("2026-07-23"), "THU, JUL 23");
  assert.equal(model.sessionDate("2026-02-30"), "");
});

test("hit testing selects the top visible block, including draggable panels", () => {
  const base = { id: "a", kind: "panel", x: 0, y: 0, w: 100, h: 100 };
  assert.equal(model.hitTest([base, { ...base, id: "b" }], 50, 50).id, "b");
  assert.equal(model.hitTest([base, { ...base, id: "b", hidden: true }], 50, 50).id, "a");
  assert.equal(model.hitTest([base], 101, 50), undefined);
});

test("meet book extracts only explicit sessions, dates, ages, and times", () => {
  const draft = parseMeetBook("July 23, 2026\nDAY 1\nSession 1 - Timed Finals\n11 & Over\nWarm-up: 3:00–4:35 PM\nMeet starts: 5:00 PM\nEvent 1 Girls 11 & Over 1500 Freestyle\nJuly 24, 2026\nSession 2 - Prelims\nWarm-up: 7:20 AM to 7:50 AM\nStart time: 9:00 AM\n2 Boys 11-12 50 Butterfly");
  assert.equal(draft.sessions.length, 2); assert.equal(draft.events.length, 2);
  assert.equal(draft.sessions[0].date, "2026-07-23");
  assert.equal(draft.sessions[0].day, "DAY 1");
  assert.equal(draft.sessions[0].ageGroup, "11 & Over");
  assert.equal(draft.sessions[0].warmup, "3:00–4:35 PM");
  assert.equal(draft.sessions[0].start, "5:00 PM");
  assert.equal(draft.sessions[1].start, "9:00 AM");
  assert.equal(draft.sessions[1].ageGroup, "");
  assert.equal(parseMeetBook("Session 1 - Prelims").sessions[0].date, "");
  assert.equal(parseMeetBook("Session 1 - Prelims").sessions[0].start, "");
  assert.deepEqual(parseMeetBook("Entries must be received before finals.\nNo schedule here."), { sessions: [], events: [] });
});

test("plain-text meet books can be imported; unsupported files are rejected", async () => {
  assert.equal(await readMeetBook(new File(["Session 1"], "book.txt", { type: "text/plain" }), () => {}), "Session 1");
  await assert.rejects(readMeetBook(new File(["data"], "book.docx"), () => {}), /PDF or plain-text/);
  await assert.rejects(readMeetBook({ size: 16 * 1024 * 1024 }, () => {}), /15 MB/);
});

test("all color themes render a poster; export has no editing outline and preserves QR padding", () => {
  for (const theme of Object.keys(model.meetThemes)) {
    const calls = [];
    const ctx = new Proxy({}, { get: (object, property) => property in object ? object[property] : (...args) => calls.push([property, ...args]), set: (object, property, value) => { object[property] = value; return true; } });
    const canvas = { getContext: () => ctx };
    const blocks = model.initialMeetBlocks();
    drawMeetPoster(canvas, blocks, theme, { qr: { naturalWidth: 240, naturalHeight: 240 } });
    assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1620);
    assert.ok(calls.some(c => c[0] === "fillText" && c[1] === "2026 OKS"));
    assert.ok(calls.some(c => c[0] === "drawImage" && c[2] === 814 && c[3] === 819 && c[4] === 192 && c[5] === 192));
    assert.ok(!calls.some(c => c[0] === "strokeRect"));
    drawMeetPoster(canvas, blocks, theme, {}, "title");
    assert.ok(calls.some(c => c[0] === "strokeRect"));
  }
});

test("PDF parser and worker are packaged locally, and achievement exports receive meet details", async () => {
  const assets = await readdir("dist/client/assets");
  assert.ok(assets.some(name => /pdf\.worker.*\.mjs/.test(name)), "Local PDF worker must ship with the site");
  const source = await readFile("app/components/CardStudio.tsx", "utf8");
  assert.match(source, /drawRaceCard/);
  assert.match(source, /drawCard\(exportCanvas, \{[^\n]+meetName, meetDate/);
  assert.match(source, /drawCard\(canvasRef.current, \{[^\n]+meetName, meetDate/);
});
