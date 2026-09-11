"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import StudioExperience from "./StudioExperience";
import CardStudio from "./CardStudio";
import MeetDayStudio from "./MeetDayStudio";
import VolunteerApp from "./VolunteerApp";
import AdminApp from "./AdminApp";

const tabs = [
  { id: "studio", label: "Achievement studio" },
  { id: "meet-day", label: "Meet Day Studio" },
  { id: "volunteers", label: "Volunteer check-in" },
  { id: "admin", label: "Volunteer admin" },
] as const;
type Tab = typeof tabs[number]["id"];

/** Floating background shapes — slow-drifting blurred circles in brand colors */
function FloatingShapes() {
  return <div className="floating-shapes" aria-hidden="true">
    <div className="shape shape-1" />
    <div className="shape shape-2" />
    <div className="shape shape-3" />
  </div>;
}

/** SVG wave that sits below the header */
function HeaderWave() {
  return <svg className="header-wave" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true">
    <path className="wave-path-1" fill="rgba(116,27,56,0.08)" d="M0,40 C200,10 400,60 600,30 C800,0 1000,50 1200,20 L1200,80 L0,80 Z" />
    <path className="wave-path-2" fill="rgba(201,150,58,0.06)" d="M0,50 C200,30 400,55 600,25 C800,45 1000,20 1200,40 L1200,80 L0,80 Z" />
  </svg>;
}

/** Hook: IntersectionObserver-based scroll reveal */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("revealed"); observer.unobserve(entry.target); } },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    el.querySelectorAll(".reveal").forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function ClubHub({ initialTab = "studio" }: { initialTab?: Tab }) {
  const [active, setActive] = useState<Tab>(initialTab);
  const [visited, setVisited] = useState<Tab[]>([initialTab]);
  const [mounted, setMounted] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const revealRef = useScrollReveal();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function readHash() {
      const tab = tabs.find(item => item.id === window.location.hash.slice(1))?.id;
      if (tab) {
        if (tab === "volunteers") window.dispatchEvent(new Event("jtsc:refresh-volunteers"));
        setActive(tab);
        setVisited(current => current.includes(tab) ? current : [...current, tab]);
      }
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  function selectTab(tab: Tab) {
    setActive(tab);
    setVisited(current => current.includes(tab) ? current : [...current, tab]);
    window.location.assign(`#${tab}`);
  }

  return <StudioExperience>
    <FloatingShapes />
    <div className="club-hub" ref={revealRef}>
      <header className="club-header" style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease" }}>
        <div className="club-identity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/jenks-trojan-logo.png" alt="Jenks Trojan" width="34" height="40" style={{ filter: "drop-shadow(0 2px 4px rgba(116,27,56,0.15))" }} />
          <div><b>JENKS TROJANS</b><span>SWIM CLUB · TEAM HUB</span></div>
        </div>
        <nav ref={navRef} role="tablist" aria-label="Club tools">
          {tabs.map((tab, index) => <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={event => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              selectTab(tabs[next].id);
              document.getElementById(`tab-${tabs[next].id}`)?.focus();
            }}
          >{tab.label}</button>)}
        </nav>
        <HeaderWave />
      </header>
      <section id="panel-studio" role="tabpanel" aria-labelledby="tab-studio" hidden={active !== "studio"}>{visited.includes("studio") && <CardStudio />}</section>
      <section id="panel-meet-day" role="tabpanel" aria-labelledby="tab-meet-day" hidden={active !== "meet-day"}>{visited.includes("meet-day") && <MeetDayStudio />}</section>
      <section id="panel-volunteers" role="tabpanel" aria-labelledby="tab-volunteers" hidden={active !== "volunteers"}>{visited.includes("volunteers") && <VolunteerApp />}</section>
      <section id="panel-admin" role="tabpanel" aria-labelledby="tab-admin" hidden={active !== "admin"}>{active === "admin" && <AdminApp />}</section>
    </div>
  </StudioExperience>;
}
