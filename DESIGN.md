---
name: FitNotes
description: Iron Press. A workout log set like a two-colour 1970s iron-game magazine; condensed caps name the lift, the set is a headline numeral.
colors:
  ink: "#141210"
  ink-raised: "#1e1a17"
  ink-sunk: "#0e0c0b"
  ink-rule: "#322c27"
  ink-rule-strong: "#4f463e"
  paper-text: "#f1eadb"
  ink-muted: "#a69d8f"
  press-red: "#f0553a"
  press-red-hover: "#f46a52"
  on-red: "#141210"
  pr-yellow: "#f3c23a"
  go-green: "#8dbf6a"
  newsprint: "#efe8da"
  newsprint-raised: "#f8f4ea"
  newsprint-sunk: "#e6ddcb"
  newsprint-rule: "#d3c9b6"
  newsprint-rule-strong: "#b3a68f"
  newsprint-text: "#1a1715"
  newsprint-muted: "#5e564c"
  newsprint-red: "#b8331c"
  newsprint-red-hover: "#a02b16"
  on-newsprint-red: "#f8f4ea"
typography:
  display:
    fontFamily: "League Gothic, Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "52px"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "0.01em"
  page-title:
    fontFamily: "League Gothic, Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "44px"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  headline:
    fontFamily: "League Gothic, Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  row-headline:
    fontFamily: "League Gothic, Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  numeral:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  control:
    fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.1
  label:
    fontFamily: "Barlow Condensed, Barlow, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  base: "2px"
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  touch: "44px"
  tab-bar: "64px"
  rail-compact: "84px"
  rail: "232px"
  panel-max: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.press-red}"
    textColor: "{colors.on-red}"
    typography: "{typography.control}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.press-red-hover}"
    textColor: "{colors.on-red}"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-text}"
    typography: "{typography.control}"
    rounded: "{rounded.base}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.control}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "44px"
  button-action-bar:
    backgroundColor: "{colors.press-red}"
    textColor: "{colors.on-red}"
    rounded: "{rounded.base}"
    height: "52px"
  input:
    backgroundColor: "{colors.ink-sunk}"
    textColor: "{colors.paper-text}"
    typography: "{typography.body}"
    rounded: "{rounded.base}"
    padding: "10px 12px"
    height: "44px"
  log-masthead:
    backgroundColor: "{colors.press-red}"
    textColor: "{colors.on-red}"
    typography: "{typography.display}"
  set-line:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-text}"
    typography: "{typography.numeral}"
    height: "52px"
  set-line-done:
    backgroundColor: "{colors.paper-text}"
    textColor: "{colors.ink}"
  pr-tag:
    backgroundColor: "{colors.pr-yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "2px 6px"
  tab-bar:
    backgroundColor: "{colors.ink-sunk}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    height: "{spacing.tab-bar}"
  side-rail:
    backgroundColor: "{colors.ink-sunk}"
    textColor: "{colors.ink-muted}"
    width: "{spacing.rail}"
  sheet-panel:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.none}"
    width: "640px"
  docked-panel:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.none}"
    width: "460px"
  segmented-option:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-muted}"
    height: "44px"
  segmented-option-selected:
    backgroundColor: "{colors.paper-text}"
    textColor: "{colors.ink}"
  stepper:
    backgroundColor: "{colors.ink-sunk}"
    textColor: "{colors.paper-text}"
    typography: "{typography.title}"
    rounded: "{rounded.base}"
    height: "44px"
  date-stepper:
    backgroundColor: "{colors.ink-sunk}"
    textColor: "{colors.paper-text}"
    height: "44px"
  overflow-menu:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.base}"
    width: "230px"
  toast:
    backgroundColor: "{colors.paper-text}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.base}"
    height: "52px"
  toast-error:
    backgroundColor: "{colors.press-red}"
    textColor: "{colors.on-red}"
  day-card:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.base}"
  day-card-next:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.none}"
---

# Design System: FitNotes

## Overview

**Creative North Star: "Iron Press"**

The app is set like the routine page of a 1970s iron-game magazine printed in two inks. Condensed gothic capitals name the lift, the set itself is a headline numeral, and 1px rules do the structural work that cards and shadows do in a generic dashboard. The page is dense and ruled, read from a bench across the room in dim light: big numerals, high contrast, thumb-reachable bars.

There are two printings of the same page. **Ink** (default) is newsprint-coloured type on a warm near-black ground for the dim garage; **Newsprint** (`body.light-theme`) is near-black type on warm paper for bright rooms. Both share one red ink as the only accent. Every surface reads the semantic tokens (`--bg`, `--surface`, `--sunk`, `--line`, `--line-strong`, `--fg`, `--fg-muted`, `--accent`, `--on-accent`, `--pr`, `--scrim`) resolved on `body`, so a component written once prints correctly in both.

Motion is limited: completing a set wipes its line from ink to paper, left to right, and sheets rise or dock in. Everything else is an instant colour change. Reduced motion collapses all of it.

**Key Characteristics:**
- Two inks: one press red on warm ink or warm paper; yellow is a spot colour for PRs only.
- League Gothic caps for names, Barlow Condensed tabular numerals for figures, Barlow for running UI text.
- Square corners (2px); lists are ruled, not carded.
- Flat page; only floating layers cast a shadow.
- Signature move: a done set reverses its line.

## Colors

Two inks on paper: a warm near-black and a warm newsprint cream trade places between themes, and one red does all the shouting.

### Primary
- **Press Red** (Ink: press-red; Newsprint: newsprint-red): the date masthead band on the Log, primary buttons, the full-width ADD EXERCISE bar on phones, the 3px active marker in the tab bar and side rail, the label of the next set, the "Up next" tag and 4px top bar on the next routine day, danger actions, focus outlines, text selection and caret. On a red fill, text uses on-red (Ink) or on-newsprint-red (Newsprint).

### Secondary
- **PR Yellow** (pr-yellow, both themes): the PR spot tag on a set line only, always with ink text.

### Tertiary
- **Go Green** (go-green): the sync-ok icon tint. Nowhere else.

### Neutral
- **Warm Ink / Warm Newsprint** (ink / newsprint): the page ground (`--bg`).
- **Raised Ink / Raised Newsprint** (ink-raised / newsprint-raised): sheets, docked panels, day cards, overflow menu (`--surface`).
- **Sunk Ink / Sunk Newsprint** (ink-sunk / newsprint-sunk): inputs, steppers, tab bar, side rail, superset bar (`--sunk`).
- **Rule / Strong Rule** (ink-rule, ink-rule-strong / newsprint-rule, newsprint-rule-strong): 1px row dividers (`--line`); outlines of secondary buttons, segmented controls, sheets, dashed empty states (`--line-strong`).
- **Paper Text / Newsprint Text** (paper-text / newsprint-text): primary text, the 2px heading rules, the fill of a done set line (`--fg`).
- **Muted** (ink-muted / newsprint-muted): metadata, labels, inactive nav, icons (`--fg-muted`).
- **Scrim**: `rgba(8,7,6,0.7)` on Ink, `rgba(26,23,21,0.45)` on Newsprint, behind sheets and the exercise drawer.

### Named Rules
**The Two Inks Rule.** Red is the only accent. It marks the current thing (today, the next set, the active tab, the primary action) or a destructive thing. Never add a second accent hue to the chrome.

**The Spot Colour Rule.** Category and superset colours appear only as a small solid square swatch (10 to 12px) beside neutral text. They never tint a row, a chip fill, a border or a label. Yellow appears only on the PR tag.

**The Theme Through Tokens Rule.** Components read the semantic names (`--bg`, `--fg`, `--accent`...), never the raw Ink hexes, so Newsprint follows for free. A literal colour in a component is drift.

## Typography

**Display Font:** League Gothic (with Barlow Condensed, Arial Narrow)
**Body Font:** Barlow (with system-ui, Segoe UI)
**Label/Numeral Font:** Barlow Condensed (with Barlow, Arial Narrow)

All three are self-hosted through @fontsource so the app renders identically offline: League Gothic 400; Barlow 400/500/600/700; Barlow Condensed 500/600/700.

**Character:** A tall, tight poster gothic in caps for every name, a condensed grotesque for figures and small labels, and a plain humanist grotesque for anything read as a sentence. Hierarchy comes from size within one family per role, not from colour or weight games.

### Hierarchy
The token ramp is 13 / 16 / 22 / 34 / 52 (`--t-1` to `--t-4`, `--t-display`). The build also uses a few reused display steps between them (30, 44), recorded here because they recur.
- **Display** (League Gothic 400, 52px, 0.9, caps): the date on the Log masthead ("OCT 27"). One per screen.
- **Page Title** (League Gothic 400, 44px, 0.95, caps, balanced): page headers ("ROUTINES").
- **Headline** (League Gothic 400, 34px, 0.95, caps): exercise block names on the Log; empty-state titles at desk width.
- **Row Headline** (League Gothic 400, 30px, 0.95, caps): routine names in lists, day names in day cards. Sheet titles sit at 32px, card and settings-panel titles at 26px.
- **Numeral** (Barlow Condensed 700, 30px, 1, tabular): the set value ("45 × 8 LB"); 24px in weigh-in rows, 44px in Body headline figures. Units ride beside at 15px 600 caps, muted.
- **Title** (Barlow Condensed 700, 22px, tabular): stepper values, range readouts.
- **Body** (Barlow 400, 16px, 1.45): running text; notes cap at 70ch. Metadata lines drop to 14px muted.
- **Control** (Barlow 600, 15px): buttons, menu items, toasts, desktop rail links.
- **Label** (Barlow Condensed 700, 13px, 0.1 to 0.16em tracking, caps, muted): SET n, DAY n, field labels, section titles, tab-bar labels (12px), the masthead weekday line, ex-block meta ("SHOULDERS · 0 OF 3 DONE").

### Named Rules
**The Caps Name the Lift Rule.** League Gothic in uppercase is for names: the date, page, exercise, routine, day, sheet. It never sets sentences, metadata or ordinary buttons; the one action that earns it is the large red action bar.

**The Numeral Rule.** Every figure a lifter reads (weight, reps, time, counts) is Barlow Condensed with tabular numerals. The next set's value is solid; later planned sets are outlined (1.2px text stroke) until they come up.

**The Data Label Rule.** Small condensed caps labels carry data: a sequence number (SET 2, DAY 1), a date, a count, a status ("Up next"), a nav group. They never carry a tagline or a decorative category over a heading.

## Layout

Phone first. The shell is a single column under a fixed 64px bottom tab bar (five tabs: Log, Calendar, Routines, Body, More), with safe-area insets on every edge. At 768px the tab bar is replaced by an 84px icon side rail; at 1200px the rail widens to 232px with the wordmark, group titles (TRAIN, BODY, INSIGHTS) and labelled rows. Content sits in a main panel capped at 1240px with 16px gutters.

Desktop earns its width with real side by side layouts: Routines splits into a 300 to 380px sticky list and a detail pane at 1024px; exercise blocks on the Log run two columns at 1100px; routine day cards tile at 380px minimum at 1000px; the exercise detail drawer docks at 480px and pushes the page instead of covering it at 1100px; set entry and the start sheet dock to the right edge at 900px.

Spacing runs on a 4px base (4, 8, 12, 16, 24); stacks inside a panel are 16px apart, exercise blocks 22px. Every interactive target is at least 44px; set lines and list rows are 52 to 76px tall.

### Named Rules
**The Ruled List Rule.** Lists are rows divided by 1px `--line` rules, opened by a 2px `--fg` rule (set lines, weigh-ins, settings, page headers, routine identity, Body figures). Do not wrap list rows in individual cards.

## Elevation & Depth

The page is flat and tonal: depth comes from three grounds (sunk for chrome and inputs, base for the page, raised for panels) and from rules. Shadows exist only on things that float above the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 18px 40px -12px rgba(0,0,0,0.55)`, `--shadow-lg`): toast, overflow menu, exercise detail drawer.
- **Sheet lift** (`box-shadow: 0 -18px 40px -16px rgba(0,0,0,0.7)`): bottom sheets and modals, cast upward.
- **Action bar** (`box-shadow: 0 10px 24px -10px rgba(0,0,0,0.7)`): the fixed ADD EXERCISE bar above the phone tab bar.

### Named Rules
**The Flat Page Rule.** Nothing that scrolls with the page casts a shadow. Cards, rows, buttons and inputs are flat; `--shadow-sm`, `--shadow-md` and `--shadow-glow` are intentionally `none`. No glass, no backdrop blur.

## Shapes

Square-cut. One radius (2px, `--radius`) for buttons, inputs, chips, cards, menus, toasts and focus outlines; sheets, docked panels, the next day card and list rows are fully square (0). Borders are 1px; structural heading rules are 2px; active markers are 3px bars (tab underbar, rail edge bar) and the next day card carries a 4px red top bar. Dashed `--line-strong` outlines mark open slots: empty states, the workout note, superset groups. Swatches are hard squares. The app icon (a notebook with a red spine and check) uses a larger corner only as the platform icon tile.

### Named Rules
**The Square Corner Rule.** Corners are 2px or 0. Nothing on-system is pill-shaped or softly rounded.

## Components

### Set Line and the Reversal (signature)
The unit of the app. A 52px row: muted SET n label (44px column, 13px condensed caps), the value as a 30px tabular numeral with muted caps unit, an optional yellow PR tag, and a 52px check column holding a 36px square with a 2px border. Set lines stack under a 2px `--fg` rule with 1px `--line` dividers. Completing a set reverses the line: a solid `--fg` fill wipes in left to right (background-size 0 to 100% over 0.26s, ease-out) and text turns `--bg`; the check square fills `--bg` with an `--fg` tick. The next set's label turns red; later sets' numerals are outlined.

**The Reversal Rule.** Done is shown by reversing the line to paper, never by a green tick, strikethrough or fade. It is the only animated state change on the page.

### Date Masthead
A full-width red band at the top of the Log. A 56px chevron step on each side; centred, a 13px condensed caps weekday line (relative name or weekday, plus year when not current) over the 52px League Gothic date. Tapping the date opens the native date picker. Under the band, on `--bg`, a thin toolbar of ghost buttons (Jump to today, Load routine, Notes) and, on desktop, the Add exercise button; a 1px rule closes it.

### Buttons
- **Shape:** 2px corners, 44px minimum height, 0 16px padding, Control type.
- **Primary:** red fill, on-red text; hover lightens to press-red-hover.
- **Secondary:** transparent with a `--line-strong` outline; hover sharpens the outline to `--fg`.
- **Ghost:** muted text, no outline; hover brings `--fg` and a 6% `--fg` tint.
- **Danger:** red outline and text; fills red on hover. Danger-ghost is red text only.
- **Large action bar:** 52 to 56px, League Gothic 22 to 26px caps. On phones ADD EXERCISE is fixed full width above the tab bar.
- **Icon button:** 44px square, muted, 7% tint on hover. Press nudges down 1px; no lift, no glow.

### Inputs / Fields
- **Style:** sunk fill, 1px `--line` border, 2px corners, 44px min height, 16px text.
- **Focus:** border turns `--fg`; keyboard focus adds a 2px red outline at 2px offset. Caret is red.
- **Labels:** Label type above the field; hints 14px muted.

### Segmented Control
A row of equal cells inside one `--line-strong` outline, cells divided by 1px rules, 44px tall, 14px 600 muted text. The selected cell is reversed (`--fg` fill, `--bg` text), echoing the set line. Its legend sits above as a field label.

### Stepper and Date Stepper
Stepper: a sunk, outlined strip of minus / value / unit / plus (44px buttons), value in 22px Barlow Condensed 700 tabular, unit in muted label caps. Date stepper: the same strip with chevrons either side of a 19px condensed caps date that turns red on hover; used inside sheets to pick a target date.

### Navigation
- **Tab bar (phones):** five equal cells on `--sunk` with a 1px top rule, 64px tall plus safe area; icon over a 12px condensed caps label, muted. Active tab: `--fg` text and a 3px red underbar inset to the middle of the cell.
- **Side rail (768px and up):** `--sunk` column with a 1px right rule. Compact (84px): icon over 11px caps label. Wide (1200px+): wordmark in League Gothic, group titles in label caps, rows of icon + 15px Barlow 600. Active row: `--fg` text, 8% `--fg` tint, a 3px red bar on the rail's left edge. Sync status chip sits at the foot.

### Sheets and Docked Panels
Phones: a bottom sheet up to 640px wide and 92dvh tall, raised fill, square corners, 3px `--fg` top rule, upward sheet-lift shadow, rising 24px over 0.22s. Header: 32px League Gothic title, optional 15px muted subtitle, close icon button, 1px rule beneath; footer actions above a 1px rule. At 900px and up the same sheet docks to the right edge as a full-height 460px panel (480px for set entry) with a left rule, sliding in from the right, and the scrim under set entry thins so the log stays readable. Centred modals keep 2px corners.

### Overflow Menu
A 230px raised list under a 1px `--line-strong` outline with the Float shadow, 44px rows of 15px Barlow 500 with an optional icon; hover and focus tint 8% `--fg`. Destructive items are red.

### Toast with Undo
A reversed bar (`--fg` fill, `--bg` text) 52px tall, centred above the add bar on phones and 28px from the bottom on desktop, rising 12px into place. The Undo action is an outlined 44px button in condensed caps that itself reverses on hover. Errors print on red. Destructive actions always offer Undo here.

### Routine Day Card
A raised block with a 1px rule and 2px corners. Head: DAY sequence numeral in muted, the day name in 30px League Gothic, a 14px muted meta line, and a Start button. Exercises follow as a ruled list of 52px rows: name in 16px Barlow 600 left, plan in 16px condensed muted right, superset tag as a colour swatch plus caps label. The next day to train swaps to a square card with an `--fg` outline, a 4px red top bar, red sequence numeral, and a red "Up next" tag beside a primary Start.

### Ruled Lists
Routine rows (30px League Gothic name, 14px meta, Start and chevron at the right, 76px tall; 24px and 64px in the desktop split), More rows (icon, 17px title over 14px muted subtitle, chevron, 60px), exercise catalogue rows, weigh-in rows (date, 24px numeral, fat %, action) and settings panels all follow the Ruled List Rule. Hover is a 4% `--fg` tint; the active routine in the split list takes an 8% tint and a red name.

## Do's and Don'ts

### Do:
- **Do** read colours through the semantic tokens on `body` (`--bg`, `--surface`, `--sunk`, `--line`, `--fg`, `--fg-muted`, `--accent`, `--on-accent`, `--pr`) so both Ink and Newsprint print correctly.
- **Do** set names in League Gothic caps and every figure in Barlow Condensed tabular numerals, sized from the 13 / 16 / 22 / 34 / 52 ramp.
- **Do** build lists as ruled rows: a 2px `--fg` rule above, 1px `--line` between.
- **Do** keep corners at 2px (`--radius`) or square, and touch targets at 44px or more.
- **Do** mark the current item with red: the date band, the next set label, the active tab bar, the next day's top bar.
- **Do** show completion by reversal, as the set line and selected segment do.
- **Do** use the solid-fill background-image wipe for the set line; it is a mechanism for one flat colour, not a gradient.
- **Do** give destructive actions an Undo toast.

### Don't:
- **Don't** put shadows on anything that scrolls with the page; only sheets, docked panels, the drawer, the toast, the overflow menu and the phone action bar float.
- **Don't** use visible colour gradients, glass or backdrop blur.
- **Don't** tint rows, chips or borders with category or superset colours; use a square swatch beside neutral text.
- **Don't** use yellow for anything but the PR tag, or a second accent hue in the chrome.
- **Don't** use pill shapes or radii above 2px on new surfaces.
- **Don't** put a small caps label above a heading unless it carries data (a date, a sequence number, a count, a status).
- **Don't** hardcode `rgba(255,255,255,…)` tints; they vanish on Newsprint. Use `color-mix(in srgb, var(--fg) N%, transparent)`.
- **Don't** restyle the Calendar month view; it is owner-protected and keeps its own shapes while reading the tokens.
