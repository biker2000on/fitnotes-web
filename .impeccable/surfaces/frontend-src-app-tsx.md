---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: ["frontend/src/views","frontend/src/index.css"]
---

# FitNotes app shell and screens

Scope: the whole FitNotes web app (Operate mode): shell/navigation, Log, Routines + routine page, Exercises, Body, and the remaining pages. Calendar's layout is owner-approved and stays; it only inherits shared tokens (type, colour, contrast).

Audience and job: a lifter in a home/garage gym logging sets on a propped-up phone in dim, mixed light; the same person planning routines and reviewing progress at a desk. Eventually strangers, so empty states and first-run must explain themselves.

Structure (from shape, confirmed):
- Phone: bottom tabs Log · Calendar · Routines · Body · More; More lists Exercises, History, Measurements, Goals, Analytics, Tools, Settings, Account & sync.
- Tablet/desktop: grouped side rail (Train / Body / Insights, Settings + sync chip in the footer).
- Log: date pager masthead is the biggest control; Add exercise is the one primary action.
- Routines: list of compact rows → routine page (read mode, per-day Start, Up next) with Edit/Done; exercise detail in a sheet; program fields in a Program settings sheet. Start opens a quick sheet with date and fill method preselected.
- Destructive actions are undoable; weights always in the user's unit.

## Direction contract

THESIS: Iron Press. The log is set like the routine page of a 1970s iron-game magazine printed in two colours: condensed gothic caps name the lift, the set is a headline numeral. Refuses the generic dark SaaS dashboard (glass, gradients, rounded cards in cards, sky-blue accent).

OWN-WORLD: Two inks on paper. Ink theme (default, dim garage): warm ink ground #141210, raised #1E1A17, rules #322C27, newsprint text #F1EADB, muted #A69D8F, press red #F0553A, PR yellow #F3C23A. Newsprint theme: ground #EFE8DA, text #1A1715, red #B8331C. League Gothic for display caps, Barlow for UI text, Barlow Condensed tabular numerals; self-hosted for offline. Square corners (≤2px), 1px rules as structure, no shadows except sheets, no gradients or glass. Category and superset colours appear only as small swatches beside neutral text.

STORY: Open the app, see today's date big on a red band, read the next set across the room, tap it done, and the line reverses to solid paper. Plan routines at a desk with list and detail side by side.

FIRST VIEWPORT: Phone Log. Red masthead band: ‹ / weekday kicker + "3 NOV" in League Gothic ~48px / ›. Under it a thin toolbar (Load routine, Notes). Exercise blocks: name in League Gothic caps ~30px, a condensed caps meta line, 48px set rows with SET n label, Barlow Condensed numerals ~28px ("45 × 8 lb"), 40px complete square at the right thumb. Red full-width ADD EXERCISE bar above an ink tab bar with a red active underbar.

FORM: Grounded candidate 6 of 7 (1970s two-colour physique/iron magazine), assigned by the roll; raised by declined challengers: one family at stepped sizes carries hierarchy (Emigre), fixed four-step size ramp 13/16/22/34 (star atlas), whole-cell reflow with no truncated names (character roster), strict sequence numbers DAY n · SET n (Saville). seed:00b9445680103a93. Signature move: completing a set reverses its line (paper band, ink numerals) with a single left-to-right ink wipe; PR sets carry a yellow spot tag. Motion is that wipe plus sheets rising; reduced motion disables both.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
