"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ExperienceContext = createContext({ motion: false, paused: false, toggleMotion: () => {}, notify: (_message: string) => {} });
export const useStudioExperience = () => useContext(ExperienceContext);

/** One feedback and motion owner for both studios; critical errors remain inline. */
export default function StudioExperience({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [notice, setNotice] = useState<{ message: string; id: number } | null>(null);
  const [held, setHeld] = useState(false);
  const sequence = useRef(0);
  const notify = useCallback((message: string) => {
    setNotice({ message, id: ++sequence.current });
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!notice || held) return;
    const timer = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timer);
  }, [notice, held]);
  return <ExperienceContext.Provider value={{ motion: !paused && !reduced, paused, toggleMotion: () => setPaused(value => !value), notify }}>
    <div className="studio-experience" data-motion={paused || reduced ? "paused" : "on"}>
      {children}
      <div className="studio-toast-region" aria-live="polite" aria-atomic="true">
        {notice && <div className="studio-toast" key={notice.id} onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
          <span className="toast-check" aria-hidden="true">✓</span><span>{notice.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => { setNotice(null); setHeld(false); }}>×</button>
        </div>}
      </div>
    </div>
  </ExperienceContext.Provider>;
}
