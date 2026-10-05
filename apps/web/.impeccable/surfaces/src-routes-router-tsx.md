---
version: 1
slug: "src-routes-router-tsx"
primary_target: "src/routes/router.tsx"
related_targets: []
---

# Surface brief: Triage desk (apps/web, route /app/triage)

Mode: Operate. Visitor: a supervisor triaging tens of incidents a day. Task: see what needs them, read the story of one incident, act on it, never leave the desk.

Direction source: pinned by the user's brief (docs/DESIGN_SYSTEM.md). No direction roll was run, because a brief-pinned direction beats the roll. Build path: code-led (no image generation available).

## Direction contract

THESIS: The triage desk is a list and a case file docked side by side, and the case file is one continuous Thread of events. It refuses the modal incident drawer, the KPI card row, and identical shadowed cards.

OWN-WORLD: Mist canvas #F3F5F9 with white panels split by hairlines, midnight ink #0E1A33, one ultramarine #2B44C6 reserved for actions and selection. Status and priority are glyph plus label chips. Atkinson Hyperlegible Next for the interface, Bricolage Grotesque only for titles and figures. Radii by role: 8 controls, 12 panels, 16 overlays, pill for chips. Elevation only on floating layers.

STORY: A supervisor sees what is waiting on them, selects it, reads what happened in order, and acts. The page never navigates away, and every action confirms with a toast that shares the button's verb.

FIRST VIEWPORT: 232 px rail, list at about 5/12 width with view pills, search and rows, case file at about 7/12 with title, chips, action bar, tabs, and the Thread starting with the live "now" node.

FORM: Docked master-detail (docs/DESIGN_SYSTEM.md section 5.1), position 1 of 1, seed key: pinned-by-brief (no roll).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Signature moment
The Thread: one line, typed nodes, a single live node that pulses three times and then rests.

## Open items
- Finish review and DESIGN.md are not done yet (no finish-reviewer agent is available in this session).
- Dark theme verified by computed colours only, not visually.
