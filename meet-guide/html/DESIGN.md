# Quantum Swimming team guide

## Overview
A standalone content guide for English-speaking timing volunteers on laptops and phones at a swim meet. Preserve the JTSC maroon identity; use an ordered meet sequence and an eight-instruction heat routine. This tutorial is independent of the main team-hub application. It does not operate equipment.

## Colors
The embedded stylesheet in dist/index.html is the canonical token owner: brand #741b38, brand-dark #501327, soft #f5edef, paper #f7f7f5, ink #202223, muted #606366, line #d8d9d6. Green #236348 identifies expected checks with explicit labels; amber #795211 highlights the pool-before-schedule dependency.

## Typography
System Arial and Helvetica body stack, Arial Narrow and Aptos Display headings with Arial fallback. No external font dependency so the shared HTML works offline. Body 16px, controls 14px, metadata 12px. Main headings carry scale; instructional prose stays readable.

## Layout
A 240px section rail beside a long-form guide. Below 760px, use horizontally scrolling native section links above one content column. The heat routine has eight native step buttons and one instruction shown at a time; without JavaScript and in print, every instruction is visible.

## Elevation & Depth
Flat paper and white reading surfaces. Borders separate procedures. No shadows, imagery or animated decoration.

## Shapes
Controls use the team's restrained 2px radius. Numbering marks actual sequence rather than decoration.

## Components
Native links own section navigation, native details own troubleshooting disclosures, and native labeled checkboxes own session-only check progress. The shared updateProgress function owns the count, meter and live feedback. Reset is reversible with Undo. The heat routine changes only educational instructions, with explicit labels distinguishing it from Quantum controls. Print opens all disclosures, and checklist printing isolates only the checklist. Scrollbar tokens apply globally. Focus rings, forced colors and reduced motion are supported.

## Do's and Don'ts
Keep source references and version limits. Preserve all necessary operational checks. Do not imply live hardware state, automatic approval, or data synchronization. Do not publish changes to the unrelated parent app.
