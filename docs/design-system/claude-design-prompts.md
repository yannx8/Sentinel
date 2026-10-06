# Sentinel: prompt pack for Claude Design

Order matters. Do these in sequence so every later prototype inherits the earlier decisions.

1. Create the two design systems (section A).
2. Logo (B1), then splash and app icon (B2).
3. Web prototypes (C), then mobile prototypes (D).
4. Effects (E), then the marketing hero (F).

Reference material to attach where Claude Design allows it:
- `docs/PRD.md` sections 2, 3 and 8 (personas, journeys, screens).
- `docs/design-system/specimen.html` opened in a browser, as a screenshot.
- A screenshot of the running Triage desk (`pnpm --filter @sentinel/web dev`, then open http://localhost:5173/app/triage).

---

## A. Design systems

### A1. "Sentinel Product" (use for every prototype below except F)
Paste this into Design systems, then Create.

```
# Sentinel Product: style reference
> Calm operations software. Mist canvas, midnight ink, one ultramarine for actions.

Theme: light, with a dark theme using the same tokens.

Colors (light): canvas #F3F5F9, surface #FFFFFF, surface-2 #F8F9FC, sunken #E9EDF4, border #DCE1EA, border-strong #7F8AA3, ink #0E1A33, ink-2 #3A4660, ink-3 #5B6784, brand #2B44C6, brand-hover #1F34A0, brand-tint #E8ECFB.
Colors (dark): canvas #0D1424, surface #141C2F, surface-2 #1A2339, sunken #0A101D, border #26314A, border-strong #5A6A8C, ink #E8ECF6, ink-2 #B4BDD2, ink-3 #8D98B3, brand text #9BADFF, brand fill #4A62E0, brand-tint #1B2550.
Semantic (solid / tint / ink on tint): Critical #C0262D / #FDECEC / #A3141B, High #C2540A / #FDEFE2 / #9A4300, Medium #946B00 / #FAF1D6 / #7A5800, Low #52627A / #E9EEF5 / #3F4E66, Success #11704A / #E2F4EA / #0B5A3A.

Type: Atkinson Hyperlegible Next for all interface text (13 to 16px, weights 400 to 600). Bricolage Grotesque 600 to 700 only for titles and big figures (20, 24, 32, 36). Tabular figures for numbers. Sentence case. No all-caps labels, no eyebrow labels.

Shape: radius 8 controls, 12 panels and menus, 16 modals, sheets and drawers, pill for chips. Panels are flat with a 1px border and no shadow. Shadow only on floating layers: 0 1px 2px rgba(14,26,51,.06), 0 8px 24px rgba(14,26,51,.10). Spacing on a 4px base.

Status and priority are never color alone. Every one has a glyph and a label.
Priority glyphs: Critical filled triangle, High filled square, Medium filled circle, Low outlined circle.
Status glyphs: New dashed circle, Assigned circle with a dot, In progress half-filled circle, Resolved circle with a check, Closed filled circle with a check.
Chips: pill, 24px tall, glyph 12px, label 12px semibold.

Signature: the Thread. A single 2px vertical line through an incident's events, newest first, small typed nodes (ring for state changes, dot for comments and updates, red ring for declines and send-backs), and one live node that pulses three times and then rests.

Layout: Triage desk is a docked list (about 5/12) beside the case file (about 7/12), never a modal drawer. Left rail 232px, top bar 52px.
Mobile: bottom tabs, a fixed 56px primary action at the bottom, 48px minimum targets, 16px minimum body text, offline badge in the header.

Do: one primary button per view, verbs on buttons that match the confirmation toast, flat surfaces, real product content labelled as demo data.
Don't: gradients, glass blur, pure black, neutral-black shadows, colored left borders, icon-heading-text card grids, emoji, exclamation marks, entrance animations on every section.
```

### A2. "Sentinel Marketing" (use only for F)
Paste the contents of `docs/design-system/claude-design-brief.md`.

---

## B. Identity

### B1. Logo
```
Design the Sentinel logo using the Sentinel Product design system. Sentinel is an incident platform for organizations with several sites. The feeling is a calm, trustworthy watcher, not a security or military brand.

Give me 6 directions on one board, each as a mark plus wordmark lockup in horizontal and stacked versions, shown on white and on #0E1A33:
1. Ring and dot: a circle with a centered dot, the same shape as our "Assigned" status glyph, read as an eye that watches.
2. Thread: a vertical line with a single node, echoing our incident timeline.
3. Ring with a pulse gap: the ring is broken once, like a signal leaving.
4. A monogram S drawn from a line that passes through two nodes.
5. Two concentric rings, the outer one open.
6. Free direction of your choice that fits "calm watcher".

Constraints: the mark must still read at 16px, work in one color, and sit on ultramarine #2B44C6 in white. Wordmark in Bricolage Grotesque 700, sentence case "Sentinel", no all caps. No gradients, no shields, no eyes with lashes, no letters hidden in the mark. Show each at 16, 32 and 128px, and as a favicon.
Then refine my favorite into: primary logo, mark only, app icon (iOS and Android adaptive), and a one-color version.
```

### B2. Splash screen and app icon
```
Design the Sentinel mobile splash screen and app icon from the chosen logo, using the Sentinel Product design system.

Splash (390x844, light and dark): centered mark, wordmark below it, nothing else. Describe the 1.2 second animation: the mark appears, its ring pulses softly three times, then rests, then the screen hands off to the app. Reduced motion version: static mark, no pulse.
App icon: ultramarine #2B44C6 field with the white mark, iOS squircle and Android adaptive circle and square masks, plus the monochrome Android 13 themed version.
Also give me a launch-to-sign-in transition storyboard in 4 frames.
```

---

## C. Web prototypes (1440x900, light first, then dark)

### C1. Sign in and registration
```
Using the Sentinel Product design system, design the web sign-in page and the 3-step organization registration (Company, Primary contact, Review and accept). Single centered column 560px on the mist canvas, white panel with 16px radius, title in Bricolage Grotesque 32px. Include: inline validation states, the "Check your email" confirmation with resend and fix-my-email, the expired-link state, and the "Use the Sentinel app" page shown to people who have no supervisor role. No marketing panel.
```

### C2. Triage desk (the core screen)
```
Using the Sentinel Product design system, prototype the Triage desk at 1440x900. Left: a 232px rail (Triage desk, Dashboard, Map, Reassignments, Team, Sites, Audit, Settings). Top bar 52px with organization name "Acme Facilities" and a "Demo data" tag. Center-left: view pills (Needs attention 4, All open 7, Awaiting review 1, Closed 1), a search field, and an incident list with a priority glyph, title, reference, site, a short state marker, and age. Right: the docked case file for INC-2026-00042 "Water leak in corridor B3": chips, action bar (Triage and assign, Dismiss), tabs Overview, Thread, Evidence, and the Thread with a live "Needs triage" node, an internal note shown with a dashed bubble and lock, a public comment, and the original report with an attachment.
Show these states as separate frames: loading skeleton, empty view, search with no result, conflict banner ("Anna R. updated this incident just now"), selected incident that is CLOSED (read only), and the slide-over version at 1100px.
```

### C3. Assign dialog and reason dialogs
```
Design the Assign dialog (560px): priority and category selects, ranked candidates with fit chips (specialty match, availability, open load, site access), a "Best fit" marker, one off-duty candidate with a warning, two disabled candidates with plain reasons ("No access to this site"), an internal note field, and the footer "Karim B. will be asked to accept." Also design the Send back dialog (reason required, 10 character minimum, live counter) and the Dismiss dialog (reason code radio group plus note). Include the toast "Assigned to Karim B." with Undo.
```

### C4. Dashboard
```
Design the supervisor dashboard. Do not use a row of identical KPI cards. Put four large figures directly on the canvas with space around them (Open 42, Unassigned 7, Awaiting review 5, Median time to resolution 6 h 20), each a link to the filtered inbox. Below: an ageing table (under 4 h, 4 to 24 h, 1 to 3 days, over 3 days, with oldest incident), a workload table per technician, a status and category breakdown as plain bars, and a 30 day trend line with one series and a table alternative. Tables before charts. No gradients and no sparkline decorations.
```

### C5. Team, sites and platform admin
```
Design: (1) Team page with tabs Employees, Intervenants, Invitations, a CSV import stepper (upload, review row errors, confirm), and the revoke confirmation that names the consequence ("Karim B. loses access now. 2 live assignments return to the inbox."). (2) Sites page with an address search, a map pin and a circular perimeter editor. (3) Platform admin: organizations table, organization detail with counts only and a persistent "Platform mode" banner, and the Suspend dialog with a mandatory reason. Platform admin screens never show incident content.
```

---

## D. Mobile prototypes (390x844, iOS and Android variants, light and dark)

### D1. Employee: report an incident
```
Using the Sentinel Product design system, design the employee report flow as 3 steps: What happened (title, description, photo from camera or library), Where (site picker, map with a pin, GPS accuracy line "8 m, use it", manual pin fallback), Confirm. Fixed 56pt primary button at the bottom. Include the success screen with the reference INC-2026-00042, the permission rationale sheets for camera and location, and the offline version where the report is queued: header badge "1 waiting to send", then Sent and Failed with Retry. Tabs: Report, My incidents, Notifications, Profile.
```

### D2. Employee: my incidents
```
Design My incidents (list with priority glyph, status chip and age) and an incident detail showing the reduced Thread (milestones and public comments only), with a comment box. Include the empty state.
```

### D3. Intervenant: my work and assignment
```
Design My work for a technician who serves several organizations: header with an organization switcher, groups "Needs response", "In progress", "Awaiting review", cards with priority glyph, title, site, organization name and age. Then the assignment detail with the live Thread and a fixed bottom action that changes by state: Accept, then Post update, then Resolve, with Decline and Request reassignment in a secondary row. Design: the Decline sheet (reason, 5 character minimum), the structured update sheet (Started, On site, Blocked, Update, optional photo), and the Resolve form (note, photo, confirm). Include the Needs response card with the live pulse.
```

### D4. System states
```
Design for mobile: the blocking "Update required" screen, the suspended organization screen ("Acme Facilities is suspended. Contact the account owner, Sara K., to restore access."), the revoked account screen, a push notification (reference and event type only), the invitation acceptance screen, and the organization switcher sheet.
```

---

## E. Effects and motion
```
Design a motion spec for Sentinel with these effects, each as a short storyboard plus timing and easing (use cubic-bezier(0.2, 0.7, 0.2, 1) for arrivals and (0.4, 0, 0.2, 1) for in-place changes):
1. Live pulse: a soft ring around a node or chip that needs a response, 2.4 seconds, 3 cycles, then rest. Reduced motion: a static ring.
2. Thread draw-in: when a new event arrives, the line extends to the new node in 280 ms and the node settles.
3. Case file swap: crossfade 280 ms when another incident is selected in the list.
4. Status chip change: 280 ms crossfade and a small scale settle.
5. Optimistic action: button press scale 0.98 at 90 ms, toast rising 200 ms, Undo.
6. List reorder when an incident leaves "Needs attention".
7. Mobile sheet: spring (damping 20, stiffness 220), drag to dismiss, light haptic on confirm.
8. Skeleton loading that matches the final layout.
No page-load choreography, no hover lifts, no scroll-triggered reveals. Everything answers a user action, except effect 1.
```

---

## F. Marketing site (uses the Sentinel Marketing design system)
```
Using the Sentinel Marketing design system, design the home page. Hero: a headline in Bricolage Grotesque 72px and a real, large screenshot of the Triage desk with the Thread on a flat tint field, with one primary button and one secondary button. No stock photos, no invented customer logos, testimonials or metrics. Then: the loop in five steps (report, triage, assign, resolve, verify and close) shown with real product screens, a section on one case file for every role, a section on strict tenant isolation and the audit trail, the phone app for employees and technicians, and a closing call to action. Mobile and desktop. French and English versions of the hero.
```

---

## What to bring back
For each approved prototype, export the frames and any spec, and tell me the file names. I will rebuild them in `apps/web` and `apps/mobile` using the tokens in `packages/shared`, and update `docs/DESIGN_SYSTEM.md` wherever a prototype changes a decision.
