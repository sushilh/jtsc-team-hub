"use client";

import AutoGrowTextarea from "./AutoGrowTextarea";
import { useState, type ChangeEvent } from "react";
import { parseMeetBook, readMeetBook, type BookDraft, type BookSession } from "../../lib/meet-book";

export default function MeetBookImport({ onImport }: { onImport: (sessions: BookSession[], events: string[]) => void }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<BookDraft>({ sessions: [], events: [] });
  const [sessions, setSessions] = useState<number[]>([]);
  const [events, setEvents] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  function extract(value: string) {
    const result = parseMeetBook(value); setDraft(result); setSessions(result.sessions.slice(0, 7).map((_, i) => i)); setEvents([]); setStale(false);
    setNotice(`${result.sessions.length} possible sessions and ${result.events.length} events found. These are drafts—check dates, AM/PM, age groups, and times against the book. Missing values stay blank.`);
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setBusy(true); setNotice("Reading your meet book on this device…");
    try { const value = await readMeetBook(file, setNotice); setText(value); extract(value); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not read this meet book. Try a text-searchable PDF or paste the schedule."); }
    finally { setBusy(false); }
  }
  return <details className="meet-book"><summary>Start from a meet book · PDF or text</summary>
    <p>Upload your meet book to extract a starting schedule. Review the suggestions before replacing the sample. No file leaves this device. PDF/text only, up to 15 MB and 60 PDF pages.</p>
    <label>Upload meet book<input type="file" accept="application/pdf,text/plain,.pdf,.txt" onChange={upload} disabled={busy} /></label>
    <label>Or paste / correct the schedule text<AutoGrowTextarea rows={6} maxLength={200000} value={text} placeholder={"July 23, 2026\nSession 1 – Timed Finals\n11 & Over\nWarm-up: 3:00–4:35 PM\nMeet starts: 5:00 PM\nEvent 1 Girls 11 & Over 1500 Freestyle"} onChange={e => { setText(e.target.value); setStale(true); }} /></label>
    <div className="meet-add"><button disabled={busy || !text.trim()} onClick={() => extract(text)}>{busy ? "Reading…" : "Find sessions & events"}</button></div>
    <p role="status">{notice}</p>
    {(draft.sessions.length > 0 || draft.events.length > 0) && <><div className="book-review">
      <section><h2>Sessions · choose up to 7</h2>{draft.sessions.map((session, index) => <div className="book-option" key={index}>
        <input type="checkbox" aria-label={`Include ${session.title}`} checked={sessions.includes(index)} disabled={!sessions.includes(index) && sessions.length >= 7} onChange={e => setSessions(current => e.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter(i => i !== index))} />
        <div><b>{session.title}</b><small>{[session.date, session.ageGroup].filter(Boolean).join(" · ") || "Date / age group not found"}</small><small>Warm-up: {session.warmup || "Not found"} · Start: {session.start || "Not found"}</small><details><summary>Source text</summary><p>{session.source}</p></details></div>
      </div>)}</section>
      <section><h2>Events · choose up to 8</h2><p>Selected events become a separate editable block. For a full event program, use the original meet book.</p>{draft.events.map((event, index) => <label className="book-option" key={index}><input type="checkbox" checked={events.includes(index)} disabled={!events.includes(index) && events.length >= 8} onChange={e => setEvents(current => e.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter(i => i !== index))} /><span>{event}</span></label>)}</section>
    </div>
    <p>{stale ? "The source text changed. Find sessions & events again before importing." : "Import replaces the current session blocks (Undo layout can restore them). You can edit every imported field in the sidebar."}</p>
    <button className="meet-primary" disabled={busy || stale || (!sessions.length && !events.length)} onClick={() => { onImport(sessions.map(i => draft.sessions[i]), events.map(i => draft.events[i])); setNotice("Reviewed draft added to the poster. Select each session to correct any missing details before downloading."); }}>Use selected draft on poster</button></>}
  </details>;
}
