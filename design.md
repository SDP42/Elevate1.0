# Elevate 1.0 — Design System

> Source of truth: this document was written by reading the live, deployed implementation of the Elevate 1.0 website (React + plain CSS, no Tailwind/UI framework). Every value below was extracted directly from the codebase unless marked **Inferred** or **Approximate**. Where the code does not define something, this document says so explicitly rather than inventing a value.

---

## 1. Codebase Map (what was inspected)

Elevate 1.0 is a single-page React 19 + Vite site. There is **no Tailwind config, no design-token JSON, no theme provider** — all styling is hand-written CSS using CSS custom properties, split across a small number of large stylesheets and one central `src/index.css`.

| File | Role |
|---|---|
| `index.html` | Loads the three brand fonts (Google Fonts) |
| `src/index.css` | **Root design tokens**: color variables, base typography, global resets |
| `src/App.jsx` | The actual live component tree (source of truth for what's rendered) |
| `src/App.css` (4,115 lines) | Legacy/accumulated stylesheet — contains styles for many components that **no longer exist** in `App.jsx` (old hero variants, a 3D lab, a globe, a departure board, baggage section, etc.), alongside a handful still in active use (sky backdrop, sound toggle, flight-path progress bar, booking modal, register CTA pill) |
| `src/intro/intro.css` (1,634 lines) | The "jx-" design system: header, hero/intro, jet/prize section — its own type scale, spacing scale and CTA button |
| `src/sections.css` (1,320 lines) | The "product UI" layer: FAQ accordion, boarding-pass ticket, footer — bordered cards, radius, glass panels |
| `src/config.js` | Event copy (name, dates, fees, contacts) |
| `src/intro/Header.jsx`, `Intro.jsx`, `JetSection.jsx`, `JetArt.jsx`, `skyPainter.js` | Header/nav, hero, prize/schedule section, procedurally-painted jet & sky art |
| `src/components/BoardingPass.jsx`, `Faq.jsx`, `Footer.jsx`, `BookFlight.jsx`, `SoundToggle.jsx`, `SkyBackdrop.jsx`, `SiteChrome.jsx` (ScrollFlight, PlaneCursor, FlyOver, reveal system) | The remaining live sections and page-level chrome |
| `src/hooks/`, `src/audio/` | Scroll-progress helpers and a small generative sound engine (not visual, noted for completeness) |

**Important discrepancy found:** `App.css` contains full style blocks for sections that are not imported anywhere in `App.jsx` — e.g. `Prizes: three-jet reveal`, `StatsBar`, `Tracks`, `Domains reveal`, `Globe`, `Timeline` (the old one), `Routes / reach`, `Departure board`, `Baggage allowance`, `CabinLab3D`, a split-flap board, a 3D landing scene. These represent earlier iterations of the site and are **not part of the current visual identity**. This document only documents what is actually rendered today. Where a class name exists in both an active and a dead section, only the active one is documented.

**Also found:** `public/favicon.svg` uses a purple/violet palette (`#863bff`, `#7e14ff`, `#47bfff`, `#ede6ff`) that does not match the site's actual gold/cream/navy palette anywhere else. This looks like a leftover default asset rather than an intentional brand color and should **not** be treated as part of the palette. Flagged here rather than silently included.

---

## 2. Design Philosophy

Elevate 1.0's visual language is a **boarding-pass / flight narrative**, executed with **premium, editorial restraint**. The whole page is structured as a journey: boarding screen → cabin window → open sky → cruising altitude (the brief and features) → a prize "runway" → a literal boarding pass → a "before you board" FAQ. Aviation is not a decorative theme bolted onto a generic hackathon template — it **is** the structural conceit: section transitions are framed as altitude/scene changes, copy uses flight vocabulary ("Gate", "Boarding", "Terminal", "Departure/Arrival"), and motion is built from GSAP ScrollTrigger scrubbing so the page literally flies past as you scroll.

Two visual registers coexist deliberately:

1. **Editorial register** (hero, brief, prize/schedule section): huge, tight-tracked display type, hairline dividers instead of boxed cards, generous whitespace, a design-unit grid that scales fluidly with viewport width. This is where the site feels most premium and most "keynote."
2. **Product-UI register** (FAQ accordion, boarding pass, countdown, footer): bordered cards, 14px/22px radii, soft shadows, a `.container` max-width layout. This is where the site behaves like conventional, trustworthy web UI.

The relationship between the two: the editorial register carries the *brand moment*; the product register carries the *information the visitor actually needs* (dates, FAQs, contact). Neither register uses heavy visual effects to compensate for weak hierarchy — headlines are load-bearing, not decoration.

**In professional terms**, the visual language is: **premium, cinematic, editorial-typographic, quietly technological** — not flashy/neon "hackathon energy," not minimal-to-the-point-of-blank, not corporate-generic. It sits closer to a boutique airline's brand site than a typical dev-event landing page.

---

## 3. Theme & Vibe

**Theme:** A boarding pass for a 24-hour flight into building something real. Aviation, altitude, departure/arrival, cabin windows, clouds, a literal jet.

**Vibe:** Calm confidence, not hype. The visitor should feel like they've opened an actual travel document, not a poster. The dominant emotional register is *anticipation* (waiting to board) rather than *urgency* (a countdown-driven hype site).

**Visual Energy:** **Medium, controlled.** There is real motion everywhere (scroll-scrubbed parallax, a hand-drawn pencil circle animation, a flying plane transition, cloud rendering), but it is slow, eased, and cinematic rather than fast/bouncy/attention-grabbing. Nothing flashes, nothing autoplays a loud animation loop.

**Brand Personality:** Precise, warm, a little playful in small doses (the pencil-circle doodle on "Elevate 1.0" and "everyone," the hidden five-tap plane easter egg, the generative engine-hum sound design), but fundamentally *composed*. Gold accents and serious display type keep it from feeling like a student-club flyer.

**What it should NOT feel like:**
- Not a generic "tech gradient + rocket emoji" hackathon template.
- Not neon/cyberpunk or aggressively futuristic.
- Not flat/corporate SaaS (no default blue, no generic card-grid dashboard look).
- Not loud or meme-driven — no comic sans energy, no confetti-burst CTAs.
- Not cluttered — the editorial sections in particular should always read as spacious.

---

## 4. Color System

All color tokens are defined once, in `src/index.css`, and reused via CSS variables everywhere. A second, section-scoped ink variable is defined in `src/intro/intro.css` for the light (cream) sections.

### Root variables (`src/index.css`, exact)

```css
--bg:        #0a0908;   /* page background, darkest */
--bg-alt:    #121110;   /* slightly lighter dark surface (FAQ, footer) */
--cream:     #f3ede2;   /* primary text on dark */
--cream-dim: #d9d0bf;   /* secondary/muted text on dark */
--gold:      #c9a86a;   /* brand accent */
--gold-dim:  #8a7a5c;   /* muted/secondary gold */
--line:      rgba(243, 237, 226, 0.14); /* hairline dividers on dark */
--cabin:     #14120f;   /* deep cabin-interior tone */
--sky-deep:  #0f3f63;   /* top of sky gradient */
--sky-mid:   #4d8fb5;   /* middle of sky gradient */
--sky-pale:  #cfe3ee;   /* bottom of sky gradient, near-white blue */
```

### Section-scoped variable (`src/intro/intro.css`, exact)

```css
--jx-ink: #312726;  /* body-text color over the light/cream jet section */
```

### Ticket ink (`src/sections.css`, `.bp`, exact)

```css
--ink: #0b1b3a;  /* dark navy text on the white boarding-pass card */
```

### Palette table

| Token | Value | Role | Where it appears |
|---|---|---|---|
| `--bg` | `#0a0908` | Base page background | `<body>`, deepest layer everywhere |
| `--bg-alt` | `#121110` | Elevated dark surface | FAQ section, Footer |
| `--cream` | `#f3ede2` | Primary text on dark | Body copy, FAQ answers, footer copy, sound toggle label |
| `--cream-dim` | `#d9d0bf` | Secondary/muted text on dark | FAQ hint text, modal note text |
| `--gold` | `#c9a86a` | **Primary accent** | Eyebrow labels, "1.0" in wordmarks, FAQ heading, plane icon, CTA highlights, selection color |
| `--gold-dim` | `#8a7a5c` | Muted accent | Hover borders, secondary gold text |
| `--line` | `rgba(243,237,226,0.14)` | Hairline dividers on dark | Card borders, modal fact-row divider |
| `--cabin` | `#14120f` | Deep interior tone | Cabin/plane illustration shading |
| `--sky-deep` | `#0f3f63` | Sky gradient top | Fixed sky backdrop |
| `--sky-mid` | `#4d8fb5` | Sky gradient middle / base sky color | Fixed sky backdrop base |
| `--sky-pale` | `#cfe3ee` | Sky gradient bottom | Fixed sky backdrop, near the horizon |
| `--jx-ink` | `#312726` | Body text on light/cream sections | Jet & prize section text, header text when over a light section |
| `--ink` (ticket) | `#0b1b3a` | Text on the white boarding-pass card | Boarding pass ticket |

### Text colors (roles, not new tokens)

- **Primary text (dark backgrounds):** `var(--cream)` `#f3ede2`
- **Primary text (light/cream sections):** `var(--jx-ink)` `#312726`
- **Secondary/muted text (dark):** `var(--cream-dim)` `#d9d0bf`, or `rgba(49,39,38,0.6)` (`.jx-gray-ink`) on light sections
- **Faint/placeholder text (light sections):** `rgba(49,39,38,0.3)` (`.jx-gray`)
- **Disabled text:** `var(--cream-dim)` on a translucent gold background (see §9 Buttons)
- **Accent/label text:** `var(--gold)` `#c9a86a`, used for eyebrows, numerals, highlighted words

### Border colors

- Dark-surface hairline: `rgba(243, 237, 226, 0.14)` (`--line`)
- Card border, subtle: `rgba(243, 237, 226, 0.12)` (FAQ item, resting)
- Card border, active/open: `rgba(201, 168, 106, 0.35)` (FAQ item, open — gold-tinted)
- Light-section hairline: `rgba(255, 255, 255, 0.45)` (feature card top-rule) / `rgba(49, 39, 38, 0.1)` (ink-toned dividers)
- Pill/badge border: `rgba(201, 168, 106, 0.4)` (footer social icon), `1px solid rgba(243,237,226,0.22)` (sound toggle)

### Status colors

**Not explicitly defined in the current implementation.** There is no success/warning/error/info palette anywhere in the codebase — the site has no form validation states beyond a single disabled-button treatment:

```css
/* disabled CTA (registration not yet open) */
background: rgba(201, 168, 106, 0.28); /* --gold at 28% */
color: var(--cream-dim);
cursor: not-allowed;
```

If success/error states are needed for a new asset (e.g. a form on a poster QR-landing page), they should be **derived**, not invented from scratch: a plausible success tone would sit in the existing sky-blue family (`--sky-mid` `#4d8fb5`) and a plausible error/warning tone is not present anywhere in the palette and would need genuine new-color approval — do not default to generic red/green without checking with the team.

---

## 5. Gradient System

Gradients are used **functionally** — every one of them either represents literal sky/atmosphere or smooths a hard seam between two sections. None are used as decorative fills on cards, buttons, or text.

### Gradient A — Fixed sky backdrop
```
Colors:   var(--sky-deep) → var(--sky-mid) 52% → var(--sky-pale) 100%
Direction: linear, to bottom
Usage:    Full-viewport fixed background (`.sky__grad`) behind the intro/hero
Purpose:  Literal representation of open sky; the base atmosphere layer for the whole opening act
Intensity: Dominant where visible — this is a background layer, so it sits at full strength but only shows through where sections above it are transparent
```

### Gradient B — Jet section → boarding pass handoff ("golden → blue")
```
Colors:   #fff8ed 0% → #e9dfd2 30% → #579bd8 100%
Direction: linear, to bottom
Usage:    `.jx-jet-tail`, the transition strip between the cream prize/schedule section and the blue boarding-pass section
Purpose:  A deliberately seamless color handoff — cream warms into the boarding pass's sky-blue with no hard edge or dark "stopover" band
Intensity: Subtle — this is purely a seam-smoother, not a focal gradient
```

### Gradient C — Jet section area wash (desktop)
```
Colors:   transparent 0–100vh → #fff8ed after 100vh
Direction: linear, to bottom
Usage:    `.jx-jet-area` background (desktop only)
Purpose:  Lets the intro sky keep showing through for the first screen of the jet section, then settles to solid cream — avoids a hard cut between hero and prize section
```
A second, JS-scrubbed overlay (`.jx-light-bg`, `linear-gradient(#7a716e 0% → #fff8ed 100%)`, opacity animated 0→1 via GSAP ScrollTrigger) layers on top for a softer cross-fade. **Mobile equivalent (added during a later pass):** `linear-gradient(transparent 0% → #7a716e 12% → #fff8ed 32%)` on `.jx-jet-area`, proportional rather than viewport-height-based since the mobile layout is unpinned.

### Gradient D — Prize-pool badge/shadow washes
Several small radial/linear washes exist purely as soft-shadow substitutes (e.g. the seat-remaining badge's pill shadow uses layered `box-shadow`, not a gradient fill).

### Gradient E — CTA hover roll
```
Colors:   currentColor-based, low-opacity white overlays
Usage:    Nav item hover backgrounds (`.jx-nav-item__hover`, `rgba(255,255,255,0.15)`)
Purpose:  Functional hover feedback, not decorative
```

### Gradient merging rules (derived from the implementation)

1. **Gradients exist to smooth transitions, not to fill shapes.** Every gradient in the codebase either paints "sky" or bridges a section seam. Do not introduce a gradient fill inside a card, button, or badge — those all use flat fills (`#fff`, `--gold`, `--bg-alt`) with a shadow for depth instead.
2. **The dominant color always wins at the section's resting state.** A section's gradient settles into a single flat tone (cream `#fff8ed`, or the sky's own pale blue) before content is read — gradients animate *into* stability, they don't stay in motion behind static text.
3. **Never introduce a hard color stop between two adjacent sections.** If section A ends dark and section B starts light (or vice versa), bridge them with a gradient tuned to both endpoints (as Gradient B does for gold→blue) rather than a flat cut.
4. **Warm (cream/gold) and cool (sky-blue) families each stay internally consistent.** Cream/gold gradients only ever resolve to more cream/gold or to the specific blue used for the boarding pass; sky gradients only run deep-blue → pale-blue. Don't mix a warm gradient stop directly against a cool one without an intermediate blend stop.
5. **Text always sits on a resolved, high-contrast portion of a gradient**, never on a fast-transitioning band. Headlines and CTAs are positioned where the gradient has already settled (e.g., prize-panel text appears after the wash has reached solid cream).
6. **Keep gradients native, not photographic filters.** Even the "cloud" imagery is procedurally painted (WebGL canvas → blob URL, see `src/intro/skyPainter.js`), not a stock photo — for new print/social assets, a smooth sky-blue-to-pale gradient reads as on-brand; a literal stock cloud photo does not.

---

## 6. Typography System

### Font families (exact, loaded in `index.html`)

```html
Archivo:wdth,wght@62..125,100..900   (variable width + weight)
Orbitron:wght@400..900
Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,300..800
```

Root tokens (`src/index.css`):
```css
--font-display: "Orbitron", "Helvetica Neue", Arial, sans-serif;
--font-body:    "Inter", "Helvetica Neue", Arial, sans-serif;
```
Intro-section token (`src/intro/intro.css`):
```css
--jx-font: "Archivo", "Helvetica Neue", Arial, sans-serif;
```

**Three families, three jobs:**
- **Orbitron** — `h1`–`h4` globally, plus every "technical readout" moment: the section titles ("Before you board."), the countdown numerals, the footer wordmark. Geometric, slightly technical/aviation-instrument feeling. Always uppercase, always tracked out.
- **Inter** — the default body font for everything in the product-UI register (FAQ answers, footer copy, modal text).
- **Archivo** (variable, `font-stretch: 125%`, weight 500 default) — the *entire* intro/hero/jet section. This is the "editorial" voice: huge, tightly tracked (`letter-spacing: -0.08em` on the biggest sizes), never uppercase, sentence case throughout.

No monospace font is used anywhere in the implementation.

### Global base

```css
html { font-size: 138%; }               /* root rem scale */
@media (max-width: 760px) { html { font-size: 118%; } }
h1, h2, h3, h4 {
  font-family: var(--font-display);      /* Orbitron */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
```
Every `rem` value on the site is relative to this 138%/118% root scale — it is a **global zoom**, not a per-component choice.

### Type scale — editorial register (Archivo, `src/intro/intro.css`)

All sized with `calc(N * var(--u))` where `--u` is a fluid design unit (`100vw / 1440` desktop, `/720` ≤991px, `/420` ≤479px) — i.e. every one of these sizes is genuinely fluid, not just responsive-by-breakpoint.

| Class | Size (desktop, 1440px basis) | Weight | Line-height | Letter-spacing | Use |
|---|---|---|---|---|---|
| `.jx-h1` | `104 * u` (~104px) | 500 | 0.84 | −0.08em | Prize-pool numeral heading ("Prize Pool") |
| `.jx-h2` | `72 * u` (~72px) | 500 | 0.88 | −0.08em | Secondary large heading (e.g. "Timeline", "Tracks") |
| `.jx-p2` | `64 * u` (~64px) | 500 | 1 | −0.08em | Large numeral/stat text |
| `.jx-brief` | `max(22px, 40 * u)` | 500 | 1.22 | −0.04em | The hero paragraph, justified, hyphenated |
| `.jx-p5` | `24 * u` | 500 | 1 | −0.064em | Sub-labels ("Podium finish") |
| `.jx-p7` / `.jx-t7` | `max(12.5px, 12 * u)` | 500 / 700 | 1.333 | −0.032em | Body copy / nav & CTA labels |
| `.jx-l1` | `max(10px, 10 * u)` | 700 | 1.2 | −0.032em, **uppercase** | Tiny eyebrow-style labels within the jet section |
| `.jx-logo` | `22 * u` desktop / `29 * u` ≤991px | 300 (400 wt "1.0" span at 500) | tight | 0.03em | Header wordmark |

### Type scale — product-UI register (Orbitron/Inter, `src/App.css` / `src/sections.css`)

| Type | Font | Weight | Size | Line-height | Case |
|---|---|---|---|---|---|
| Eyebrow label | Orbitron | 700 | `0.85rem` | — | uppercase, `letter-spacing: 0.3em` |
| Section title (e.g. "Before you board.") | Orbitron (inherits `h2`) | 600 | `clamp(2.5rem, 4.6vw, 3.9rem)` | — | uppercase |
| FAQ question (accordion summary) | Inter (body default) | 600 | `1.02rem` | — | sentence case |
| FAQ answer | Inter | default | body default | 1.6 | sentence case |
| Countdown numerals | Orbitron | inherits h-weight | `1.35rem` | tabular-nums | — |
| Countdown label ("Gates open in") | Inter | default | `0.72rem` | — | uppercase, `letter-spacing: 0.22em` |
| Footer wordmark | Orbitron | 700 | inherited | — | `letter-spacing: 0.12em` |
| Modal title | Inter | default | `1.6rem` | — | sentence case |
| Button/CTA text ("Register your team") | Archivo (`.jx-t7`) | 700 | `max(12.5px, 12*u)` | 1.333 | sentence case |

**Hierarchy summary:** display numerals and section headers are always Orbitron/Archivo at large, tightly-tracked sizes; supporting/informational copy is always Inter at conservative sizes (0.7–1rem); labels/eyebrows are always small, bold, wide-tracked, and either gold or a muted ink tone.

---

## 7. Layout & Spacing

**Two parallel layout systems**, matching the two visual registers:

### A. `.container` system (product-UI register)
```css
.container { width: min(1240px, 90vw); margin: 0 auto; }
```
Used by BoardingPass, FAQ, Footer. Fixed max-width, centered, simple.

### B. `--jx-pad` / `--u` fluid system (editorial register)
```css
--u:      calc(100vw / 1440);   /* desktop */
--jx-pad: calc(96 * var(--u));  /* side padding, desktop ≈ 96px at 1440w */
--jx-gap: calc(12 * var(--u));  /* grid gutter */

@media (max-width: 991px) { --u: calc(100vw / 720);  --jx-pad: calc(40 * var(--u)); }
@media (max-width: 479px) { --u: calc(100vw / 420);  --jx-pad: calc(20 * var(--u)); }
```
Used by Header, Intro, JetSection. Full-bleed (no max-width container) — every spacing and font value scales continuously with viewport width via this one `--u` unit, with two step-changes in the *rate* of scaling at 991px and 479px (not the values themselves — the whole unit re-bases at those breakpoints).

A 7-column grid (`.jx-grid { grid-template-columns: repeat(7, minmax(0,1fr)); column-gap: var(--jx-gap) }`) underlies the jet/prize section's three-column layout (left col spans tracks 1–3, right col 6–8, center col 3–6 — i.e. a symmetric 2 / 3 / 2 split).

### Vertical rhythm (product-UI register, `src/App.css`)
```css
--section-y: clamp(5.5rem, 11vw, 9.5rem);  /* section vertical padding */
```
Spacer utility classes in the editorial system: `.jx-u12`, `.jx-u24`, `.jx-u36`, `.jx-u96`, `.jx-u156`, `.jx-u216` — each `calc(N * var(--u))`, i.e. a fluid 12/24/36/96/156/216-unit spacer scale.

### Spacing scale actually observed (rem, product-UI register)
```
0.3rem  0.4rem  0.5rem  0.6rem  0.7rem  0.8rem  0.9rem
1rem    1.2rem  1.4rem  1.5rem  1.6rem  2.2rem  2.6rem
```
This is **not a strict 4/8pt grid** — values cluster loosely around a base-8px-ish rhythm but are tuned per-component rather than snapped to a hard token scale. Treat 0.5rem/1rem/1.5rem/2.5rem as reasonable safe defaults when extending the system; don't assume finer precision than that exists.

### Mobile vs. desktop spacing philosophy
- The editorial system scales *continuously* (fluid `--u`), so there is no separate "mobile spacing scale" — the same numbers apply, just computed against a narrower viewport with a re-based unit.
- The product-UI system uses explicit breakpoint overrides (`max-width: 991px`, `760px`, `900px`, `520px`, etc.) that typically collapse multi-column grids to one column and reduce `clamp()` minimums.
- Content density is **low-to-medium**: generous section padding (`--section-y` never drops below `5.5rem`), single-column stacking on mobile rather than cramming.

---

## 8. Border Radius System

| Value | Where used | Role |
|---|---|---|
| `999px` (pill) | CTA button, sound toggle, footer social icon, modal submit button, eyebrow pill on boarding pass | **Pills/badges/primary buttons** |
| `22px` (with asymmetric corners, e.g. `22px 0 0 22px`) | Boarding-pass ticket card | **Major "physical object" containers** |
| `14px` | FAQ accordion item, countdown pill container | **Cards** |
| `10–12px` | Booking modal panel, countdown number chips | **Secondary containers/controls** |
| `6–8px` | Nav-item hover background | **Small interactive controls** |
| `50%` | Circular icon backgrounds (footer social icons' inner mark) | **Circular/avatar shapes** |
| `2–4px` | Fine details (accordion plus-icon strokes, tiny chips) | **Micro elements** |

**Hierarchy:** pill (999px) for anything clickable and prominent → 14–22px for card-like containers, larger radius for a "bigger" or more physical object (the ticket gets the largest card radius of anything) → single-digit px only for tiny sub-elements. Nothing in the live implementation uses a sharp 0px radius as a deliberate style choice.

---

## 9. Buttons

Two real button/CTA patterns exist in the live site (plus one primary-action variant inside the modal). There is no documented "outline," "ghost," or "destructive" button anywhere in the implementation — do not invent them.

### Primary CTA — "Register your team" pill (`.jx-cta__btn`, floating, bottom-center, always visible)
```
Structure: a white pill wrapped in a translucent white "chrome" ring
Background: #fff
Text color: var(--jx-ink) #312726
Radius:    calc(36 * var(--u)) inner pill / calc(60 * var(--u)) outer ring — effectively fully rounded
Padding:   calc(8 * u) calc(20 * u)
Shadow:    layered soft shadow, 5 stops from 0 → 0 8px 17px rgba(0,0,0,0.08)
Typography: .jx-t7 (Archivo, 700, small)
Icon:      paper-plane glyph, doubled and roll-animated on hover
Hover:     the label and icon each "roll" upward (translateY(-100%)) to reveal a duplicate — a 0.6s cubic-bezier(0.25,1,0.5,1) transition, not a color change
Position:  position: fixed, bottom: calc(36*u), centered, z-index 98 — persists across the whole page
```

### Secondary control pill — Sound toggle (`.sound`)
```
Background: rgba(12, 14, 16, 0.72) + backdrop-filter: blur(8px)
Border:    1px solid rgba(243,237,226,0.22), gold-tinted (rgba(201,168,106,0.6)) when active
Radius:    999px
Text:      var(--cream), 0.8rem
Shadow:    0 10px 30px rgba(0,0,0,0.35)
Hover:     border-color → var(--gold-dim)
Active/on state: 3 small animated equalizer bars in var(--gold) appear (soundbar keyframe, 0.9s ease-in-out infinite)
```
Use pattern: this is the template for any **secondary/utility floating control** (mute, a settings toggle, etc.) — dark glass pill, thin gold-tinted border, no fill change on hover, just border + content change.

### Primary action button — Modal submit ("Register on Unstop") (`.bookmodal__submit` / `RegisterButton`)
```
Background: var(--gold) #c9a86a (solid fill — the one place gold is used as a button fill, not just an accent)
Text color: #0a0908 (near-black, for contrast on gold)
Radius:    999px
Padding:   0.85rem 1.6rem
Hover:     opacity: 0.85 (simple fade, no motion)
Disabled:  background rgba(201,168,106,0.28), color var(--cream-dim), cursor: not-allowed
           (This is the site's only "registration not open yet" state — see `registrationOpen()` in config.js)
```

### When to use which
- **Floating white pill CTA** — the single persistent "take action" button for the whole page. Use once per experience, not per-section.
- **Dark glass pill** — secondary, non-critical toggles/utilities that shouldn't compete with the primary CTA.
- **Solid gold pill** — the actual conversion action inside a focused context (a modal/form), where gold-as-fill is appropriate because there's no competing gold text nearby.

**Not documented / do not invent:** outline buttons, ghost buttons, icon-only buttons (other than the sound toggle, which is icon+label), destructive/red buttons.

---

## 10. Navigation

### Desktop header (`src/intro/Header.jsx` + `.jx-header`)
```
Height:      calc(24 * var(--u)) content row + calc(24*u) top/bottom spacers
Layout:      3-column grid (nav left / logo center, grid-column:2 / CTA right), fixed, top:0
Background:  transparent by default; a ::before pseudo-element adds backdrop-filter: blur(14px)
             with a top-to-40%-then-transparent mask-image — a soft frosted band, not a hard bar
Logo:        "Elevate" (weight 300) + "1.0" (weight 500, 0.3em left margin), text-shadow for
             legibility over photographic sky backgrounds
Nav items:   .jx-nav-item, text-only, roll-up hover (see Interactions), no active-state underline
             documented in the implementation
Ink mode:    header text switches from white to var(--jx-ink) (#312726) via .jx-header--ink /
             .jx-header--light-bg classes, toggled by scroll position, whenever a light/cream
             section is under the header
CTA in nav:  "Schedule" link + the organiser's Instagram handle, right-aligned
```

### Mobile header (≤991px)
```
Height:      calc(40 * var(--u)) content row (taller than desktop's 24u)
Logo size:   calc(29 * var(--u)) (up from 22u desktop)
Nav/CTA:     hidden entirely (.jx-desktop utility), replaced by a hamburger button (.jx-menu-btn)
             placed in the nav's grid slot
Background:  solid, always-opaque rgba(13,12,11,0.88) + blur(10px) — NOT the desktop fade. This
             was a deliberate fix: the soft fade wasn't enough contrast against busy mobile
             content scrolling underneath a fixed header on real devices.
Text color:  locked to white always on mobile (ink-mode switching disabled), since the bar is
             now permanently dark
Mobile menu: a full-width dropdown panel (.jx-mobile-menu) — rgba(18,17,16,0.92) background,
             backdrop-filter: blur(18px), slides down (translateY -12px → 0) + fades in
             (0.4s / 0.3s), with a semi-transparent backdrop (rgba(0,0,0,0.4)) that closes the
             menu on tap. Body scroll locks (html.jx-menu-open { overflow: hidden }) while open.
Hamburger:   3-bar icon that morphs into an X (two bars rotate ±45°, middle bar fades) on open
```

### Sticky/fixed behavior
The header is `position: fixed` at all viewport sizes — it never scrolls away. A separate, always-visible flight-path progress bar (`.flightbar`, see §14) sits above/alongside it as a second fixed element (`position: fixed; top: 0; height: 22px; z-index: 70`), showing scroll progress as a dashed "DEP ⋯✈⋯ ARR" line.

---

## 11. Components

### Inventory of components actually present in the live site

| Component | File | Purpose |
|---|---|---|
| Header / nav | `intro/Header.jsx` | Site navigation, wordmark, mobile menu |
| Flight-path progress bar | `components/SiteChrome.jsx` (`ScrollFlight`) | Whole-page scroll progress, top of viewport |
| Sky backdrop | `components/SkyBackdrop.jsx` | Fixed atmospheric background behind the hero |
| Intro / hero | `intro/Intro.jsx` | Boarding screen → cabin window → sky → brief + 2 feature cards |
| Jet / prize section | `intro/JetSection.jsx` | Prize pool, schedule/timeline, tracks, cabin seat map |
| Boarding pass | `components/BoardingPass.jsx` | The literal ticket card, QR, countdown |
| FAQ accordion | `components/Faq.jsx` | 5-question `<details>`-based accordion with a plane-flight reveal transition |
| Footer | `components/Footer.jsx` | Brand blurb, social icons, sitemap links, contact list |
| Register CTA + modal | `components/BookFlight.jsx` | Persistent floating CTA, opens a registration-summary modal |
| Sound toggle | `components/SoundToggle.jsx` | Mute control for the generative ambient sound engine |
| Plane cursor | `components/SiteChrome.jsx` (`PlaneCursor`) | Custom cursor (fine-pointer devices only) that banks toward travel direction |
| Fly-over easter egg | `components/SiteChrome.jsx` (`FlyOver`) | Hidden animation triggered by tapping the wordmark 5×|

### Per-component notes not already covered elsewhere

**FAQ accordion item**
```
Container:  border 1px rgba(cream,0.12), radius 14px, bg rgba(cream,0.03)
Open state: bg rgba(gold,0.07), border rgba(gold,0.35) — no layout shift, just a tint
Summary:    flex row, space-between, 1.15rem/1.3rem padding, 1.02rem/600 weight text
Icon:       a hand-built "+"  from two absolutely-positioned lines; the vertical line rotates
            to 0° (merging into a "−") when open — pure CSS transform, 0.3s ease
Transition: background/border-color 0.3s ease only — no height/max-height animation documented
            (native <details> toggle)
```

**Countdown ("Gates open in")**
```
Container: rgba(18,32,43,0.86) pill, 14px radius
Each unit:  its own rgba(255,255,255,0.07) chip, 8px radius, Orbitron tabular-nums numeral
Label:      0.72rem, 0.22em tracking, uppercase, #b9d3e2 (a cool ice-blue, distinct from the
            gold/cream palette used elsewhere — scoped only to this component, on the blue
            boarding-pass section)
```

**Booking modal**
```
Backdrop:  rgba(5,4,3,0.72) + blur(4px)
Panel:     var(--bg-alt), 1px solid var(--line), radius 10px, 2.6rem/2.2rem padding,
           max-width 440px, centered
Structure: eyebrow → title (1.6rem) → lead paragraph → 2-column fact grid (dates / team size)
           → solid gold submit pill → small print note
```

**Custom pencil-circle annotation** (signature micro-interaction, `Intro.jsx` + `.jx-circled`)
```
A hand-drawn-looking SVG loop drawn around "Elevate 1.0" and "everyone" in the hero paragraph,
stroke-gold, animated on scroll via stroke-dasharray reveal (1.4s, custom "InOut" ease,
staggered 0.15s per circle). This is a distinctive, reusable brand motif — a pencil circle
around an emphasized word — and should be treated as a signature device, not a one-off.
```

---

## 12. Cards & Surfaces

There are **two card languages** in the live site, matching the editorial/product split:

### Editorial "cards" — hairline dividers, no box
```
.jx-feature: border-top: 1px solid rgba(255,255,255,0.45); no background, no radius, no shadow.
```
Used for the two feature cards ("Round one, online" / "Round two, on campus") and prize list rows. These are **not** boxed cards — they're separated by a rule above the content, keeping the editorial section feeling like a printed page, not a UI kit.

### Product-UI cards — bordered, radius, tinted
```
FAQ item:        border 1px rgba(cream,0.12) → gold-tinted on open, 14px radius, translucent
                  cream fill (0.03 → 0.07 opacity)
Boarding pass:    22px radius (one side), off-white #fbfcfd fill, dramatic soft shadow
                  (0 30px 50px rgba(6,22,44,0.35)), perforation cut via CSS mask, opacity+
                  translateY entrance (0.8s/0.9s ease)
Booking modal:    var(--bg-alt) fill, 1px var(--line) border, 10px radius, no shadow
                  (backdrop blur does the separation work instead)
Countdown pill:   rgba(18,32,43,0.86) fill, 14px radius, no border, no shadow
```
No card in the live implementation uses a heavy drop shadow *and* a strong border at the same time — it's shadow-for-depth **or** border-for-definition, rarely both at full strength (the boarding pass, the one exception, uses a subtle border-equivalent via its mask cutout, not an actual stroked border).

**Grouping rule (derived):** related cards (FAQ items, feature pairs) are separated by consistent gaps (0.7rem for FAQ, `calc(24*u)`/`calc(48*u)` for features) rather than by increasing border weight or shadow — spacing does the grouping work, not visual noise.

---

## 13. Icons & Imagery

### Icons
No external icon library is used — **every icon in the codebase is a hand-authored inline SVG**, generally simple, stroke-or-fill, 14–24px viewBox range, `currentColor` or a single named fill. Recurring glyphs:
- A dart/plane silhouette (`M22 12 L3 5 L6 12 L3 19 Z`) — used identically in the flight-path bar, boarding-pass route arrow, and CTA icon. This exact path is a **reusable brand glyph**, not a one-off.
- A more detailed shaded jet silhouette (fuselage + swept wing + tail fin + engine pod + cockpit tint, built from a handful of `<path>`/`<ellipse>` elements with a two-stop gradient) — used for the larger "flying" moments (FAQ transition).
- Simple line icons for sound (speaker + waves/mute cross) and menu (three bars → X).
- Brand-accurate Instagram (gradient ring camera glyph) and LinkedIn ("in" badge) marks in the footer, built as precise inline SVGs matching the real platform marks.

**Style rule:** icons are minimal, geometric, mono-color (or a two-stop metallic gradient for the "hero" jet only) — never multi-color illustration style, never filled emoji, never a mismatched icon-library aesthetic.

### Images
There are **no photographic images** in the live implementation. All "sky," "cloud," and "jet" imagery is **procedurally painted at runtime** via WebGL (`src/intro/skyPainter.js`) into a canvas, exported as a blob URL, and rendered as an `<img>`. This is a core, distinctive technical/visual choice: the same painting function is reused with matching `seed`/`mode` parameters across different components so that, e.g., the hero's cabin-window sky and the boarding-pass background are *the same* sky continued, not two different stock images.

**Implication for new assets:** if a poster/social creative needs a "sky" background, it should be a smooth painted-gradient sky (matching the `--sky-deep/mid/pale` stops) — never a literal stock photo of clouds, which would visually clash with the site's painted aesthetic.

### Illustrations / recurring motifs
- The **jet aircraft** (top-down photorealistic-ish illustration with metallic gradient shading, built in `JetArt.jsx`) is the closest thing to a "hero illustration" the brand has.
- The **boarding-pass ticket** shape (torn stub, perforated edge, QR code) is a recurring physical-object motif.
- The **pencil-circle annotation** (§11) is a recurring hand-drawn accent.
- **Dashed lines** (flight-path route, ticket route arrow) recur as a "flight path" visual motif — always gold or gold-tinted, always horizontal or diagonal, never a decorative border.

---

## 14. Interactions & Motion

The whole site is driven by **GSAP + ScrollTrigger** (scroll-scrubbed, not autoplay) plus **Lenis** for smooth scrolling. Almost nothing animates on a timer; almost everything animates against scroll position.

| Interaction | Trigger | Behavior | Duration / Easing | Purpose |
|---|---|---|---|---|
| Nav item hover | mouse hover | Label + underlying pill both translateY(-100%) to reveal a duplicate label / hover-tint layer | 0.6s `cubic-bezier(0.25,1,0.5,1)` | Tactile, "rolling" feedback without a color swap |
| CTA button hover | mouse hover | Label and plane icon (doubled) roll up the same way | 0.6s `cubic-bezier(0.25,1,0.5,1)` | Consistent hover language across all pill buttons |
| Pencil-circle reveal | scroll into view (85% trigger) | `stroke-dashoffset` animates the SVG loop from fully hidden to fully drawn | 1.4s, custom ease `"InOut"`, staggered 0.15s per circle | Hand-drawn emphasis on key words |
| Section-wide scroll reveal | element enters viewport (IntersectionObserver, `data-reveal`) | `opacity: 0 → 1`, `translateY(30px) → none` | CSS-driven, not JS-timed | Generic "fade up" entrance used sitewide |
| FAQ plane wipe | scroll into view | A shaded jet flies left→right across the section while a `clip-path: inset()` wipe reveals the FAQ content behind it | 1.3s `cubic-bezier(0.65,0,0.35,1)` | Ties the FAQ section into the flight narrative rather than a plain fade |
| Jet shrink / schedule slide (desktop) | scroll-scrubbed (pinned section) | Jet scales 1 → 0.4 and shifts up; prize panel slides out below as the schedule slides in from above | scrub-linked (no fixed duration), `ease: "In"`/`"none"` | Cinematic, altitude-change feeling as prizes give way to the schedule |
| Cabin reveal | scroll-scrubbed | A CSS custom property `--swap` interpolates 0→1, cross-fading the jet photo into a seat-map illustration; seats light up tail-first, staggered | scrub-linked | "The photo becomes the floor plan" — a signature transition |
| Boarding-pass tear | element ~45% in view | The ticket stub gets an `.is-torn` class after a short delay, triggering a perforation-tear visual + an audio "stamp" cue | 900ms delay (0ms if reduced-motion) | Mimics physically tearing a boarding pass |
| Plane cursor | mousemove (fine pointer only) | A small plane glyph eases toward the cursor position (`0.28` lerp) and banks to face the direction of travel; scales/tints when hovering an interactive element | continuous rAF loop | A subtle, non-essential brand touch — explicitly disabled for touch devices and `prefers-reduced-motion` |
| Fly-over easter egg | 5 taps on the wordmark | A large gold jet crosses the screen diagonally with a chime + whoosh sound | one-shot | Hidden delight, not part of the primary flow |
| Hover ticks (sound) | hovering any link/button | A quiet UI "tick" sound cue, throttled to 70ms | — | Audio micro-feedback, silent when sound is off |

**Reduced motion:** every major animation module checks `prefers-reduced-motion` and either skips straight to the end state or disables the effect entirely (pencil circles, plane cursor, FAQ wipe, boarding-pass tear all have explicit reduced-motion fallbacks).

---

## 15. Responsive Design

### Breakpoints actually used in the codebase
```
1440px  — design basis for the fluid --u unit (not a hard breakpoint)
991px   — primary mobile/desktop split (nav collapses to hamburger, --u re-bases, most
          multi-column layouts stack)
900px   — secondary content-grid collapse point (boarding pass grid, experience grid)
860px   — FAQ grid collapses to one column
760px   — root font-size drops from 138% → 118%; several two-column grids stack
700px   — a small number of narrower layout tweaks
600px   — FAQ plane sizing/positioning tier (superseded — see note below)
560/520px — fine-grained mobile tweaks (boarding-pass card, experience grid → 1 col)
479px   — --u re-bases a second time (smallest design-unit tier); features grid forces 1 column
```
**Note:** the FAQ plane's clearance logic originally only special-cased `max-width: 600px`; an audit across ~20 device widths found it still collided with the header between 600–991px (the header itself grows taller with viewport width in that range). That rule was widened to the full `max-width: 991px` bucket — a good example of "the breakpoint list looks fine on paper but must be checked against the *other* things that also change at each width."

### What changes at each tier

| | Desktop (>991px) | Mobile (≤991px) |
|---|---|---|
| Navigation | Full inline nav + CTA links | Hamburger → full-width dropdown menu |
| Header background | Soft fading blur | Solid opaque dark bar |
| Header height | `24 * u` | `40 * u` (taller) |
| Jet/prize section | Pinned, 400vh scroll-jacked, 3-column grid, jet scales/slides | Unpinned, `display: contents` flex stack, simpler per-element scroll triggers |
| Prize amounts | Stacked list | Same list, occasionally reflows to inline label+amount rows below 480px |
| Features grid | 2 columns always (down to phone width) | 2 columns until 479px, then 1 column |
| Boarding pass | 2-column grid (ticket + countdown) | 1 column, stub re-oriented from vertical to horizontal-top |
| FAQ grid | 2 columns (heading | list) | 1 column below 860px |
| Root type scale | 138% | 118% (below 760px) |

### Mobile-specific fixes worth noting as precedent
- The mobile header needed a **solid** background, not the desktop's translucent fade, because real-device testing showed insufficient contrast against busy scrolling content.
- The mobile jet-section background needed to stay **scroll-reactive** (a proportional gradient + the same JS-driven light-wash used on desktop) rather than a single pre-mixed flat gradient — the first mobile implementation lost the "color transformation" scroll effect entirely.

---

## 16. Design Direction

- **Alignment:** predominantly left-aligned body/label text; headline blocks are sometimes centered as a unit (e.g. the hero brief paragraph) while the text itself stays justified/left-ragged inside that centered block — never fully centered running text.
- **Content flow:** strictly top-to-bottom, single-column narrative at the page level (this is a scrollytelling site, not a dashboard) — even the 3-column jet section is a *temporary* horizontal arrangement inside an otherwise vertical flow.
- **Visual hierarchy:** size + weight + color (gold) carry hierarchy, not boxes. The biggest, boldest, most tightly-tracked type is always the thing the visitor should read first (prize amounts, "Before you board.", the wordmark).
- **Grid direction:** the 7-column jet-section grid is left-to-right symmetric (2 / 3 / 2), reinforcing a literal "flight path" left-to-right reading of DEP → cabin → ARR.
- **Image/graphic placement:** the jet illustration is always vertically centered as a spine that the surrounding content arranges around, not a background image behind text.
- **CTA positioning:** the primary CTA is **fixed, bottom-center, page-level** — not embedded per-section. Sections don't each get their own "Register" button; there is one persistent point of action.
- **Section transitions:** every major seam is treated as a deliberate visual event (color wash, wipe, scale) rather than a plain cut — this is the single most consistent directional rule in the codebase.

---

## 17. Component Styling Rules

Derived directly from what's consistently done (and not done) across the implementation:

- **Use borders** for small, resting-state UI (FAQ cards, modal panel, sound toggle) at low opacity (`rgba(cream, 0.12–0.22)`); strengthen to a gold tint only on an active/open state — never a bright, high-contrast border by default.
- **Use shadows** for anything meant to feel like a physical object lifted off the page (the boarding pass, the CTA pill) — soft, large-radius, low-opacity black shadows (`rgba(0,0,0,0.3–0.45)`), never a sharp/hard shadow.
- **Use gradients** only for atmosphere and seams (§5) — never as a button/card fill.
- **Use solid backgrounds** for anything meant to read as stable UI chrome (dark surfaces `--bg`/`--bg-alt`, the white boarding-pass card, the solid gold submit button).
- **Use transparency/blur (`backdrop-filter`)** for anything that floats *over* other content and needs to stay legible without fully blocking it (header, sound toggle, mobile menu, modal backdrop) — but on mobile, prefer near-opaque (0.85–0.92 alpha) over the desktop's lighter touch, since real-device testing showed low-alpha blur isn't reliably legible.
- **Use the gold accent sparingly and specifically**: eyebrow labels, the "1.0" in wordmarks, one emphasized word per paragraph (via the pencil circle), icons that represent "flight," and exactly one button fill (the modal's primary submit). Gold is a **highlight**, never a base color for large surfaces.
- **Decoration budget is low.** No component in the live site layers more than 2 of {border, shadow, gradient, blur} at once. If a new asset wants 3+, that's a signal to simplify.

---

## 18. Do's and Don'ts

### DO
- Maintain the warm gold/cream-on-dark palette as the default register; use the cream/ink-on-light palette only for "sky/cabin daylight" moments, matching how the site itself alternates.
- Preserve the Orbitron (display/technical) vs. Archivo (editorial) vs. Inter (body) split — don't substitute one for another's job.
- Keep the pill (999px) radius for anything clickable; keep 14–22px for card-like containers.
- Use the dart/plane glyph (`M22 12 L3 5 L6 12 L3 19 Z`) as the canonical "flight" icon when a simple mark is needed.
- Treat section/slide transitions as an opportunity for a "flight" moment (a wash, a wipe, a scale) rather than a plain cut, when producing multi-slide/multi-panel assets (PPTs, carousels).
- Keep CTAs singular and clear — one obvious primary action per composition, styled as a solid or white pill.
- Maintain generous whitespace in editorial/headline moments; don't compress the hero-style type scale into cramped space.

### DON'T
- Don't introduce colors outside the documented palette (no default blues/greens/reds, no purple — despite what the stray favicon suggests).
- Don't mix a warm (gold/cream) gradient directly against a cool (sky-blue) one without a blended transition stop.
- Don't use hard drop shadows or heavy dark borders together on the same element — the site never combines them at full strength.
- Don't set body/paragraph text in Orbitron, or headlines in Inter — the two are never swapped.
- Don't overcrowd a layout with multiple bordered cards competing for attention; the site relies on spacing and hairline rules, not stacked boxes, in its most premium moments.
- Don't use more than one accent color at a time — gold is the only accent; don't add a second "pop" color for variety.
- Don't apply the desktop's soft/translucent header treatment to a mobile or print context where legibility over busy content matters — use the solid/near-opaque variant instead.
- Don't invent status colors (success/error/warning) — none exist in the current system; get explicit sign-off before adding them.

---

## 19. General Design Guidelines (for any new Elevate 1.0 asset)

To make a PPT, poster, Instagram post, certificate, or banner immediately read as Elevate 1.0:

1. **Background:** default to near-black (`#0a0908`/`#121110`) or, for a "daylight" variant, warm cream (`#fff8ed`/`#f3ede2`) — never a neutral gray or white-by-default canvas.
2. **Typography:** headline in Orbitron, uppercase, bold, tracked out; body copy in Inter; if an "editorial/premium" moment is wanted (a title slide, a hero banner), use tight-tracked, large, sentence-case display type in the spirit of Archivo at `letter-spacing: -0.04em` to `-0.08em`.
3. **Accent color:** gold (`#c9a86a`) and only gold — for the emphasized word/number, a rule line, an icon, or a single button fill.
4. **Composition:** generous margins, one clear focal element (a headline, a number, a single icon), asymmetric or centered-block layouts rather than dense grids.
5. **Contrast:** always pair cream/white text with the dark backgrounds, and dark ink (`#312726`) text with the cream background — never gold-on-gold or low-contrast gray-on-gray.
6. **Gradients:** if used at all, keep them atmospheric (a sky wash) or a seam-blend between two flat colors already in the palette — never a decorative fill inside text, icons, or buttons.
7. **Imagery:** prefer a painted/illustrated sky or the jet silhouette over any stock photography; if a photo must be used, keep it desaturated/toned to sit near the palette.
8. **Icons:** simple, single-color line/fill glyphs; the dart-plane mark is the safest universal icon to reuse.
9. **CTA treatment:** a single pill-shaped button (white-on-dark or gold-on-dark), never more than one call to action per composition.
10. **Hierarchy:** size and weight do the work — don't rely on color variety or boxes to separate content.
11. **Consistency:** reuse the exact hex values in §4 rather than eyeballing "close enough" gold/cream — the palette is intentionally narrow, and its narrowness is part of the brand.
12. **Accessibility/readability:** the site's own ratios lean high-contrast (cream `#f3ede2` on `#0a0908` ≈ 15:1; ink `#312726` on cream ≈ 10:1) — match or exceed that in any new asset; avoid gold-on-cream or gold-on-dark-gray combinations, which fall short of comfortable contrast.

---

## 20. Brand Translation Beyond the Website

### Presentations (PPT)
- **Title slide:** near-black background, Orbitron uppercase title (large, tracked out), "Elevate" in cream + "1.0" in gold (matching the wordmark's exact color split), a thin gold dashed rule (echoing the flight-path bar) as a decorative underline.
- **Content slides:** cream-on-dark body text in Inter, Orbitron for slide headers, gold for the one number/stat that matters on the slide. Keep slide backgrounds flat and dark — reserve the sky gradient for section dividers only.
- **Section dividers:** use the sky gradient (`--sky-deep → --sky-mid → --sky-pale`) full-bleed, with a large Orbitron section title in white/cream, mimicking the site's own "altitude change" section transitions.
- **Diagrams:** hairline gold or cream-at-14%-opacity lines for connectors, flat fills (no gradients) for shapes, pill shapes for any "stage/step" labels.

### Social Media
- **Post backgrounds:** dark (`#0a0908`) by default; use the cream/gold-wash variant for announcement-style posts (dates, deadlines).
- **Thumbnails:** keep a single dominant focal element (a number, a headline word circled in the pencil-motif style) — the site's own restraint (one accent color, one focal size jump) translates directly to a scroll-stopping single-message post.
- **Reels/carousel covers:** reuse the dart-plane icon or a simplified jet silhouette as a recurring corner mark for series recognition.

### Posters
- **Hierarchy:** event name (Orbitron, largest) → one key stat or date (gold, second-largest) → supporting details (Inter, small, cream-dim) → CTA (pill shape, bottom or corner-anchored, echoing the site's fixed-CTA placement).
- **CTA placement:** bottom-anchored, pill-shaped, high-contrast — matching the website's own persistent bottom-center CTA convention.

### Certificates
- **Formal but on-brand:** cream/off-white background (not the site's darkest tone — certificates read better light), navy or dark-ink text (matching the boarding-pass ticket's `#0b1b3a` ink-on-white treatment, which is already the site's own "formal document" register), a thin gold rule, Orbitron for the certificate title and recipient name, Inter for body text. The boarding-pass ticket is the closest existing precedent for a "formal printed document" in this brand — use it as the template, not the dark hero sections.

### Documents
- **Headings:** Orbitron, uppercase, gold or dark-ink depending on light/dark mode of the document.
- **Body:** Inter, generous line-height (1.5–1.6, matching the site's own body copy).
- **Color use in print:** restrict to gold + ink/cream + one neutral — the site's restraint should carry over; don't add color just because print allows more ink.

---

## 21. Design Tokens (consolidated reference)

### Colors — Exact
```
--bg:        #0a0908
--bg-alt:    #121110
--cream:     #f3ede2
--cream-dim: #d9d0bf
--gold:      #c9a86a
--gold-dim:  #8a7a5c
--line:      rgba(243, 237, 226, 0.14)
--cabin:     #14120f
--sky-deep:  #0f3f63
--sky-mid:   #4d8fb5
--sky-pale:  #cfe3ee
--jx-ink:    #312726
ticket ink:  #0b1b3a
ticket bg:   #fbfcfd
countdown bg: rgba(18, 32, 43, 0.86)
countdown label: #b9d3e2
```

### Typography — Exact
```
Display: "Orbitron", "Helvetica Neue", Arial, sans-serif   (weight 600–700, uppercase)
Body:    "Inter", "Helvetica Neue", Arial, sans-serif        (weight 400–600)
Editorial: "Archivo" variable, font-stretch 125%              (weight 500–700)
Root scale: 138% (118% ≤760px)
```

### Spacing — Approximate (rounded to the nearest common value observed)
```
0.3rem · 0.5rem · 0.7rem · 1rem · 1.2rem · 1.5rem · 2.2rem · 2.6rem
--section-y: clamp(5.5rem, 11vw, 9.5rem)
Fluid unit: calc(100vw / 1440|720|420)  — editorial register only
```

### Radius — Exact
```
999px (pill) · 22px (ticket) · 14px (card) · 10–12px (secondary) · 6–8px (control) · 50% (circle)
```

### Shadows — Exact (most common)
```
0 26px 60px rgba(0, 0, 0, 0.45)     — heaviest, hero-adjacent elements
0 10px 30px rgba(0, 0, 0, 0.35)     — pills/toggles
0 30px 50px rgba(6, 22, 44, 0.35)   — boarding-pass ticket
CTA pill: 5-stop layered shadow, 0 8px 17px rgba(0,0,0,0.08) innermost
```

### Breakpoints — Exact
```
1440px (design basis) · 991px · 900px · 860px · 760px · 700px · 600px · 560px · 520px · 479px
```

### Transitions — Exact (most common)
```
0.6s cubic-bezier(0.25, 1, 0.5, 1)   — hover roll-ups (nav, CTA)
1.3s cubic-bezier(0.65, 0, 0.35, 1)  — FAQ plane / clip-path wipes
0.3s ease                             — card background/border state changes
0.2s ease                             — simple hover fades
0.8–0.9s ease / cubic-bezier(0.25,1,0.5,1) — boarding-pass entrance
```

### Gradients — Exact
```
Sky:        linear-gradient(to bottom, #0f3f63, #4d8fb5 52%, #cfe3ee 100%)
Seam wash:  linear-gradient(#fff8ed 0%, #e9dfd2 30%, #579bd8 100%)
Jet-area (desktop): linear-gradient(transparent 0–100vh, #fff8ed 100vh)
Jet-area (mobile):  linear-gradient(transparent 0%, #7a716e 12%, #fff8ed 32%)
```

---

## 22. Source of Truth & Confidence

**Directly extracted (Exact):** all values in §4 (colors), the font-family declarations in §6, the radius values in §8, the shadow values in §21, the breakpoints in §15/§21, the gradient stops in §5/§21, and every CSS rule quoted verbatim throughout this document. These were read directly from `src/index.css`, `src/intro/intro.css`, `src/sections.css`, `src/App.css`, and the live JSX components listed in §1.

**Inferred (reliably derived, not written as a single token in the code):** the "spacing scale" in §7/§21 (the code uses many close-but-not-identical rem values rather than one strict token list — the scale presented is a reasonable summary, not a literal array from the source); the "type hierarchy" framing (the code defines individual class sizes, not a named H1/H2/H3 hierarchy — the mapping in §6 groups them by evident visual role); the design-philosophy language in §2–3 (a professional synthesis of the actual implementation's structure and comments, not a literal brand-guidelines document found in the repo — there is no separate brand-strategy file).

**Approximate:** the "content density: low-to-medium" and similar qualitative descriptors are visual/structural judgments based on reading the layout code, not measured metrics.

**Explicitly not defined in the current implementation (and not guessed):**
- A success/warning/error/info color system.
- A named type-scale (no "H1/H2/H3/Body" tokens exist in code — only per-component classes).
- Outline, ghost, or destructive button variants.
- A documented icon library or icon grid system (icons are bespoke, ad hoc SVGs).
- Dark/light "theme" switching for the whole site (the light/dark alternation is per-section, driven by scroll position, not a user-toggleable theme).

**Discrepancy flagged, not resolved:** `public/favicon.svg`'s purple palette does not match any color used elsewhere in the site and was not treated as a design token (see §1, §4).

**Files inspected in full or in targeted depth:** `index.html`, `src/index.css`, `src/App.jsx`, `src/App.css` (structurally, plus targeted reads), `src/sections.css` (near-complete), `src/intro/intro.css` (near-complete), `src/config.js`, `src/intro/Header.jsx`, `src/intro/Intro.jsx`, `src/intro/JetSection.jsx`, `src/intro/JetArt.jsx`, `src/components/BoardingPass.jsx`, `src/components/Faq.jsx`, `src/components/Footer.jsx`, `src/components/BookFlight.jsx`, `src/components/RegisterButton.jsx`, `src/components/SoundToggle.jsx`, `src/components/SkyBackdrop.jsx`, `src/components/SiteChrome.jsx`, `public/favicon.svg`.

---

## 23. Elevate 1.0 Design DNA

1. Dark, near-black backgrounds by default; warm cream backgrounds only for "daylight/cabin" moments — never a neutral gray.
2. Gold (`#c9a86a`) is the only accent color, used sparingly — one emphasized word, one number, one icon, one button fill at a time.
3. Orbitron carries every headline and technical readout (uppercase, tracked-out); Inter carries every sentence of body copy; Archivo carries the large editorial hero moments. Never swap their jobs.
4. Pill shapes (999px radius) for everything clickable; 14–22px radius for anything that behaves like a card or a physical object.
5. Shadows are soft, large, and dark (`rgba(0,0,0,0.3–0.45)`) — never sharp or colored.
6. Gradients exist only to represent sky/atmosphere or to smooth a seam between two sections — never as a decorative fill on a shape.
7. Every section transition is a deliberate "flight" moment (a color wash, a wipe, a scale, a cross-fade) — never a flat cut.
8. One persistent, pill-shaped primary CTA — not one CTA per section.
9. Icons are simple, bespoke, single-color (or single metallic-gradient) SVGs; the dart-plane glyph is the canonical mark.
10. Generous whitespace and hairline-rule dividers, not boxed cards, in the most premium/editorial moments; boxed cards with borders and radius are reserved for informational UI (FAQ, countdown, modal).
11. High contrast always: cream-on-near-black or dark-ink-on-cream — never gold-on-gold or low-contrast pairings.
12. Motion is scroll-driven and cinematic (GSAP ScrollTrigger scrubbing), never autoplaying, bouncy, or attention-grabbing for its own sake — and every major animation respects `prefers-reduced-motion`.
