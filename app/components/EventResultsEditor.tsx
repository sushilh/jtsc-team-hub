"use client";

import { useRef, useState } from "react";
import { MAX_CARD_EVENTS, eventNameMissing, type AchievementEvent } from "../../lib/achievement-events";

export default function EventResultsEditor({ value, onChange }: { value: AchievementEvent[]; onChange: (rows: AchievementEvent[]) => void }) {
  const [removed, setRemoved] = useState<{ row: AchievementEvent; index: number } | null>(null);
  const [notice, setNotice] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  function focus(id: string) { requestAnimationFrame(() => inputs.current[id]?.focus()); }
  function edit(id: string, patch: Partial<AchievementEvent>) { onChange(value.map(row => row.id === id ? { ...row, ...patch } : row)); }
  return <fieldset className="event-results-editor" aria-describedby="event-list-help">
    <legend>Events & times</legend>
    <p id="event-list-help">List up to {MAX_CARD_EVENTS} events on this card. Times are optional. Empty rows are left out.</p>
    {value.map((row, index) => <div className="event-result-row" key={row.id}>
      <div className="event-result-heading"><b>Event {index + 1}</b><button type="button" disabled={value.length === 1} aria-label={`Remove event ${index + 1}`} onClick={() => {
        setRemoved({ row, index }); onChange(value.filter(item => item.id !== row.id));
        setNotice(`Event ${index + 1} removed. Undo is available.`);
        focus(value[index + 1]?.id || value[index - 1].id);
      }}>Remove</button></div>
      <label className="studio-field" htmlFor={`event-name-${row.id}`}><span>Event name</span><input id={`event-name-${row.id}`} ref={node => { inputs.current[row.id] = node; }} value={row.eventName} maxLength={36} placeholder="e.g. 100Y Butterfly" aria-invalid={eventNameMissing(row)} aria-describedby={eventNameMissing(row) ? `event-error-${row.id}` : undefined} onChange={e => edit(row.id, { eventName: e.target.value })} /></label>
      <label className="studio-field" htmlFor={`event-time-${row.id}`}><span>Time (optional)</span><input id={`event-time-${row.id}`} value={row.time} maxLength={16} inputMode="decimal" placeholder="e.g. 55.42 or 1:02.35" onChange={e => edit(row.id, { time: e.target.value })} /></label>
      {eventNameMissing(row) && <p className="event-error" id={`event-error-${row.id}`} role="alert">Add an event name for this time, or clear the time.</p>}
    </div>)}
    <div className="event-list-actions"><button type="button" disabled={value.length >= MAX_CARD_EVENTS} onClick={() => {
      if (value.length >= MAX_CARD_EVENTS) return;
      const id = crypto.randomUUID(); onChange([...value, { id, eventName: "", time: "" }]); setNotice("Event added."); focus(id);
    }}>+ Add event</button>
    {removed && <button type="button" disabled={value.length >= MAX_CARD_EVENTS} onClick={() => {
      if (value.length >= MAX_CARD_EVENTS) return;
      const next = [...value]; next.splice(removed.index, 0, removed.row); onChange(next); focus(removed.row.id); setRemoved(null); setNotice("Event restored.");
    }}>Undo remove</button>}</div>
    <p className="event-list-status" role="status">{value.length >= MAX_CARD_EVENTS ? "Six rows is the limit for a readable card. Remove a row to add or restore another." : notice}</p>
  </fieldset>;
}
