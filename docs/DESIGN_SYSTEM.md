# Sentinel design system

|                 |                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Version         | 2.0, October 2026                                                                                                                    |
| Status          | Implemented in `apps/web`. Replaces the v1 draft (Atkinson Hyperlegible, Bricolage Grotesque, ultramarine)                           |
| Source of truth | `apps/web/src/styles/app.css` (tokens), `apps/web/src/components/ui` (primitives), `apps/web/src/components/domain` (glyphs, Thread) |
| Checks          | `apps/web/src/styles/tokens.test.ts` asserts WCAG contrast for every text and glyph pairing in both themes                           |

## 1. Direction

Sentinel is operational software bought by operations and facility managers and used every day by supervisors at a desk and by technicians and employees on a phone. It has to read as calm, exact and trustworthy, in the same family as Linear, Stripe's dashboard and Vercel, without copying any of them.

Three decisions carry the whole system:

1. **Near-monochrome interface, so colour means something.** Surfaces, text and controls are neutral greys and near-black. Colour is reserved for priority, status, validation and the accent (focus, selection, links, the live state). When a red glyph appears, it is a critical incident, never decoration.
2. **Primary actions in ink, not in a brand colour.** The primary button is near-black in light mode and near-white in dark mode. It is the strongest object on any screen without competing with priority colours.
3. **The Thread is the signature.** Every incident is a case file whose activity is one continuous line, with a single pulsing node when someone has to act. Everything around it stays quiet.

What we deliberately do not use: gradients, glassmorphism, decorative icon tiles, coloured KPI cards, entrance animations, hover lifts, emoji, illustrations, all-caps eyebrow labels.

## 2. Tokens

Tokens are named by role. Application code uses Tailwind classes generated from them (`bg-surface`, `text-ink-3`, `border-line`) and never raw palette colours or hex values.

### 2.1 Colour

| Token                    | Light                 | Dark                  | Use                                           |
| ------------------------ | --------------------- | --------------------- | --------------------------------------------- |
| `bg`                     | `#F7F7F8`             | `#0B0B0E`             | App canvas, sidebar                           |
| `surface`                | `#FFFFFF`             | `#141418`             | Content panel, tables, inputs, dialogs        |
| `subtle`                 | `#F3F3F5`             | `#1B1B20`             | Table header, hover, quiet zones              |
| `muted`                  | `#EBEBEE`             | `#232329`             | Segmented track, selected menu item, skeleton |
| `line`                   | `#E6E6EA`             | `#26262D`             | Hairlines and panel borders                   |
| `line-strong`            | `#D4D4DA`             | `#393941`             | Input borders, Thread line                    |
| `ink`                    | `#111114`             | `#EDEDF0`             | Primary text                                  |
| `ink-2`                  | `#4A4A55`             | `#A8A8B3`             | Secondary text                                |
| `ink-3`                  | `#6B6B76`             | `#8A8A95`             | Metadata, placeholders (4.5:1 floor)          |
| `ink-4`                  | `#A0A0AA`             | `#5C5C66`             | Disabled only, never unique meaning           |
| `accent`                 | `#3B4BD8`             | `#8C97FF`             | Focus ring, links, selection, live node       |
| `accent-subtle`          | `#EEF0FD`             | `#1C1F3D`             | Selected row, info banner                     |
| `primary` / `on-primary` | `#111114` / `#FFFFFF` | `#EDEDF0` / `#111114` | Primary button                                |

Semantic colours come as a triple: the glyph colour (3:1 or more on every surface), `-ink` for text (4.5:1 or more) and `-subtle` for tints.

| Meaning  | Glyph (light) | Text (light) | Glyph and text (dark) |
| -------- | ------------- | ------------ | --------------------- |
| Critical | `#D92D20`     | `#B42318`    | `#F97066`             |
| High     | `#D9480F`     | `#B93815`    | `#F38744`             |
| Medium   | `#B47B00`     | `#8A5100`    | `#E8B416`             |
| Low      | `#8A8A94`     | `#55555F`    | `#A8A8B3`             |
| Success  | `#079455`     | `#067647`    | `#47CD89`             |

### 2.2 Typography

One family: **Inter** (variable, with optical sizing), self-hosted through Fontsource. Character variants `cv05` (tailed `l`) and `cv08` (serifed `I`) are on, so codes and names such as `Il` or `INC-2026-00042` read unambiguously. Tables and figures use tabular numbers.

| Token                 | Size / line      | Use                                     |
| --------------------- | ---------------- | --------------------------------------- |
| `text-2xs`            | 11 / 16          | Counters in pills, tab labels on phones |
| `text-xs`             | 12 / 16          | Metadata, table headers, badges, hints  |
| `text-sm`             | 13 / 20          | Default for console UI and tables       |
| `text-base`           | 14 / 20          | Body text                               |
| `text-md`             | 15 / 22          | Field app body, large inputs            |
| `text-lg` / `text-xl` | 16 / 24, 18 / 26 | Dialog and section titles               |
| `text-2xl`            | 22 / 28          | Page titles (semibold, `-0.011em`)      |
| `text-figure`         | 30 / 36          | Dashboard figures                       |

Sentence case everywhere. No all-caps labels.

### 2.3 Shape, depth, motion

| Token            | Value                | Use                                |
| ---------------- | -------------------- | ---------------------------------- |
| `rounded-sm`     | 6 px                 | Buttons, inputs                    |
| `rounded-md`     | 8 px                 | Menus, banners                     |
| `rounded-lg`     | 10 px                | Panels, content area               |
| `rounded-xl`     | 14 px                | Dialogs, auth cards                |
| `shadow-control` | 1 px hairline shadow | Buttons, inputs, the content panel |
| `shadow-pop`     | soft 20 px           | Menus, popovers, toasts            |
| `shadow-dialog`  | deep 64 px           | Dialogs, slide-overs               |

Motion answers a user action and stays between 140 and 220 ms with one ease-out curve. The single exception is the live node of the Thread, which pulses three times when it appears. `prefers-reduced-motion` turns animation off.

## 3. Status and priority

Never colour alone: each has its own shape and a label (`components/domain/glyphs.tsx`).

| Priority | Glyph                                          |
| -------- | ---------------------------------------------- |
| Critical | Filled rounded square with an exclamation mark |
| High     | Three bars                                     |
| Medium   | Two of three bars                              |
| Low      | One of three bars                              |

| Status      | Glyph                              |
| ----------- | ---------------------------------- |
| New         | Dashed circle                      |
| Assigned    | Circle with a centre dot (accent)  |
| In progress | Half-filled circle (accent)        |
| Resolved    | Circle with a check (success)      |
| Closed      | Filled circle with a check (muted) |

## 4. Layout

- **Console** (supervisors): 240 px sidebar on the canvas (organization switcher, notifications, search with Ctrl or Cmd + K, navigation, person menu), and the content in a white panel with a hairline border and 10 px radius. Below 1024 px the sidebar becomes a drawer.
- **Triage desk**: list and case file side by side; selecting a row never navigates away and the URL keeps `?incident=INC-...`. Below 1280 px the case file opens as a slide-over.
- **Field app** (employees and intervenants): one column up to 680 px, organization and notifications at the top, four tabs fixed at the bottom, one primary action anchored above the tabs, 44 to 48 px targets.
- **Platform** (Sentinel staff): the console layout with a "Platform" mark and its own navigation. Incident content is never shown.
- **Public pages**: a centered card on the canvas, 400 px for sign-in, 560 px for registration.

## 5. Components

Primitives live in `components/ui` and wrap Radix where behaviour matters (dialogs, menus, selects, tooltips, tabs, checkboxes, switches).

| Component     | Rules                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button        | Variants primary, secondary, ghost, danger, accent, link. Heights 28, 32, 40, 48. One primary per view. Labels are verbs. Loading keeps the width |
| Field         | Label above, hint below, error replaces the hint, ids and `aria-*` wired automatically                                                            |
| Table         | Inside a `Panel`, sticky header on `subtle`, 44 px rows, hover tint, horizontal scroll on phones                                                  |
| Dialog        | 420, 520 or 680 px, title and one-line description, footer with cancel then the action                                                            |
| ConfirmDialog | Names the object and the consequence; the button repeats the verb                                                                                 |
| Toast         | Bottom right, one line, optional action ("Undo", "View"), same verb as the button                                                                 |
| EmptyState    | One sentence about what belongs here and one action                                                                                               |
| Skeleton      | Matches the final layout, never a full-page spinner                                                                                               |
| Badge         | Small tinted label for flags (Declined, Sent back, Not triaged, Owner)                                                                            |
| Thread        | `components/domain/thread.tsx`, shared by the console and the field app                                                                           |

## 6. Content

- One noun per thing: Employee, Intervenant, Supervisor, Site, Incident. Never "user", "responsable" or "administrator".
- Buttons are verbs and toasts repeat them: Assign, then "Assigned to Karim Benali".
- Errors say what to do and never apologize: "This intervenant has no access to this site. Give them access in Team, or choose someone else."
- No exclamation marks, no emoji, no em dashes.
- Dates in the organization's time zone: relative under a week, absolute in a tooltip.
- English and French are complete and typed: a missing French key fails the type check.

## 7. Accessibility

WCAG 2.2 AA is the floor: contrast checked by test in both themes, visible 2 px focus ring, keyboard-complete flows (the triage list supports J, K, Enter, Escape and A), labelled icon buttons, dialogs that trap and restore focus, status and priority with glyph and label, live regions for toasts, reduced motion respected.

Known trade-off: text input borders use `line-strong` (about 1.5:1 against white) for a quieter look. Inputs are always identified by a visible label and a focus ring, which is the documented reading of WCAG 1.4.11 we rely on. Revisit if an audit requires 3:1 borders.
