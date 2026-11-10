---
target: Workout Log (dark theme)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\biker\\projects\\fitnotes-web\\frontend\\src\\views\\WorkoutLogView.tsx"
target_fingerprint: "sha256:24164099f5f61271c94e97a45d1493d23030aa5f3994dd3740ceebac111789f9"
target_path: "C:\\Users\\biker\\projects\\fitnotes-web\\frontend\\src\\views\\WorkoutLogView.tsx"
timestamp: 2026-11-03T20-33-17Z
slug: frontend-src-views-workoutlogview-tsx
---
# Workout Log, Ink theme — critique (2026-11-03)

Method: dual-agent (A: design review via headless browser · B: detector + overlay). Seeded real history; finished day measured at 390 and 1440.

## Design health: 27/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Status | 3 | Done unmistakable; "next" is per exercise, several red SET labels at once |
| 2 | Real world | 3 | Magazine metaphor holds; durations print "1m 0s" |
| 3 | Control | 3 | Re-tap undoes; Unlink is a bare ghost button |
| 4 | Consistency | 2 | Duration sets skip numeral/outline states; supersets ignore 2-col grid |
| 5 | Error prevention | 3 | Edit and complete hit areas are separate |
| 6 | Recognition | 3 | Outline vs solid code never explained |
| 7 | Flexibility | 3 | Ctrl K, Complete all |
| 8 | Minimalist | 2 | Finished work is the largest, brightest mass |
| 9 | Recovery | 3 | Toggles reversible |
| 10 | Help | 2 | Nothing explains the three set states |

## Evidence
Done rows are full-bleed #f1eadb bands (15.6:1 against ink). Paper share of the viewport on a finished/mostly finished day: phone up to 54–57%, desktop up to 49% (whole document 33–36%). Mean luminance of a finished phone screen ≈ 60% of the light theme. Detector: 0 markup findings; overlay 1 low-contrast — Ctrl K kbd at 4.24:1 on the red add button (desktop).

## Priority issues
- [P0] Done rows flood the dark theme (system.css set-line .is-done, background-size 100%). Inverts hierarchy (done > next), glare in a dim garage, permanent on every history/review day. Fix: ink-on-ink done band (`--done-band` ≈ fg 9% over bg), muted text, filled paper check square as the reversal, optional 4px paper inset rule; Newsprint gets a pale sunk band. Update DESIGN.md Reversal rule.
- [P1] "Next" is per exercise (nextId inside renderExercise) and the weakest signal (13px red label). Fix: one workout-wide next set with a strong row treatment; later sets solid --fg-muted instead of 1.2px outline (unreadable in dim light, needed to load plates).
- [P1] Desktop supersets span ~1208px and singles strand a column. Fix: superset group as its own 2-col grid, cap set-lines width, dense flow.
- [P2] Red masthead "ears" beside the toolbar above ~1472px. Fix: full-width ink toolbar wrapper.
- [P2] Red focus ring 2.9:1 on paper rows; Ctrl K kbd 4.24:1 on red.

## Personas
- Casey: glare grows through the session; next is a small red label among several; outlined weights unreadable at 2 m.
- Alex: every reviewed day is 100% done = brightest state; 1200px rows; no year on the masthead across history.
- Sam: two tab stops per set, check labelled "Set 1 done" with no exercise name, next/later never announced.

## Minor
Duration sets render "1m 0s" without headline numerals; zebra 1px dividers between bands amplify the mass; masthead scrolls away on phone.

## Questions
1. Must "done" be the most visible thing, or just the least ambiguous?
2. Should a reviewed (100% done) day render differently from a live session?
3. Is "next" a property of the exercise or of the workout?
