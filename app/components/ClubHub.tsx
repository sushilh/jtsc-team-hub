"use client";

import { useEffect, useState } from "react";
import CardStudio from "./CardStudio";
import VolunteerApp from "./VolunteerApp";
import AdminApp from "./AdminApp";

const tabs = [
  { id: "studio", label: "Achievement studio" },
  { id: "volunteers", label: "Volunteer check-in" },
  { id: "admin", label: "Volunteer admin" },
] as const;
type Tab = typeof tabs[number]["id"];

export default function ClubHub({ initialTab = "studio" }: { initialTab?: Tab }) {
  const [active, setActive] = useState<Tab>(initialTab);
  const [visited, setVisited] = useState<Tab[]>([initialTab]);
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

  return <div className="club-hub">
    <header className="club-header">
      <div className="club-identity">
        {/* Small local logo is already sized; no image optimization request needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jenks-trojan-logo.png" alt="Jenks Trojan" width="34" height="40" /><div><b>JENKS TROJANS</b><span>SWIM CLUB · TEAM HUB</span></div></div>
      <nav role="tablist" aria-label="Club tools">
        {tabs.map((tab, index) => <button key={tab.id} id={`tab-${tab.id}`} role="tab" aria-selected={active === tab.id} aria-controls={`panel-${tab.id}`} tabIndex={active === tab.id ? 0 : -1} onClick={() => selectTab(tab.id)} onKeyDown={event => {
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = tabs.length - 1;
          else return;
          event.preventDefault();
          selectTab(tabs[next].id);
          document.getElementById(`tab-${tabs[next].id}`)?.focus();
        }}>{tab.label}</button>)}
      </nav>
    </header>
    <section id="panel-studio" role="tabpanel" aria-labelledby="tab-studio" hidden={active !== "studio"}>{visited.includes("studio") && <CardStudio />}</section>
    <section id="panel-volunteers" role="tabpanel" aria-labelledby="tab-volunteers" hidden={active !== "volunteers"}>{visited.includes("volunteers") && <VolunteerApp />}</section>
    <section id="panel-admin" role="tabpanel" aria-labelledby="tab-admin" hidden={active !== "admin"}>{active === "admin" && <AdminApp />}</section>
  </div>;
}
