"use client";

import { useEffect } from "react";

/**
 * Depth effects for the parent guide.
 *
 * The guide itself is a server component, so this mounts alongside it and selects
 * existing classes rather than requiring markup changes. Everything is additive:
 * if this never runs, the guide renders exactly as before.
 */

/** Blocks that rise into place as they scroll in. Order sets the stagger. */
const RISE_SELECTORS = [
  ".guide-facts > div",
  ".guide-section-heading",
  ".guide-card",
  ".guide-focus-grid > *",
  ".guide-callout",
  ".guide-info-band",
  ".guide-terms > *",
  ".guide-abbreviations",
  ".guide-example",
  ".guide-meet-summary",
  ".season-row",
].join(",");

/** Surfaces that tilt toward the pointer. */
const TILT_SELECTOR = ".guide-card, .guide-facts > div, .guide-example, .guide-contact-card";

const MAX_TILT_DEGREES = 6;

export default function GuideMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".parent-guide");
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // The guide can render inside the hub (which owns the pause control) or standalone.
    const motionHost = root.closest<HTMLElement>("[data-motion]");
    const paused = () => motionHost?.dataset.motion === "paused" || reduced.matches;

    let cleanups: Array<() => void> = [];

    function teardown() {
      for (const fn of cleanups) fn();
      cleanups = [];
      root?.classList.remove("guide-motion-on");
      root?.querySelectorAll<HTMLElement>(".guide-rise").forEach((el) => {
        el.classList.remove("guide-rise", "in-view");
      });
      root?.querySelectorAll<HTMLElement>(".guide-tilt").forEach((el) => {
        el.classList.remove("guide-tilt");
        el.style.removeProperty("--tilt-x");
        el.style.removeProperty("--tilt-y");
        el.style.removeProperty("--glare-x");
        el.style.removeProperty("--glare-y");
      });
    }

    function setup() {
      if (!root || paused()) return;
      root.classList.add("guide-motion-on");

      // Scroll-driven depth. Each block starts pushed back and rotated, then settles.
      const rising = [...root.querySelectorAll<HTMLElement>(RISE_SELECTORS)];
      rising.forEach((el) => el.classList.add("guide-rise"));
      const observer = new IntersectionObserver((entries) => {
        // Stagger within a batch so a row of cards cascades instead of snapping together.
        let index = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.setProperty("--rise-delay", `${Math.min(index, 5) * 70}ms`);
          el.classList.add("in-view");
          observer.unobserve(el);
          index += 1;
        }
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      rising.forEach((el) => observer.observe(el));
      cleanups.push(() => observer.disconnect());

      // Pointer tilt. Mouse only: on touch this would fight the scroll.
      const tilting = [...root.querySelectorAll<HTMLElement>(TILT_SELECTOR)];
      for (const card of tilting) {
        card.classList.add("guide-tilt");
        const onMove = (event: PointerEvent) => {
          if (event.pointerType !== "mouse") return;
          const box = card.getBoundingClientRect();
          const px = (event.clientX - box.left) / box.width;
          const py = (event.clientY - box.top) / box.height;
          card.style.setProperty("--tilt-y", `${(px - 0.5) * 2 * MAX_TILT_DEGREES}deg`);
          card.style.setProperty("--tilt-x", `${(0.5 - py) * 2 * MAX_TILT_DEGREES}deg`);
          card.style.setProperty("--glare-x", `${px * 100}%`);
          card.style.setProperty("--glare-y", `${py * 100}%`);
        };
        const onLeave = () => {
          card.style.setProperty("--tilt-x", "0deg");
          card.style.setProperty("--tilt-y", "0deg");
        };
        card.addEventListener("pointermove", onMove);
        card.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          card.removeEventListener("pointermove", onMove);
          card.removeEventListener("pointerleave", onLeave);
        });
      }

      // Hero depth: the title and its backdrop separate slightly as the page scrolls.
      const hero = root.querySelector<HTMLElement>(".guide-hero");
      if (hero) {
        let frame = 0;
        const onScroll = () => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            const progress = Math.min(1, Math.max(0, window.scrollY / 520));
            hero.style.setProperty("--hero-depth", String(progress));
          });
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        cleanups.push(() => {
          window.removeEventListener("scroll", onScroll);
          if (frame) cancelAnimationFrame(frame);
          hero.style.removeProperty("--hero-depth");
        });
      }
    }

    setup();

    // Follow the pause control and the OS setting without needing a reload.
    const react = () => { teardown(); setup(); };
    reduced.addEventListener("change", react);
    const motionWatcher = motionHost
      ? new MutationObserver(react)
      : null;
    motionWatcher?.observe(motionHost as HTMLElement, { attributes: true, attributeFilter: ["data-motion"] });

    return () => {
      reduced.removeEventListener("change", react);
      motionWatcher?.disconnect();
      teardown();
    };
  }, []);

  return null;
}
