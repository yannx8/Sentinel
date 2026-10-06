# Sentinel: marketing site style reference
> Navy ink on cool marble, with the product as the hero.

**Theme:** light (dark theme exists for the product, not for the marketing site)

Adapted from the Calendly style on Refero (https://styles.refero.design/style/9946887b-ffa9-4276-af81-ae6352795afb). Same system, different brand: Sentinel, an incident platform for organizations with several sites. Calm, exact, trustworthy. The product screens do the talking, not stock photos.

## Tokens: colors

| Name | Value | Role |
|------|-------|------|
| Ink | `#0E1A33` | All text, headings, icons, secondary dark buttons. Never pure black |
| Signal Ultramarine | `#2B44C6` | Filled primary buttons, active nav, links, selected states. The only action color |
| Ultramarine Deep | `#1F34A0` | Primary button hover |
| Slate | `#3A4660` | Secondary body copy |
| Slate Light | `#5B6784` | Helper text, muted labels, metadata (minimum contrast for readable text) |
| Cloud | `#F3F5F9` | Page canvas, footer |
| Paper | `#FFFFFF` | Cards, panels, product screenshots, button text on dark fills |
| Pebble | `#E9EDF4` | Badge fills, input fills, hover washes |
| Hairline | `#DCE1EA` | Card and input borders, dividers |
| Tint | `#E8ECFB` | Flat field behind product screenshots, info badges |

Status colors appear only inside product screenshots, always as glyph plus label: Critical `#C0262D`, High `#C2540A`, Medium `#946B00`, Low `#52627A`, Success `#11704A`.

## Tokens: typography

- **Headlines: Bricolage Grotesque**, weight 700 (600 for subheads). Hero 72, H2 50, H3 38, small heading 28. Letter spacing -0.01em from 24px up.
- **Everything else: Atkinson Hyperlegible Next**, weights 400, 500, 600. Body 16/1.5, card titles 14/500 to 20/500, helper text 13.
- Type scale: Minor Third (1.2) from a 16px base. Sentence case everywhere. No all-caps labels, no eyebrow labels above headings.
- Tabular figures for every number.

## Spacing and shape

- Base unit 8px. Comfortable density. Max width 1200px. Section gap 64 to 96px. Card padding 24px. Element gap 8 to 16px.
- Radius: 4 small, 8 inputs and buttons, 16 product cards, 24 feature panels.
- Elevation: flat surfaces with 1px Hairline borders. Anything above the canvas gets a three-layer shadow tinted with Ink, never neutral black:
  `0 1px 2px rgba(14,26,51,.06), 0 8px 24px rgba(14,26,51,.08), 0 24px 56px rgba(14,26,51,.10)`

## Components

- Primary button: Signal Ultramarine fill, white text, 8px radius, height 48. One per section.
- Secondary button: Ink fill or Paper with Hairline border. Never next to a primary without 16px+ spacing.
- Product screenshot card: Paper, 16px radius, shadow stack, sits on a flat Tint field offset 24 to 40px behind it.
- Status chips in screenshots: pill, glyph plus label, never color alone.
- Link card with icon: Paper, Hairline border, 24px padding, icon in Ink.

## Guidelines

DO
- Use Ink `#0E1A33` for all text and Slate or Slate Light for secondary text.
- Use Signal Ultramarine only for filled primary buttons, links and selected states.
- Use Bricolage Grotesque 700 at 38 to 72px for headlines. Undersized headlines lose the page's confidence.
- Show the real product: the Triage desk with the Thread, the assign dialog, the phone report flow. Label demo data as demo data.
- Keep surfaces flat. Depth comes from the tinted shadow stack and layering.
- Write plain verbs in sentence case: "See the Triage desk", "Start your trial".

DON'T
- Don't use pure black or neutral-black shadows.
- Don't use gradients. Calendly's pink and cyan decorative blobs are replaced by a flat Tint field.
- Don't use the status colors as decoration or as button fills.
- Don't use stock photography, invented customer logos, testimonials or metrics. None exist yet.
- Don't use buttons below 4px or above 12px radius.
- Don't use exclamation marks, emoji, or the words "seamless", "powerful" or "revolutionary".

## Brand notes

- Product: Sentinel. One case file per incident for every role, strict tenant isolation, technicians who can serve several client organizations with one login.
- Buyer: operations or facility manager. Daily users: supervisors (desktop), technicians and employees (phone).
- Signature visual: the Thread, a single vertical line of events on an incident with one live node. Use it as a recurring graphic motif and as the centerpiece of the hero screenshot.
- Languages: French and English from day one.
