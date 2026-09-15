"use client";

import AutoGrowTextarea from "./AutoGrowTextarea";

import { useEffect, useRef, useState, type PointerEvent, type ChangeEvent } from "react";
import { initialMeetBlocks, clampBlock, hitTest, meetThemes, meetLayouts, POSTER_WIDTH, POSTER_HEIGHT, type MeetBlock, type ThemeId, type MeetLayoutId } from "../../lib/meet-day";
import { drawMeetPoster } from "../../lib/meet-renderer";
import MeetBookImport from "./MeetBookImport";
import type { BookSession } from "../../lib/meet-book";
import SocialCaptions from "./SocialCaptions";
import { createMeetCaptions, meetExportFormats, meetExportSize, type MeetExportFormat } from "../../lib/meet-social";
import { normalizeHex, resolveMeetTheme } from "../../lib/meet-colors";

export default function MeetDayStudio() {
  const [blocks, setBlocks] = useState<MeetBlock[]>(initialMeetBlocks);
  const [selectedId, setSelectedId] = useState("title");
  const [theme, setTheme] = useState<ThemeId>("trojan");
  const [layout, setLayout] = useState<MeetLayoutId>("championship");
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [hexInput, setHexInput] = useState(meetThemes.trojan.primary);
  const activeTheme = resolveMeetTheme(theme, customColor);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const [past, setPast] = useState<MeetBlock[][]>([]);
  const [future, setFuture] = useState<MeetBlock[][]>([]);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<MeetExportFormat>("instagram");
  const [quality, setQuality] = useState<1 | 2>(2);
  const exportPreview = useRef<HTMLCanvasElement>(null);
  const exportSize = meetExportSize(exportFormat, quality);
  const canvas = useRef<HTMLCanvasElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; bx: number; by: number } | null>(null);
  const selected = blocks.find(b => b.id === selectedId);

  useEffect(() => {
    const logo = new Image();
    logo.onload = () => setImages(current => ({ ...current, logo }));
    logo.src = "/jenks-trojan-logo.png";
    return () => { logo.onload = null; };
  }, []);
  useEffect(() => {
    if (canvas.current) drawMeetPoster(canvas.current, blocks, theme, images, selectedId, undefined, customColor);
  }, [blocks, theme, images, selectedId, customColor]);
  useEffect(() => {
    let active = true;
    const draw = () => {
      if (active && exportPreview.current) drawMeetPoster(exportPreview.current, blocks, theme, images, undefined, meetExportSize(exportFormat, 1), customColor);
    };
    draw();
    void document.fonts.ready.then(draw);
    return () => { active = false; };
  }, [blocks, theme, images, exportFormat, customColor]);

  function checkpoint() { setPast(current => [...current.slice(-39), blocks]); setFuture([]); }
  function update(id: string, patch: Partial<MeetBlock>, remember = true) {
    if (remember) checkpoint();
    setBlocks(current => current.map(b => b.id === id ? clampBlock({ ...b, ...patch }) : b));
  }
  function applyLayout(id: MeetLayoutId) {
    const preset = meetLayouts.find(item => item.id === id);
    if (!preset || id === layout) return;
    checkpoint();
    setBlocks(initialMeetBlocks(preset.sessions));
    setLayout(id);
    setSelectedId("title");
    setNotice(`${preset.label} layout applied. Undo layout restores your previous poster.`);
  }
  function undo() { if (!past.length) return; setFuture(current => [blocks, ...current]); setBlocks(past[past.length - 1]); setPast(current => current.slice(0, -1)); }
  function redo() { if (!future.length) return; setPast(current => [...current, blocks]); setBlocks(future[0]); setFuture(current => current.slice(1)); }
  function point(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left) * POSTER_WIDTH / box.width, y: (event.clientY - box.top) * POSTER_HEIGHT / box.height };
  }
  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    const p = point(event); const block = hitTest(blocks, p.x, p.y);
    if (!block) return;
    setSelectedId(block.id); checkpoint();
    drag.current = { id: block.id, x: p.x, y: p.y, bx: block.x, by: block.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  }
  function moveDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const p = point(event), d = drag.current;
    update(d.id, { x: Math.round(d.bx + p.x - d.x), y: Math.round(d.by + p.y - d.y) }, false);
  }
  function add(kind: MeetBlock["kind"]) {
    const id = crypto.randomUUID();
    const block: MeetBlock = { id, label: kind === "session" ? "New session" : kind === "qr" ? "QR code" : kind === "image" ? "Image" : "Text", kind, x: 50, y: 610, w: kind === "session" ? 708 : kind === "text" ? 600 : 240, h: kind === "session" ? 112 : kind === "text" ? 70 : 240, fontSize: kind === "text" ? 32 : 20, tone: "ink", text: kind === "session" ? "NEW SESSION" : "YOUR TEXT", day: "", date: "", ageGroup: "", warmup: "", start: "", warmupLabel: "WARM-UP", startLabel: "MEET STARTS", fit: "contain" };
    checkpoint(); setBlocks(current => [...current, block]); setSelectedId(id);
  }
  function importBook(sessions: BookSession[], events: string[]) {
    const eventHeight = events.length ? 42 + events.length * 27 : 0;
    const step = Math.min(122, (862 - eventHeight - (events.length ? 16 : 0)) / Math.max(1, sessions.length));
    const imported: MeetBlock[] = sessions.map((s, index) => ({ id: crypto.randomUUID(), label: s.title, kind: "session", text: s.title, date: s.date, day: s.day, ageGroup: s.ageGroup, warmup: s.warmup, start: s.start, warmupLabel: "WARM-UP", startLabel: "START", x: 36, y: 596 + index * step, w: 708, h: step - 7, fontSize: 20 }));
    if (events.length) imported.push({ id: crypto.randomUUID(), label: "Imported events", kind: "text", text: ["EVENTS", ...events].join("\n"), x: 36, y: 596 + sessions.length * step + 8, w: 708, h: eventHeight, fontSize: 22, tone: "ink" });
    checkpoint(); setBlocks(current => [...current.filter(b => b.kind !== "session" && b.label !== "Imported events"), ...imported]);
    setSelectedId(imported[0]?.id || "title"); setNotice("Meet-book draft imported. Review every field before sharing. Undo layout restores the previous schedule.");
  }
  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0], id = selectedId;
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { setNotice("Choose a JPG, PNG, or WebP image under 15 MB."); return; }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      setImages(current => ({ ...current, [id]: image }));
      setNotice("Image loaded. QR codes keep a white border and are never stretched. Test the exported QR with your phone before sharing.");
    } catch { setNotice("This image could not be opened. Try a PNG or JPG."); }
    finally { URL.revokeObjectURL(url); }
  }
  async function download() {
    if (blocks.some(b => b.kind === "qr" && !b.hidden && !images[b.id])) { setNotice("Upload a QR image, or hide/delete the empty QR block before downloading."); return; }
    setExporting(true); setNotice("");
    try {
      await document.fonts.ready;
      const output = document.createElement("canvas"); drawMeetPoster(output, blocks, theme, images, undefined, exportSize, customColor);
      const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, "image/png"));
      if (!blob) throw new Error();
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `jtsc-meet-day-${exportFormat}-${theme}-${exportSize.width}x${exportSize.height}.png`; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice(`${meetExportFormats[exportFormat].label} PNG prepared at ${exportSize.width} × ${exportSize.height}. Copy the caption below and upload both in your social app. Scan the exported QR before sharing.`);
    } catch { setNotice("Could not download the poster. Please try again."); }
    finally { setExporting(false); }
  }

  return <main className="meet-studio">
    <header className="meet-heading"><div><span>02 / MEET COMMUNICATIONS</span><h1>Meet Day Studio</h1><p>Edit sessions, times and meet details. Select any component to move it on the poster.</p></div><a className="meet-download-link" href="#meet-download">Download & captions ↓</a></header>
    <div className="meet-toolbar"><div className="meet-themes" role="group" aria-label="Poster color theme">{Object.entries(meetThemes).map(([id, value]) => <button key={id} aria-pressed={!customColor && theme === id} onClick={() => { setTheme(id as ThemeId); setCustomColor(null); setHexInput(value.primary); }}><i style={{ background: value.primary, borderColor: value.accent }} />{value.label}</button>)}</div><div className="meet-layouts" role="group" aria-label="Poster session layout">{meetLayouts.map(item => <button key={item.id} aria-pressed={layout === item.id} className={layout === item.id ? "active" : ""} onClick={() => applyLayout(item.id)}><b>{item.label}</b><small>{item.detail}</small></button>)}</div><div><button onClick={undo} disabled={!past.length}>Undo layout</button><button onClick={redo} disabled={!future.length}>Redo layout</button></div></div>
    <p className="meet-status" role="status">{notice || "Sample July 2026 schedule — replace with your meet details. Photos and edits stay in this browser tab."}</p>
    <div className="meet-workspace">
      <aside className="meet-inspector">
    <section className="meet-global-color" aria-labelledby="global-color-title">
      <div><h2 id="global-color-title">Global primary color</h2><p>Change all theme-colored areas, including the exported PNG.</p></div>
      <div className="global-color-controls">
        <label>Color<input type="color" aria-label="Global primary color" value={activeTheme.primary} onChange={e => { setCustomColor(e.target.value); setHexInput(e.target.value); }} /></label>
        <label>Hex color<input value={hexInput} maxLength={7} spellCheck={false} autoComplete="off" aria-invalid={!normalizeHex(hexInput)} aria-describedby="global-color-help" onChange={e => { setHexInput(e.target.value); const color = normalizeHex(e.target.value); if (color) setCustomColor(color); }} onBlur={() => { const color = normalizeHex(hexInput); if (color) setHexInput(color); }} /></label>
        <button onClick={() => { setCustomColor(null); setHexInput(meetThemes[theme].primary); }}>Reset to theme</button>
      </div>
      <p id="global-color-help">{normalizeHex(hexInput) ? "Photos, logos, QR images, and individual block-color overrides stay unchanged. Choosing a preset resets the global color." : "Enter a valid hex color, such as #006B5E or #ABC. The last valid color is still applied."}</p>
    </section>
        <MeetBookImport onImport={importBook} />
        <section><h2>Poster components</h2><div className="meet-add"><button onClick={() => add("session")}>+ Session</button><button onClick={() => add("text")}>+ Text</button><button onClick={() => add("image")}>+ Image</button><button onClick={() => add("qr")}>+ QR</button></div>
          <label>Choose a component<select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{blocks.map(b => <option key={b.id} value={b.id}>{b.label}{b.hidden ? " (hidden)" : ""}</option>)}</select></label>
        </section>
        {selected && <section className="meet-properties"><h2>Edit {selected.label}</h2>
          <label>Component name<input value={selected.label} maxLength={60} onChange={e => update(selected.id, { label: e.target.value })} /></label>
          {(selected.kind === "text" || selected.kind === "session") && <label>{selected.kind === "session" ? "Session / event name" : "Text (line breaks supported)"}<AutoGrowTextarea value={selected.text || ""} maxLength={1000} rows={3} onChange={e => update(selected.id, { text: e.target.value })} /></label>}
          {selected.kind === "session" && <>
            <div className="meet-fields"><label>Day label<input value={selected.day || ""} onChange={e => update(selected.id, { day: e.target.value })} /></label><label>Date<input type="date" value={selected.date || ""} onChange={e => update(selected.id, { date: e.target.value })} /></label></div>
            <label>Age group<input value={selected.ageGroup || ""} onChange={e => update(selected.id, { ageGroup: e.target.value })} /></label>
            <label>Warm-up time / range<input placeholder="7:20–7:50 AM" value={selected.warmup || ""} onChange={e => update(selected.id, { warmup: e.target.value })} /></label>
            <label>Session start time<input placeholder="9:00 AM" value={selected.start || ""} onChange={e => update(selected.id, { start: e.target.value })} /></label>
            <div className="meet-fields"><label>Warm-up label<input value={selected.warmupLabel || ""} onChange={e => update(selected.id, { warmupLabel: e.target.value })} /></label><label>Start label<input value={selected.startLabel || ""} onChange={e => update(selected.id, { startLabel: e.target.value })} /></label></div>
          </>}
          {(selected.kind === "image" || selected.kind === "qr") && <><input ref={upload} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} /><button className="meet-primary" onClick={() => upload.current?.click()}>{images[selected.id] ? "Replace" : "Upload"} {selected.kind === "qr" ? "QR image" : "image"}</button><small>PNG, JPG, WebP · up to 15 MB. {selected.kind === "qr" ? "Use the original QR image, not a screenshot of the poster." : "Upload your pool photo or club logo."}</small>
            {selected.kind === "image" && <><label>Photo fit<select value={selected.fit || "contain"} onChange={e => update(selected.id, { fit: e.target.value as "contain" | "cover" })}><option value="contain">Fit entire image</option><option value="cover">Fill / crop</option></select></label><label>Opacity<input type="range" min="0.1" max="1" step="0.05" value={selected.opacity ?? 1} onChange={e => update(selected.id, { opacity: Number(e.target.value) })} /></label></>}
          </>}
          <div className="meet-fields">{(["x", "y", "w", "h"] as const).map(key => <label key={key}>{({ x: "Left", y: "Top", w: "Width", h: "Height" })[key]}<input type="number" value={Math.round(selected[key])} disabled={key === "h" && selected.kind === "qr"} onChange={e => update(selected.id, { [key]: Number(e.target.value) })} /></label>)}</div>
          {(selected.kind === "text" || selected.kind === "session") && <><label>Font size<input type="range" min="12" max="160" value={selected.fontSize} onChange={e => update(selected.id, { fontSize: Number(e.target.value) })} /></label><label>Text color<input type="color" value={selected.color || (selected.tone === "ink" || selected.kind === "session" ? activeTheme.ink : selected.tone === "accent" ? activeTheme.accent : "#ffffff")} onChange={e => update(selected.id, { color: e.target.value })} /></label></>}
          {selected.kind === "text" && <label>Alignment<select value={selected.align || "left"} onChange={e => update(selected.id, { align: e.target.value as MeetBlock["align"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>}
          {selected.kind !== "qr" && <><label>Block background<input type="color" value={selected.background || activeTheme.primary} onChange={e => update(selected.id, { background: e.target.value })} /></label><button onClick={() => update(selected.id, { color: undefined, background: undefined })}>Use theme colors</button></>}
          <div className="meet-add"><button onClick={() => update(selected.id, { hidden: !selected.hidden })}>{selected.hidden ? "Show" : "Hide"}</button><button onClick={() => { checkpoint(); setBlocks(current => [...current.filter(b => b.id !== selected.id), selected]); }}>Bring to front</button><button onClick={() => { checkpoint(); setBlocks(current => [selected, ...current.filter(b => b.id !== selected.id)]); }}>Send to back</button><button onClick={() => { const id = crypto.randomUUID(); checkpoint(); setBlocks(current => [...current, clampBlock({ ...selected, id, label: `${selected.label} copy`, x: selected.x + 24, y: selected.y + 24 })]); if (images[selected.id]) setImages(current => ({ ...current, [id]: current[selected.id] })); setSelectedId(id); }}>Duplicate</button><button onClick={() => { checkpoint(); setBlocks(current => current.filter(b => b.id !== selected.id)); setSelectedId(blocks.find(b => b.id !== selected.id)?.id || ""); }}>Delete</button></div>
        </section>}
      </aside>
      <section className="meet-preview" aria-label="Editable meet poster"><div className="meet-canvas-label"><span>1080 × 1620 · PNG</span><span>Drag to move · Arrow keys to nudge</span></div>
        <canvas ref={canvas} tabIndex={0} aria-label="Meet poster editor. Choose a component in the sidebar, then use arrow keys to move it. Shift moves ten pixels." onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => { if (!selected || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return; e.preventDefault(); const step = e.shiftKey ? 10 : 1; update(selected.id, { x: selected.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0), y: selected.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) }); }} />
        <p>Selection outlines are not included in the download. The QR block stays square with a white margin for scanning. Changes survive switching tabs, but not reloading this page.</p>
      </section>
    </div>
    <section id="meet-download" className="meet-publish" aria-labelledby="meet-publish-title">
      <div><span className="studio-kicker">EXPORT / PNG</span><h2 id="meet-publish-title">Download your post</h2>
        <p>Download the PNG, then copy your caption below and upload it in Instagram or Facebook. The full poster fits inside the selected shape with matching side margins—nothing is cropped.</p>
        <div className="meet-fields"><label>Image format<select value={exportFormat} onChange={e => setExportFormat(e.target.value as MeetExportFormat)}>{Object.entries(meetExportFormats).map(([id, format]) => <option key={id} value={id}>{format.label} · {format.width === format.height ? "1:1" : id === "instagram" ? "4:5" : "2:3"}</option>)}</select></label>
        <label>Resolution<select value={quality} onChange={e => setQuality(Number(e.target.value) as 1 | 2)}><option value={2}>High quality · 2×</option><option value={1}>Standard · 1080px wide</option></select></label></div>
        <p><b>{exportSize.width} × {exportSize.height} pixels · lossless PNG</b><br />Text is drawn at the chosen resolution. Use clear original photos and QR images for the best result.</p>
        <button className="meet-primary" onClick={download} disabled={exporting}>{exporting ? "Preparing…" : `Download ${meetExportFormats[exportFormat].label} PNG`}</button>
        <p role="status">{notice}</p>
      </div>
      <div className="meet-export-thumbnail"><span>EXPORT PREVIEW</span><canvas ref={exportPreview} aria-label="Preview of the complete social image without editing handles" /></div>
    </section>
    <SocialCaptions subject="meet" captions={createMeetCaptions(blocks, blocks.some(b => b.kind === "qr" && !b.hidden && Boolean(images[b.id])))} />
  </main>;
}
