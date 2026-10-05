# Sentinel design system v1.0

| | |
|---|---|
| Version | 1.0, 5 October 2026 |
| Status | Draft for approval. Companion to `docs/PRD.md` (section 9 holds the binding decisions) |
| Live preview | `docs/design-system/specimen.html` (open in a browser, toggle light and dark) |
| Source of truth in code | `packages/shared/src/tokens.ts`, generated into web CSS variables and the React Native theme |

---

## 1. Direction

**Subject.** Operational software for people who keep sites running: facility and operations supervisors at a desk, technicians and employees on a phone, often outdoors or in basements, sometimes wearing gloves.

**Job.** Make the next action obvious, and make a messy real-world event legible as one story.

**Feeling.** Calm, modern, smooth. Closer to a well-run control room than to a marketing site. Quiet surfaces, one confident colour, soft but not bubbly shapes, motion that confirms what you just did.

**The memorable thing: the Thread.** Every incident is a case file, and the case file is one continuous line of events: reported, triaged, assigned, accepted, updated, resolved, closed. One thin vertical line, small typed nodes, and a single live node when something is waiting for someone. This is where the product spends its personality. Everything else is restrained.

**Smooth, in measurable terms.**
- No layout shift: skeletons match the final layout.
- No navigation to read an incident: the case file docks beside the list.
- Optimistic updates for state changes, with rollback and a plain message on failure.
- One easing family, 90 to 280 ms, always tied to a user action.
- No full-page reloads, no spinner over 400 ms without text.

### 1.1 Review against defaults

Before settling, the first draft was checked against the patterns that most B2B dashboards fall into. What changed:

| First instinct | Why it was rejected | What we use instead |
|---|---|---|
| Dark navy sidebar, blue accent, Inter | The default enterprise look, says nothing about incidents | Light rail on a cool mineral canvas, ultramarine brand, Atkinson Hyperlegible Next for UI and Bricolage Grotesque for titles and figures. The UI face was designed for legibility, which suits glare, gloves and tired eyes |
| Modal drawer for incident detail | Forces open, read, close loops and hides the list | Docked case file beside the list (the Triage desk), URL keeps the selection |
| Row of KPI cards with gradient or icon tiles | The stock dashboard | Figures set directly on the canvas with generous space, each linking to the filtered inbox. Tables before charts |
| Everything in identical rounded cards with the same soft shadow | Flattens hierarchy | Panels are flat with a hairline border. Radius follows role. Shadow only on floating layers |
| Coloured pills as the only status signal | Fails colour-blind users and glare | Glyph plus label for every status and priority |
| Entrance animation on every section, hover lifts | Reads as templated | None. One three-cycle pulse on incidents that need a response. Everything else answers a click |
| Warm cream with terracotta, or near-black with acid green | Common generated looks | Not used |

---

## 2. Tokens

Tokens are named by role, never by colour. No hex values in application code (lint rule). Contrast was checked for every text and UI pairing below with a script. The same pair list becomes a CI test (`tokens.contrast.test.ts`).

### 2.1 Colour: light theme

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F3F5F9` | App background |
| `surface` | `#FFFFFF` | Panels, tables, inputs, sheets |
| `surface-2` | `#F8F9FC` | Table header, hover, quiet zones inside a surface |
| `sunken` | `#E9EDF4` | Wells, segmented control track, code |
| `border` | `#DCE1EA` | Panel and divider hairlines |
| `border-strong` | `#7F8AA3` | Input outlines and any border that carries meaning (3:1 against `surface`) |
| `ink` | `#0E1A33` | Primary text (17.3:1 on `surface`) |
| `ink-2` | `#3A4660` | Secondary text (9.4:1) |
| `ink-3` | `#5B6784` | Metadata, placeholders (5.7:1, the floor for readable text) |
| `ink-disabled` | `#9AA3B8` | Disabled text and icons only (exempt from contrast, never carries unique meaning) |
| `brand` | `#2B44C6` | Primary actions, links, selection, active nav (7.7:1) |
| `brand-hover` | `#1F34A0` | Hover |
| `brand-pressed` | `#182A82` | Pressed |
| `brand-tint` | `#E8ECFB` | Selected rows, info banners, focus halo |
| `focus` | `#2B44C6` | 2 px ring with 2 px offset |
| `scrim` | `rgba(14,26,51,.40)` | Behind modals and slide-overs |

Semantic colours come as a triple: `solid` (glyphs, borders, text on `surface`), `tint` (backgrounds) and `ink` (text on the tint).

| Meaning | solid | tint | ink |
|---|---|---|---|
| Critical | `#C0262D` | `#FDECEC` | `#A3141B` |
| High | `#C2540A` | `#FDEFE2` | `#9A4300` |
| Medium | `#946B00` | `#FAF1D6` | `#7A5800` |
| Low | `#52627A` | `#E9EEF5` | `#3F4E66` |
| Success | `#11704A` | `#E2F4EA` | `#0B5A3A` |

Rules:
- Brand is for actions, links, selection and the active nav item. Everything else is neutral.
- Info uses `brand-tint` with `brand` text. There is no separate info colour.
- Semantic colours appear only on status, priority and validation. Never as decoration.
- No gradients anywhere. No colour-only meaning.
- Charts: `brand` for the main series, `ink-3` for the comparison series. Semantic colours only when the value is itself a status.

### 2.2 Colour: dark theme

Shipped in R7, defined now so components are built token-first.

| Token | Value |
|---|---|
| `canvas` | `#0D1424` |
| `surface` | `#141C2F` |
| `surface-2` | `#1A2339` |
| `sunken` | `#0A101D` |
| `border` | `#26314A` |
| `border-strong` | `#5A6A8C` |
| `ink` | `#E8ECF6` |
| `ink-2` | `#B4BDD2` |
| `ink-3` | `#8D98B3` |
| `brand` (text, links, focus) | `#9BADFF` |
| `brand-solid` (filled buttons, white text) | `#4A62E0` |
| `brand-solid-hover` (white text, 5.9:1) | `#3F57D6` |
| `brand-tint` | `#1B2550` |
| Critical solid / tint | `#FF8F94` / `#3A1A21` |
| High solid / tint | `#FFA562` / `#3A2616` |
| Medium solid / tint | `#E6BE55` / `#35290E` |
| Low solid / tint | `#A9B7CE` / `#222C3E` |
| Success solid / tint | `#5CD39B` / `#12301F` |

In dark theme the semantic `ink` equals the `solid` value. Depth comes from lighter surfaces, not from heavier shadows.

### 2.3 Typography

| Role | Family | Why |
|---|---|---|
| UI, body, tables, forms | Atkinson Hyperlegible Next (variable, 400 to 700) | Built for character distinction and low-vision legibility. Good for glare and fatigue, covers French accents, free (OFL) |
| Titles, figures, public headlines | Bricolage Grotesque (variable, 600 and 700) | A grotesque with a little warmth in its curves. Gives titles and big numbers a voice without turning the UI playful |

Both are self-hosted (web: font files in the build, mobile: `expo-font`). No third-party font requests. Both faces were verified to support tabular figures (`font-variant-numeric: tabular-nums`). Both ship as Fontsource packages (`@fontsource/atkinson-hyperlegible-next`, `@fontsource-variable/bricolage-grotesque`) bundled into the build.

| Token | Face | Size / line | Weight | Use |
|---|---|---|---|---|
| `text-xs` | UI | 12 / 16 | 400, 600 for table headers | Metadata, badges, table headers |
| `text-sm` | UI | 13 / 20 | 400, 500 | Dense table cells, secondary text |
| `text-base` | UI | 14 / 20 | 400, 500 | Web body, form fields |
| `text-md` | UI | 16 / 24 | 400, 500 | Mobile body (minimum, prevents iOS input zoom), drawer text |
| `text-lg` | UI | 18 / 26 | 600 | Section headings, card titles |
| `title-md` | Display | 20 / 26 | 600 | Panel and case file titles |
| `title-lg` | Display | 24 / 30 | 600 | Page titles |
| `title-xl` | Display | 32 / 38 | 700 | Sign-in and registration titles |
| `figure` | Display | 36 / 40 | 700 | Dashboard figures |

Rules: sentence case everywhere. Letter spacing 0, except `-0.01em` from 24 px up. Prose lines under 72 characters. Tabular figures in tables and figures. No all-caps labels and no eyebrow labels above headings. Nothing set in a monospace face, references like INC-2026-00042 use the UI face with tabular figures.

### 2.4 Space, shape, elevation

| Token | Value |
|---|---|
| Spacing scale (4 px base) | 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Gutter | 24 desktop, 16 mobile |
| Content widths | 1440 tables, 720 forms, 560 public forms |
| Rail | 232 expanded, 64 collapsed. Top bar 52 |
| Case file | 520 to 640 docked, full screen on mobile |
| Breakpoints | 640, 1024, 1280, 1536 |
| Table rows | 40 default, 32 compact, 48 comfortable, 56 on mobile |
| Tap targets | 32 min on web controls, 48 min on mobile, 56 for primary mobile actions |

Radius follows role, not one value everywhere:

| Token | Value | Use |
|---|---|---|
| `r-control` | 8 | Buttons, inputs, selects, row selection highlight |
| `r-panel` | 12 | Panels, menus, popovers, toasts |
| `r-sheet` | 16 | Modals, slide-overs, mobile sheets |
| `r-pill` | 999 | Status and priority chips, filter chips, avatars |

Elevation exists only for layers that float:

| Token | Value | Use |
|---|---|---|
| `e0` | none, 1 px `border` | Panels, tables, sticky bars |
| `e1` | `0 1px 2px rgba(14,26,51,.06), 0 8px 24px rgba(14,26,51,.10)` | Menus, popovers, toasts |
| `e2` | `0 2px 4px rgba(14,26,51,.06), 0 24px 56px rgba(14,26,51,.20)` | Modals, slide-over case file |

### 2.5 Motion

| Token | Value | Use |
|---|---|---|
| `ease-out` | `cubic-bezier(.2, .7, .2, 1)` | Things arriving: overlays, toasts, case file swap |
| `ease-in-out` | `cubic-bezier(.4, 0, .2, 1)` | Things changing in place: expand, reorder |
| `dur-press` | 90 ms | Button press, switch |
| `dur-small` | 140 ms | Menus, tooltips, hover, chips |
| `dur-overlay` | 200 ms | Modal, slide-over, toast |
| `dur-swap` | 280 ms | Case file content change, list reorder |

Mobile sheets use a spring (damping 20, stiffness 220) via Reanimated, and a light haptic on confirm.

Rules:
1. Motion answers a user action. No page-load choreography, no hover lift, no scroll-triggered reveals.
2. **One exception: the live pulse.** A node or chip on an incident that needs a response (assigned and unanswered, reassignment requested) pulses a soft ring for three cycles when it appears, then rests.
3. Status changes use a 280 ms crossfade of the chip and a Thread node that draws in. List reorder uses the View Transitions API where supported.
4. `prefers-reduced-motion`: all transforms off, opacity fades only at 100 ms, no pulse (replaced by a static ring).

### 2.6 Layers (z-index)

Base 0, sticky bars 10, rail 20, popovers and menus 40, slide-over 50, modal 60, toast 70, command palette 80.

---

## 3. Glyphs and iconography

Icons: Lucide, 1.75 px stroke, sizes 16, 20, 24. Imported per icon, never as a whole set.

Status and priority are always glyph plus label. The glyph set is custom SVG in `packages/shared` and is used by web and mobile.

| Priority | Glyph | Colour |
|---|---|---|
| Critical | Filled triangle | critical |
| High | Filled square | high |
| Medium | Filled circle | medium |
| Low | Outlined circle | low |

| Status | Glyph | Presentation |
|---|---|---|
| New | Dashed circle | Neutral outline chip |
| Assigned | Circle with a dot | `brand` outline chip |
| In progress | Half-filled circle | `brand` filled chip |
| Resolved | Circle with check | `success` outline chip |
| Closed | Filled circle with check | Muted fill chip |

Chip anatomy: pill, 24 px tall (28 on mobile), glyph 12 px, label `text-xs` weight 600, 8 px horizontal padding. Chips on dense rows may drop to glyph only with a tooltip and accessible name, never glyph only on mobile.

---

## 4. The Thread

The Thread is the case file's spine: a 2 px vertical line in `border-strong` at the left of a 28 px gutter, with typed nodes.

| Event | Node |
|---|---|
| Reported, status change | 12 px circle, `brand` fill for the current state, `ink-3` outline for past states |
| Assignment, reassignment | 12 px circle with a ring |
| Public comment | 8 px dot, the comment sits in a quiet bubble (`surface-2`, `r-panel`) |
| Internal comment | 8 px dot with a lock glyph, dotted bubble outline, label "Internal" |
| Progress update | 8 px dot with the type glyph (started, on site, blocked, update) |
| Attachment | Thumbnail on a 56 px tile attached to its event |
| Sent back, declined | 12 px hollow circle in `critical` with a glyph |
| System event | 6 px `ink-disabled` dot, one line of `ink-3` text |

Anatomy of an event: node, one-line summary with actor name in weight 500, relative time with the absolute time in a tooltip, optional body. Events group by day with a sticky day marker. New events from live updates slide in at 280 ms and the line draws to reach them. The live node (when the incident needs a response) pulses per 2.5.

Employees see a reduced Thread (milestones and public comments). Supervisors can toggle internal items on and off. A conflict (version mismatch) appears as an inline banner at the top of the Thread, never a modal.

---

## 5. Layout and shells

### 5.1 Web console shell and Triage desk

```
+---------+----------------------------------------------------------------------------+
| Sentinel|  Acme Facilities     [ Search or jump to...      Ctrl K ]   (bell)  (LM)   |
|         +------------------------------+---------------------------------------------+
| Triage  |  Needs attention  v   + Filter|  INC-2026-00042                  [ Assign ] |
| Dashboard|  ----------------------------|  Water leak in corridor B3                  |
| Map     |  [^] Water leak, B3    12 min |  [^ Critical] [o New]   Paris 11, Site 2    |
| Reassign|  [#] Door sensor down   1 h   |  ------------------------------------------ |
| Team    |  [o] Light flicker      3 h   |  Overview   Thread   Evidence               |
| Sites   |  ...                          |                                             |
| Audit   |                               |  o  Reported by Lea M.       12 min ago     |
|         |                               |  |  "Water coming from the ceiling..."      |
| Settings|                               |  *  Needs triage                            |
+---------+------------------------------+---------------------------------------------+
```

- List and case file are siblings. Selecting a row swaps the case file in place (280 ms crossfade) and updates the URL.
- Below 1280 px the case file opens as a slide-over from the right with `e2`.
- Rail items: icon plus label, active item has a `brand` text and a 3 px `brand` bar on its left edge. Collapsed rail shows icons with tooltips.
- The top bar is flat with a bottom hairline, never shadowed.

### 5.2 Case file (state-aware actions)

```
INC-2026-00042                                           [ Triage and assign ] [ ... ]
Water leak in corridor B3
[^ Critical]  [o New]  Paris 11, Site 2  |  Lea M., reported 12 min ago
----------------------------------------------------------------------------------
Overview   Thread   Evidence
```

The action bar shows only what the current state and role allow:

| State | Supervisor | Intervenant (mobile) | Employee (mobile) |
|---|---|---|---|
| NEW | Triage and assign, Dismiss | n/a | Comment |
| ASSIGNED | Reassign, Unassign | Accept, Decline | Comment |
| IN_PROGRESS | Reassign, Unassign | Post update, Resolve, Request reassignment | Comment |
| RESOLVED | Close, Send back | Read only | Comment |
| CLOSED | none (read only) | none | none |

A disabled action never just disappears when the reason matters: it shows with a tooltip ("Waiting for the technician to accept").

### 5.3 Assign dialog

```
+--------------------------------------------------------------+
|  Assign INC-2026-00042                                  [x]  |
|  Priority [ Critical v ]   Category [ Water damage v ]       |
|--------------------------------------------------------------|
|  ( ) Karim B.   Plumbing | Available | 1 open | Site access   |
|  ( ) Anna R.    Plumbing | Busy      | 3 open | Site access   |
|  ( ) Joel T.    Electric | Available | 0 open | Site access   |
|  ( ) Mia D.     Plumbing | Available | No access to Site 2    |  (disabled)
|--------------------------------------------------------------|
|  Note for the technician (internal)            [ Assign ]    |
+--------------------------------------------------------------+
```

Fit chips: specialty match, availability, open load, site access. The top candidate is preselected. Disabled rows show the reason in plain words.

### 5.4 Dashboard

```
 Open  42      Unassigned  7      Awaiting review  5      Median time to resolution  6 h 20
 (figures on the canvas, large Bricolage numerals, small label under each, no card chrome)

 Ageing                                  Workload by intervenant
 table: bucket | count | oldest          table: person | live | oldest | availability
 ...                                     ...

 Status and category breakdown (bars)         Last 30 days (line, one series)
```

Figures link to the filtered inbox. Charts are labelled directly, have a table alternative for screen readers, and use no fills or gradients.

### 5.5 Public pages

Centered single column 560 px on `canvas`, a `surface` panel with `r-sheet`, title in `title-xl`, no marketing panel. Registration uses a stepper because it is a real sequence: Company, Primary contact, Review and accept.

### 5.6 Mobile

```
Report, step 2 of 3                    My work                          Assignment
+---------------------------+          +---------------------------+     +---------------------------+
| <  Where                  |          | Acme Facilities  v   (2)  |     | <  INC-2026-00042         |
|                           |          |                           |     | Water leak in corridor B3 |
|  Site   [ Paris 11    v ] |          | Needs response            |     | [^ Critical] [o Assigned] |
|  +---------------------+  |          | +-----------------------+ |     |                           |
|  |       map + pin     |  |          | | [^] Water leak, B3    | |     |  Overview Thread Evidence |
|  +---------------------+  |          | | Paris 11 . Acme   12m | |     |  ...                      |
|  GPS accuracy 8 m  Use it |          | +-----------------------+ |     |                           |
|  Move the pin manually    |          | In progress               |     |---------------------------|
|                           |          | ...                       |     | [        Accept         ] |
| [        Continue       ] |          | Awaiting review           |     |   Decline  Request change |
+---------------------------+          +---------------------------+     +---------------------------+
```

- Primary action is fixed to the bottom, 56 pt tall, full width, above the safe area.
- Forms open as full-screen sheets. Lists use 56 pt rows.
- The offline badge sits in the header: "2 waiting to send", tap for the queue sheet.
- Tabs: employee (Report, My incidents, Notifications, Profile), intervenant (My work, History, Notifications, Profile). Report is the first and visually prominent tab for employees.

---

## 6. Components

Each component ships with all states (default, hover, focus, active, disabled, loading, error) in the `/design` route, in light and dark, in EN and FR.

| Group | Component | Specification |
|---|---|---|
| Actions | Button | Primary (`brand`), secondary (outline), ghost, danger. Heights 32 web, 40 dense forms, 48 mobile, 56 mobile primary. One primary per view. Labels are verbs. Loading keeps width and shows a small progress state, not a spinner swap |
| | Icon button | 32 web, 48 mobile, tooltip and accessible name mandatory |
| Inputs | Text, textarea | Label above, help below, error replaces help with an icon and `critical` text. Outline `border-strong`, focus ring `focus`. Counter on limited fields. Required stated in the label text |
| | Select, combobox | Radix based, type-ahead search, empty result text, clear action |
| | Date, phone, file drop, checkbox, radio, switch | Switch for immediate settings, checkbox for form choices |
| | Segmented control | `sunken` track, selected segment on `surface` with `e0` |
| Data | Data table | Sticky `surface-2` header, sortable columns, column visibility, row selection, density toggle, keyboard navigation, virtualized past 200 rows. Row hover is a background change, selected row uses `brand-tint` |
| | Filter bar | Removable chips, "Add filter" menu, saved views dropdown, result count |
| | Stat figure | Number in `figure`, label in `text-sm` `ink-2`, optional delta with direction glyph and text. No card chrome |
| | Key-value list | Two columns on web, stacked on mobile |
| | Thread | See section 4 |
| | Candidate row | Radio, name, fit chips, reason when disabled |
| Feedback | Toast | `r-panel`, `e1`, 4 s, one optional action ("Undo", "View"). Bottom center on web, above the tab bar on mobile. Same verb as the button that caused it |
| | Banner | Info, warning, critical, inline above the content it concerns. Actionable |
| | Empty state | One sentence saying what belongs here, one action. No illustration needed |
| | Skeleton | Matches the final layout, shimmer disabled under reduced motion |
| | Progress | Linear for uploads, text status for jobs. Spinner only for waits under 400 ms |
| Overlays | Modal | `r-sheet`, `e2`, max 560 wide, focus trapped and restored, Esc closes unless unsaved |
| | Slide-over | 520 to 640 wide from the right, same rules |
| | Menu, popover | `r-panel`, `e1`, arrow key navigation |
| | Confirm dialog | Names the object and the consequence ("Revoke Karim B.? He loses access now. 2 live assignments return to the inbox."), danger button repeats the verb |
| | Command palette | Ctrl or Cmd + K, searches incidents by reference and title, people, pages and actions, recent items first |
| | Mobile sheet | Spring open, drag to dismiss, handle bar |
| Navigation | Left rail, top bar | See 5.1 |
| | Organization switcher | Top bar on web (platform admins and multi-org supervisors), header on mobile for intervenants |
| | Tabs | Underlined with `brand`, 44 px tall |
| | Stepper | Only for true sequences: registration, CSV import |
| | Bottom tab bar | 4 items, 56 pt, label always visible |
| Domain | StatusChip, PriorityChip | See section 3 |
| | IncidentRow | Priority glyph, reference, title, site, status chip, assignee, age. Age uses relative time with the absolute time on hover |
| | AssignmentCard (mobile) | Reference, title, site, priority, organization name for multi-org people, age |
| | CertificationBadge | Valid, expiring (30 days), expired, each with glyph and date |
| | MapPanel | Quiet basemap, priority glyph markers on white discs with a hairline border, perimeter in `brand` at 12 percent fill |
| | AuditEntry | Actor, action in plain words, object, time, expandable before and after |
| | OfflineBadge, QueueSheet | Count in header, per-item state Waiting, Sent, Failed with Retry |
| | Avatar | Initials on `brand-tint`, 24, 32, 40, pill radius |

---

## 7. Content design

Plain verbs, sentence case, no filler. Write from the person's point of view and name things by what they understand.

- **One noun per thing, everywhere.** Employee, Intervenant, Supervisor, Site, Incident. Never "user".
- **Button and toast share a verb.** Assign, then "Assigned to Karim B." Close, then "Closed INC-2026-00042".
- **Errors never apologize and always say what to do.** "That employee code is used by another member. Change the code or edit the existing member."
- **Empty states invite an action.** "No incidents yet. Employees report from the app, or create one for them."
- **Dates** in the organization timezone. Relative under 24 hours, absolute in a tooltip.
- **No exclamation marks, no emoji, no jargon** (webhook, payload, entity).

| Term (EN) | FR |
|---|---|
| Incident | Incident |
| Supervisor | Superviseur |
| Employee | Employé |
| Intervenant | Intervenant |
| Site | Site |
| Triage | Qualifier |
| Assign | Assigner |
| Accept | Accepter |
| Decline | Refuser |
| Resolve | Résoudre |
| Close | Clôturer |
| Send back | Renvoyer |
| Reassignment request | Demande de réaffectation |

Sample strings:

| Where | EN | FR |
|---|---|---|
| Triage empty | No incidents need attention. Everything is assigned or closed. | Aucun incident à traiter. Tout est assigné ou clôturé. |
| Assign toast | Assigned to Karim B. | Assigné à Karim B. |
| Decline sheet title | Why can't you take this? | Pourquoi ne pouvez-vous pas le prendre ? |
| Conflict banner | Anna R. updated this incident just now. Review the changes before you continue. | Anna R. vient de modifier cet incident. Vérifiez les changements avant de continuer. |
| Offline badge | 2 waiting to send | 2 en attente d'envoi |
| Org suspended | Acme Facilities is suspended. Contact the account owner, Sara K., to restore access. | Acme Facilities est suspendue. Contactez le propriétaire du compte, Sara K., pour rétablir l'accès. |
| Resolve note placeholder | What did you fix and what did you find? | Qu'avez-vous réparé et qu'avez-vous constaté ? |

---

## 8. Accessibility

WCAG 2.2 AA is the floor.

- Contrast: all text 4.5:1 or better, UI components and glyphs 3:1 or better (checked in section 2 and enforced in CI).
- Focus: visible 2 px ring with 2 px offset on every interactive element, never hidden under sticky bars.
- Keyboard: every web journey is completable with the keyboard. Inbox shortcuts (arrows, Enter, A, C, ?) are documented in a help overlay and never collide with typing.
- Targets: 32 px minimum on web controls (24 px is the WCAG floor), 48 pt on mobile.
- Meaning: status and priority use glyph plus label. Charts have a table alternative.
- Screen readers: toasts and conflicts in live regions, dialogs labelled, Thread is a list with time elements, map has a list alternative.
- Motion: reduced motion removes transforms and the pulse.
- Zoom and type: layout works at 200 percent zoom on web and dynamic type up to 130 percent on mobile.
- Authentication: no cognitive tests, paste allowed in password fields, TOTP inputs accept paste.

---

## 9. Implementation

1. `packages/shared/src/tokens.ts` holds every token above. A build step writes `tokens.css` (web, Tailwind v4 `@theme` plus a `[data-theme="dark"]` block) and `theme.ts` (React Native).
2. ESLint blocks hex colours, raw pixel sizes outside the token files, and colour-named classes in the apps.
3. `tokens.contrast.test.ts` asserts every pairing in 2.1 and 2.2 against its minimum ratio.
4. Web primitives are Radix with our tokens. Mobile primitives are a small themed layer: Button, Input, Chip, Sheet, ListRow, Thread, BottomActionBar.
5. The `/design` route (development only) renders every component and state, in both themes and both languages, for review and Playwright visual checks.
6. Fonts: add the files for Atkinson Hyperlegible Next and Bricolage Grotesque with their OFL licence texts, preload the two weights used above the fold, `font-display: swap` with metric-matched fallbacks to avoid layout shift.
7. Maps: MapLibre on web, `react-native-maps` on mobile, markers built from the shared glyphs.
8. Charts: a small wrapper that enforces the chart rules in 2.1 and always renders a table alternative.
