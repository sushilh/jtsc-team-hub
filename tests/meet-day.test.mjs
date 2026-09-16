import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { resolve } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { formatMeetDate, meetDetails, createCaptions } from "../lib/social-content.mjs";
import { normalizeCardEvents } from "../lib/social-content.mjs";

async function moduleFrom(entry) {
  const result = await build({ entryPoints: [resolve(entry)], bundle: true, write: false, format: "esm", platform: "browser", external: ["pdfjs-dist"] });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const model = await moduleFrom("lib/meet-day.ts");
const { multiEventLayout, eventNameMissing, MAX_CARD_EVENTS } = await moduleFrom("lib/achievement-events.ts");
const { drawMultiEventCard } = await moduleFrom("lib/multi-event-card.ts");
const { drawFinishLineCard, finishLineLayout } = await moduleFrom("lib/finish-line-card.ts");

test("multi-event captions preserve order, optional times, and legacy single-event input", () => {
  const events = [{ eventName: " 50Y Free ", time: " 24.31 " }, { eventName: "100Y Breast", time: "1:02.35" }, { eventName: "200Y IM", time: "" }, { eventName: " ", time: "" }];
  assert.equal(normalizeCardEvents(events).length, 3);
  const captions = createCaptions({ name: "Lily Nitzel", headline: "STATE QUALIFIER", events });
  for (const caption of Object.values(captions)) {
    assert.ok(caption.includes("50Y Free · 24.31\n100Y Breast · 1:02.35\n200Y IM"));
    assert.ok(!caption.includes("undefined"));
  }
  assert.deepEqual(createCaptions({ eventName: "50Y Free", time: "24.31" }), createCaptions({ events: [events[0]] }));
  assert.equal(eventNameMissing({ eventName: "", time: "24.31" }), true);
  assert.equal(eventNameMissing({ eventName: "50Y Free", time: "" }), false);
});

test("all multi-event templates draw every result within both output sizes", () => {
  for (const height of [1080, 1350]) for (let count = 2; count <= MAX_CARD_EVENTS; count++) for (const template of ["classic", "signature", "race"]) {
    const layout = multiEventLayout(height, count);
    assert.ok(layout.photoBottom - layout.photoTop >= 400);
    assert.ok(layout.rowsTop + count * layout.rowHeight < height - 83);
    const calls = [];
    const ctx = new Proxy({ measureText: value => ({ width: value.length * 14 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o,p) => p in o ? o[p] : (...args) => calls.push([p,...args]), set: (o,p,v) => {o[p]=v;return true;} });
    const events = Array.from({length:count},(_,i) => ({eventName:`EVENT ${i+1}`,time:`1:0${i}.35`}));
    drawMultiEventCard(ctx,1080,height,{name:"Avery Thompson",classYear:"Class of 2027",headline:"STATE QUALIFIER",subline:"STATE CHAMPIONSHIPS",meetName:"Winter Meet",meetDate:"2026-12-12",template,events,image:null,brandMark:null,zoom:1,horizontalPosition:0,verticalPosition:0});
    for (const event of events) for (const text of [event.eventName,event.time]) assert.equal(calls.filter(c=>c[0]==="fillText"&&c[1]===text).length,1);
    for (const c of calls.filter(c=>c[0]==="fillText")) assert.ok(c[3]>0&&c[3]<height);
  }
});

test("Finish Line template keeps one to six results inside both export sizes", () => {
  for (const height of [1080, 1350]) for (let count = 1; count <= MAX_CARD_EVENTS; count++) {
    const layout = finishLineLayout(height, count);
    assert.ok(layout.photoBottom < layout.detailsTop);
    assert.ok(layout.rowsTop + count * layout.rowHeight < layout.footerTop);
    const calls = [];
    const ctx = new Proxy({ measureText: value => ({ width: value.length * 14 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o,p) => p in o ? o[p] : (...args) => calls.push([p,...args]), set: (o,p,v) => {o[p]=v;return true;} });
    const events = Array.from({length:count},(_,i) => ({eventName:`EVENT ${i+1}`,time:`1:0${i}.35`}));
    drawFinishLineCard(ctx,1080,height,{name:"Avery Thompson",classYear:"Class of 2027",headline:"BROKE TEAM RECORD",subline:"OKLAHOMA STATE CHAMPIONSHIPS",meetName:"Winter Meet",meetDate:"2026-12-12",events,image:null,brandMark:null,zoom:1,horizontalPosition:0,verticalPosition:0});
    for (const event of events) for (const text of [event.eventName,event.time]) assert.equal(calls.filter(c=>c[0]==="fillText"&&c[1]===text).length,1);
    for (const call of calls.filter(c=>c[0]==="fillText")) assert.ok(call[3] > -1 && call[3] < height);
  }
});
const { parseMeetBook, readMeetBook } = await moduleFrom("lib/meet-book.ts");
const { drawMeetPoster } = await moduleFrom("lib/meet-renderer.ts");
const { createMeetCaptions, meetExportSize, fitMeetPoster } = await moduleFrom("lib/meet-social.ts");
const { normalizeHex, resolveMeetTheme, colorContrast } = await moduleFrom("lib/meet-colors.ts");

test("custom global colors normalize safely and reset to the original preset", () => {
  assert.equal(normalizeHex(" #AbC "), "#aabbcc");
  assert.equal(normalizeHex("006B5E"), "#006b5e");
  assert.equal(normalizeHex("#12"), null);
  assert.equal(normalizeHex("nothex"), null);
  for (const id of Object.keys(model.meetThemes)) {
    const reset = resolveMeetTheme(id, null);
    for (const key of ["primary", "dark", "paper", "ink", "accent"]) assert.equal(reset[key], model.meetThemes[id][key]);
    assert.equal(resolveMeetTheme(id, "#006B5E").primary, "#006b5e");
    assert.equal(resolveMeetTheme(id, "bad input").primary, model.meetThemes[id].primary);
  }
});

test("custom light and dark primary colors retain contrasting theme text", () => {
  for (const value of ["#ffffff", "#ffff00", "#00ff00", "#006b5e", "#000000", "#777777"]) {
    const theme = resolveMeetTheme("trojan", value);
    assert.ok(colorContrast(theme.primary, theme.onPrimary) >= 4.5);
    assert.ok(colorContrast(theme.primary, theme.accentOnPrimary) >= 4.5);
    assert.ok(colorContrast(theme.paper, theme.primaryText) >= 4.5);
  }
});

test("global color reaches preview and exports without changing QR images or block overrides", () => {
  for (const size of [{ width: 1080, height: 1620 }, { width: 2160, height: 2700 }]) {
    const styles = [], calls = [];
    const ctx = new Proxy({}, { get: (o, p) => p in o ? o[p] : (...args) => calls.push([p, ...args]), set: (o, p, v) => { o[p] = v; if (p === "fillStyle") styles.push(v); return true; } });
    const canvas = { getContext: () => ctx };
    const image = { naturalWidth: 240, naturalHeight: 240 };
    const blocks = model.initialMeetBlocks().map(b => b.id === "title" ? { ...b, color: "#ff00ff" } : b);
    drawMeetPoster(canvas, blocks, "trojan", { qr: image }, undefined, size, "#006b5e");
    assert.ok(styles.includes("#006b5e"));
    assert.ok(!styles.includes(model.meetThemes.trojan.primary));
    assert.ok(styles.includes("#ff00ff"));
    assert.ok(styles.includes("#ffffff"));
    assert.ok(calls.some(c => c[0] === "drawImage" && c[1] === image));
  }
});

test("social exports fit every poster edge and render directly at high resolution", () => {
  for (const [format, baseHeight] of [["instagram", 1350], ["facebook", 1080], ["poster", 1620]]) {
    for (const quality of [1, 2]) {
      const size = meetExportSize(format, quality);
      assert.deepEqual(size, { width: 1080 * quality, height: baseHeight * quality });
      const fit = fitMeetPoster(size.width, size.height);
      assert.ok(fit.x >= 0 && fit.y >= 0);
      assert.ok(fit.x + 1080 * fit.scale <= size.width + .001);
      assert.ok(fit.y + 1620 * fit.scale <= size.height + .001);
      const calls = [];
      const ctx = new Proxy({}, { get: (o, p) => p in o ? o[p] : (...args) => calls.push([p, ...args]), set: (o, p, v) => { o[p] = v; return true; } });
      const canvas = { getContext: () => ctx };
      drawMeetPoster(canvas, model.initialMeetBlocks(), "trojan", {}, undefined, size);
      assert.equal(canvas.width, size.width); assert.equal(canvas.height, size.height);
      assert.ok(calls.some(c => c[0] === "scale" && c[1] === fit.scale && c[2] === fit.scale));
      assert.ok(calls.some(c => c[0] === "fillText" && c[1] === "2026 OKS"));
      assert.ok(!calls.some(c => c[0] === "strokeRect"));
    }
  }
});

test("meet captions follow edited visible blocks and omit removed sessions and unavailable QR", () => {
  const blocks = model.initialMeetBlocks().map(b => b.id === "title" ? { ...b, text: "Fall Invitational" } : b.id === "session-0" ? { ...b, text: "Updated final", start: "6:15 PM" } : b.kind === "session" ? { ...b, hidden: true } : b);
  const captions = createMeetCaptions(blocks, false);
  for (const value of Object.values(captions)) {
    assert.match(value, /Fall Invitational/);
    assert.match(value, /Updated final/);
    assert.match(value, /6:15 PM/);
    assert.doesNotMatch(value, /PRELIMS|9:00 AM|Scan the QR/);
  }
  assert.match(createMeetCaptions(blocks, true).instagram, /Scan the QR code/);
  const lengthy = blocks.map(b => b.kind === "text" ? { ...b, text: "Long meet information ".repeat(100) } : b);
  assert.ok(createMeetCaptions(lengthy, true).instagram.length <= 2200);
  assert.ok(createMeetCaptions(lengthy, true).facebook.length <= 5000);
  assert.match(createMeetCaptions(lengthy, true).instagram, /See the full schedule/);
});

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

test("session presets stay inside the poster and keep the livestream panel clear", () => {
  const W = model.POSTER_WIDTH, H = model.POSTER_HEIGHT;
  const overlaps = (a, b) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  for (const preset of model.meetLayouts) {
    const blocks = model.initialMeetBlocks(preset.sessions);
    const sessions = blocks.filter(b => b.kind === "session");
    assert.equal(sessions.length, preset.sessions, `${preset.id} session count`);

    // Nothing may fall off the poster.
    for (const b of blocks) {
      assert.ok(b.x >= 0 && b.y >= 0, `${preset.id}/${b.id} inside top-left`);
      assert.ok(b.x + b.w <= W, `${preset.id}/${b.id} within width`);
      assert.ok(b.y + b.h <= H, `${preset.id}/${b.id} within height`);
    }

    // Sessions must not collide with each other, the panel, or the footer.
    const panel = blocks.find(b => b.id === "qr-panel");
    const footer = blocks.find(b => b.id === "footer");
    const code = blocks.find(b => b.id === "qr");
    sessions.forEach((s1, i) => {
      assert.ok(!overlaps(s1, panel), `${preset.id}/session-${i} clear of the panel`);
      assert.ok(!overlaps(s1, footer), `${preset.id}/session-${i} clear of the footer`);
      sessions.slice(i + 1).forEach((s2, j) => {
        assert.ok(!overlaps(s1, s2), `${preset.id}/session-${i} clear of session-${i + j + 1}`);
      });
    });

    // The QR code has to stay square and sit within its panel.
    assert.equal(code.w, code.h, `${preset.id} QR stays square`);
    assert.ok(code.x >= panel.x && code.x + code.w <= panel.x + panel.w, `${preset.id} QR within panel width`);
    assert.ok(code.y >= panel.y && code.y + code.h <= panel.y + panel.h, `${preset.id} QR within panel height`);
    assert.ok(code.w >= 120, `${preset.id} QR still scannable at ${code.w}px`);
  }
});
