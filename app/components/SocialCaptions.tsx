"use client";

import { useId, useState } from "react";
import { createCaptions } from "../../lib/social-content.mjs";

type Platform = "instagram" | "facebook";
type Details = { name: string; headline: string; subline: string; eventName: string; time: string; meetName: string; meetDate: string };

type Props = { details: Details; captions?: never; subject?: string } | { captions: Record<Platform, string>; details?: never; subject: string };

export default function SocialCaptions(props: Props) {
  const generated = props.captions ?? createCaptions(props.details!);
  const subject = props.subject || "swimmer";
  const instance = useId();
  const [edits, setEdits] = useState<Partial<Record<Platform, string>>>({});
  const [notice, setNotice] = useState("");
  async function copy(platform: Platform) {
    try {
      await navigator.clipboard.writeText(edits[platform] ?? generated[platform]);
      setNotice(`${platform === "instagram" ? "Instagram" : "Facebook"} caption copied.`);
    } catch {
      const field = document.getElementById(`${instance}-caption-${platform}`) as HTMLTextAreaElement;
      field?.focus();
      field?.select();
      setNotice("Copy is unavailable here. The caption is selected—use your device’s Copy command.");
    }
  }
  return <section className="social-captions" aria-labelledby={`${instance}-caption-title`}>
    <div className="caption-heading"><div><span className="studio-kicker">READY TO POST</span><h2 id={`${instance}-caption-title`}>Your post, written.</h2></div><button type="button" onClick={() => { setEdits({}); setNotice(`Captions regenerated from the current ${subject} details.`); }}>Regenerate captions</button></div>
    <p>Drafts use the {subject} details above. Edit before sharing, then copy and paste alongside your downloaded image. Nothing is posted automatically.</p>
    {Object.keys(edits).length > 0 && <p className="caption-edited">Your edits are kept when card details change. Regenerate to replace them with updated drafts.</p>}
    <div className="caption-grid">{(["instagram", "facebook"] as const).map(platform => <div className="caption-card" key={platform}>
      <label htmlFor={`${instance}-caption-${platform}`}>{platform === "instagram" ? "Instagram" : "Facebook"} caption</label>
      <textarea id={`${instance}-caption-${platform}`} value={edits[platform] ?? generated[platform]} maxLength={platform === "instagram" ? 2200 : 5000} rows={9} onChange={event => { setEdits(current => ({ ...current, [platform]: event.target.value })); setNotice(""); }} />
      <div className="caption-actions"><span>{(edits[platform] ?? generated[platform]).length} characters</span><button type="button" onClick={() => copy(platform)}>Copy caption</button></div>
    </div>)}</div>
    <p role="status" className="caption-status">{notice}</p>
  </section>;
}
