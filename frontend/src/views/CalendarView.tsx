// CalendarView.tsx - Continuously scrolling calendar: months stack in
// chronological order and load in both directions as you scroll, each week row
// led by a weekly overview cell. The selected day's workout summary sits beside
// the grid on desktop and slides up as a dismissible sheet on mobile.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, ArrowRight, FileText, Dumbbell, Menu, Bookmark, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { db } from '../storage/db';
import { intColorToHex } from '../lib/colors';
import { getLocalDateString, parseLocalDate } from '../lib/date';
import { FilterCombobox } from '../components/FilterCombobox';
import { aggregateMuscleTargets } from '../lib/muscles';
import { MuscleDiagramDetails } from '../components/MuscleDiagram';
import { buildDayStats, buildMatchingDates, formatVolume, nextMonthRange, type DayChip } from '../lib/workoutHistory';
import type { RoutineSection } from '../types';

// Months are addressed as a single ordinal so stepping never wraps badly.
const toOrdinal = (year: number, month: number) => year * 12 + month;
const fromOrdinal = (ordinal: number) => ({ year: Math.floor(ordinal / 12), month: ordinal % 12 });
const ordinalOfDate = (date: Date) => toOrdinal(date.getFullYear(), date.getMonth());

// How far the calendar may travel: a year ahead of today, and back to whichever
// is earlier of the first workout or a year ago - so a new account can still
// browse backwards instead of hitting a wall after one screen.
const FUTURE_MONTHS = 12;
const MIN_PAST_MONTHS = 12;
const INITIAL_TRAIL = 2;

export function CalendarView() {
  const {
    allLogs, selectedDate, setSelectedDate, settings, exercises, categories,
    workoutComment, setActiveTab, formatLogValue, handleSelectLogForEdit,
    workoutGroups, groupExercises, routines, workoutRoutines, setSidebarOpen, userUnit,
  } = useFitNotesStore();
  const [filter, setFilter] = useState('');
  const [routineSections, setRoutineSections] = useState<RoutineSection[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  // Distance from the bottom of the scroll content, captured before months are
  // prepended so the viewport can be restored to the same visual position.
  const pendingScrollRef = useRef<number | null>(null);
  // A month the view should jump to once it has been rendered ([ / ] hotkeys).
  const pendingMonthRef = useRef<number | null>(null);
  // Top-most month currently in view, so a relative jump has somewhere to start.
  const visibleOrdinalRef = useRef<number | null>(null);
  const [anchored, setAnchored] = useState(false);

  const todayStr = getLocalDateString();
  const currentOrdinal = useMemo(() => ordinalOfDate(new Date()), []);

  // Routine day-splits for the filter dropdown (not kept in global store state).
  useEffect(() => {
    db.query<RoutineSection>('SELECT * FROM routine_sections')
      .then(secs => setRoutineSections(secs.filter(s => !s.is_deleted)))
      .catch(e => console.warn('Failed to load routine sections for filter:', e));
  }, [routines]);

  const matchingDates = useMemo(
    () => buildMatchingDates(filter, allLogs, exercises, workoutRoutines),
    [filter, allLogs, exercises, workoutRoutines],
  );
  const dayStats = useMemo(() => buildDayStats(allLogs, matchingDates), [allLogs, matchingDates]);

  // Scroll bounds: never page back past the first workout, and stop a year out.
  const earliestOrdinal = useMemo(() => {
    let earliest: number | null = null;
    for (const log of allLogs) {
      if (log.is_deleted) continue;
      const ordinal = ordinalOfDate(parseLocalDate(log.date));
      if (earliest === null || ordinal < earliest) earliest = ordinal;
    }
    return Math.min(earliest ?? currentOrdinal, currentOrdinal - MIN_PAST_MONTHS) - 1;
  }, [allLogs, currentOrdinal]);
  const latestOrdinal = currentOrdinal + FUTURE_MONTHS;

  // The month the calendar should be looking at: whatever day is selected.
  // Arriving from History ("view in calendar") selects a past day first, so
  // opening on today's month would land on the wrong place entirely.
  const selectedOrdinal = useMemo(() => ordinalOfDate(parseLocalDate(selectedDate)), [selectedDate]);
  const lastSelectedOrdinalRef = useRef(selectedOrdinal);

  const [range, setRange] = useState(() => ({
    start: selectedOrdinal - INITIAL_TRAIL,
    end: Math.max(selectedOrdinal, currentOrdinal) + 1,
  }));

  // Keep the rendered window inside the data bounds as logs load in.
  useEffect(() => {
    setRange(prev => ({
      start: Math.max(prev.start, earliestOrdinal),
      end: Math.min(prev.end, latestOrdinal),
    }));
  }, [earliestOrdinal, latestOrdinal]);

  const months = useMemo(() => {
    const list: number[] = [];
    for (let o = range.start; o <= range.end; o++) list.push(o);
    return list;
  }, [range]);

  const scrollMonthIntoView = (ordinal: number, behavior: ScrollBehavior = 'auto') => {
    const root = scrollRef.current;
    const target = root?.querySelector<HTMLElement>(`[data-month="${ordinal}"]`);
    if (root && target) root.scrollTo({ top: target.offsetTop, behavior });
  };

  // Anchor the selected day's month at the top on first paint, so the view
  // opens where the user is looking with history available by scrolling up.
  useLayoutEffect(() => {
    if (anchored) return;
    scrollMonthIntoView(selectedOrdinal);
    setAnchored(true);
  }, [anchored, selectedOrdinal, months]);

  // Follow the selection when it moves to another month while the calendar is
  // already open - but only scroll if that month is off-screen, so clicking a
  // day in a month you can already see never yanks the viewport.
  useEffect(() => {
    if (!anchored) return;
    if (selectedOrdinal === lastSelectedOrdinalRef.current) return;
    lastSelectedOrdinalRef.current = selectedOrdinal;

    setRange(prev => ({
      start: Math.min(prev.start, selectedOrdinal),
      end: Math.max(prev.end, selectedOrdinal),
    }));

    const root = scrollRef.current;
    const section = root?.querySelector<HTMLElement>(`[data-month="${selectedOrdinal}"]`);
    if (!root || !section) {
      // Not rendered yet; scroll once the widened range paints.
      pendingMonthRef.current = selectedOrdinal;
      return;
    }
    const visible = section.offsetTop < root.scrollTop + root.clientHeight
      && section.offsetTop + section.offsetHeight > root.scrollTop;
    if (!visible) scrollMonthIntoView(selectedOrdinal, 'smooth');
  }, [anchored, selectedOrdinal]);

  // Restore the visual position after older months are prepended above, unless
  // an explicit month jump is queued - that one wins.
  useLayoutEffect(() => {
    if (pendingMonthRef.current != null) {
      const target = pendingMonthRef.current;
      pendingMonthRef.current = null;
      pendingScrollRef.current = null;
      scrollMonthIntoView(target, 'smooth');
      return;
    }
    if (pendingScrollRef.current == null) return;
    const root = scrollRef.current;
    if (root) root.scrollTop = root.scrollHeight - pendingScrollRef.current;
    pendingScrollRef.current = null;
  }, [months]);

  // Track the top-most visible month so [ / ] can step relative to it, and
  // extend the rendered range when either edge comes into reach.
  const handleScroll = () => {
    const root = scrollRef.current;
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>('[data-month]');
    let top: number | null = null;
    for (const section of sections) {
      if (section.offsetTop <= root.scrollTop + 8) top = Number(section.dataset.month);
      else break;
    }
    if (top != null) visibleOrdinalRef.current = top;
    extendForScroll(root);
  };

  // The opening view may already sit at an edge (a short history renders less
  // than one screen), so evaluate once after anchoring instead of waiting for
  // the first scroll event.
  useEffect(() => {
    const root = scrollRef.current;
    if (root && anchored) extendForScroll(root);
  }, [anchored, months, earliestOrdinal, latestOrdinal]);

  // [ / ] scroll the continuous calendar by a month instead of paging it.
  useEffect(() => {
    const onShift = (event: Event) => {
      const delta = (event as CustomEvent<{ delta: number }>).detail?.delta ?? 0;
      if (!delta) return;
      const from = visibleOrdinalRef.current ?? currentOrdinal;
      const target = Math.min(Math.max(from + delta, earliestOrdinal), latestOrdinal);
      setRange(prev => {
        const next = { start: Math.min(prev.start, target), end: Math.max(prev.end, target) };
        if (next.start === prev.start && next.end === prev.end) {
          scrollMonthIntoView(target, 'smooth');
          return prev;
        }
        pendingMonthRef.current = target;
        return next;
      });
      visibleOrdinalRef.current = target;
    };
    window.addEventListener('fitnotes:calendar-shift', onShift);
    return () => window.removeEventListener('fitnotes:calendar-shift', onShift);
  }, [currentOrdinal, earliestOrdinal, latestOrdinal]);

  // Edge-triggered month loading, driven by scroll position. The decision rule
  // lives in nextMonthRange so it can be tested without a live scroll
  // container; this only wires it up and preserves the viewport when months are
  // added above the current position.
  const extendForScroll = (root: HTMLDivElement) => {
    if (!anchored) return;
    setRange(prev => {
      const { range: next, direction } = nextMonthRange(
        { scrollTop: root.scrollTop, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight },
        prev,
        { earliest: earliestOrdinal, latest: latestOrdinal },
      );
      if (!direction) return prev;
      if (direction === 'earlier') pendingScrollRef.current = root.scrollHeight - root.scrollTop;
      return next;
    });
  };

  const styleTag = (
    <style>{`
      .calendar-dashboard { display: flex; align-items: flex-start; gap: 24px; width: 100%; }
      /* The calendar is not a card: it is a grid bounded by the viewport, so it
         sits directly on the page and sizes to the screen rather than stretching
         to match the summary column beside it. */
      .calendar-left-pane {
        flex: 1 1 auto; min-width: 0; align-self: flex-start;
        display: flex; flex-direction: column; gap: 10px;
      }
      .calendar-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .calendar-scroll {
        --week-col: 92px;
        /* Fills from below the toolbar to just above the viewport floor; the
           workspace padding and toolbar are the only things above it. */
        height: calc(100vh - 118px); min-height: 320px; overflow-y: auto; overscroll-behavior: contain;
        border: 1px solid var(--border-dark); border-radius: 12px; background: rgba(15, 23, 42, 0.16);
      }
      .calendar-month-section { position: relative; }
      /* Title and weekday labels stick together as one block, so the labels
         never need to guess the header's height to position themselves. */
      .calendar-month-sticky {
        position: sticky; top: 0; z-index: 3;
        background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--border-dark);
      }
      .calendar-month-header {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: 12px; padding: 10px 12px 6px;
      }
      .calendar-month-title { font-size: 15px; font-weight: 800; color: var(--text-main-dark); }
      .calendar-month-total { font-size: 11px; color: var(--text-secondary-dark); }
      .calendar-week-labels, .calendar-week-row {
        display: grid; grid-template-columns: var(--week-col) repeat(7, minmax(0, 1fr));
      }
      .calendar-week-labels > div {
        padding: 6px 4px; text-align: center; font-size: 10px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary-dark);
      }
      .calendar-week-summary {
        border-right: 1px solid var(--border-dark); border-bottom: 1px solid var(--border-dark);
        padding: 6px 7px; background: rgba(99, 102, 241, 0.05);
        display: flex; flex-direction: column; gap: 2px; min-width: 0;
      }
      .calendar-week-range { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary-dark); }
      .calendar-week-primary { font-size: 12px; font-weight: 800; color: var(--text-main-dark); }
      .calendar-week-meta { font-size: 10px; color: var(--text-secondary-dark); }
      .calendar-week-rest { font-size: 10px; color: var(--text-secondary-dark); opacity: 0.55; }
      .calendar-cell {
        min-height: 112px; border-right: 1px solid var(--border-dark);
        border-bottom: 1px solid var(--border-dark); padding: 6px;
        display: flex; flex-direction: column; align-items: stretch; gap: 5px;
        background: rgba(255,255,255,0.012); cursor: pointer; transition: background 0.15s ease;
        text-align: left; min-width: 0;
      }
      .calendar-cell:nth-child(8n) { border-right: none; }
      .calendar-cell:hover { background: rgba(99, 102, 241, 0.06); }
      .calendar-cell.outside { background: rgba(15, 23, 42, 0.28); cursor: default; }
      .calendar-cell.outside:hover { background: rgba(15, 23, 42, 0.28); }
      .calendar-cell-number {
        align-self: flex-end; display: inline-flex; align-items: center; justify-content: center;
        min-width: 22px; height: 22px; padding: 0 5px; border: 0; border-radius: 999px;
        background: transparent; color: var(--text-secondary-dark); font: inherit; font-size: 11px; cursor: pointer;
      }
      .calendar-cell.today .calendar-cell-number { background: var(--accent); color: #111827; font-weight: 800; }
      .calendar-cell.active { box-shadow: inset 0 0 0 2px var(--primary); }
      .calendar-cell.active .calendar-cell-number { color: var(--primary); font-weight: 700; }
      /* The routine a day belonged to, above its exercises. Deliberately not a
         sibling of the exercise chips: those are capped with :nth-child, which
         would start counting this one. */
      .calendar-routine-chips { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .calendar-routine-chip {
        display: flex; align-items: center; gap: 4px; width: 100%; min-width: 0; padding: 3px 5px;
        border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 6px;
        background: rgba(99, 102, 241, 0.14); color: var(--primary);
        font-size: 10px; font-weight: 700; line-height: 1.1; cursor: pointer; text-align: left;
      }
      .calendar-routine-chip-icon { flex: 0 0 auto; }
      .calendar-routine-chip-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .calendar-workout-chips { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .calendar-workout-chip {
        display: flex; align-items: center; gap: 5px; width: 100%; min-width: 0; padding: 4px 5px;
        border: 1px solid color-mix(in srgb, var(--chip-color) 38%, var(--border-dark)); border-radius: 6px;
        background: color-mix(in srgb, var(--chip-color) 10%, transparent); color: var(--text-main-dark);
        font-size: 10px; line-height: 1.1; cursor: pointer; text-align: left;
      }
      .calendar-workout-chip-dot { width: 6px; height: 6px; flex: 0 0 6px; border-radius: 50%; background: var(--chip-color); }
      /* Every exercise is in the DOM; how many are shown is a per-breakpoint
         decision - two named chips fit a desktop cell, more dots fit a phone. */
      .calendar-workout-chip:nth-child(n+3) { display: none; }
      .calendar-workout-chip-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .calendar-workout-chip-stat { flex: 0 0 auto; color: var(--text-secondary-dark); font-size: 9px; }
      .calendar-workout-more { padding-left: 5px; color: var(--text-secondary-dark); font-size: 9px; }
      .calendar-edge-note { padding: 14px; text-align: center; font-size: 11px; color: var(--text-secondary-dark); }
      /* Sentinels need real area: a zero-height target never reports an
         intersection, which silently disables the infinite scroll. */
      .calendar-sentinel {
        height: 28px; display: flex; align-items: center; justify-content: center;
        font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--text-secondary-dark); opacity: 0.6;
      }
      .calendar-right-pane {
        flex: 0 0 380px; width: 380px; background: rgba(30, 41, 59, 0.4);
        backdrop-filter: blur(16px); border: 1px solid var(--border-dark); border-radius: 16px;
        padding: 20px; display: flex; flex-direction: column;
        max-height: calc(100vh - 150px); position: sticky; top: 24px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      }
      .workout-summary-header { border-bottom: 1px solid var(--border-dark); padding-bottom: 12px; margin-bottom: 16px; }
      .workout-summary-title {
        font-size: 18px; font-weight: 800; color: var(--text-main-dark); margin-bottom: 4px;
        display: flex; align-items: center; gap: 8px;
      }
      .workout-summary-date { font-size: 13px; color: var(--text-secondary-dark); font-weight: 500; }
      .workout-summary-scroll { flex: 1; overflow-y: auto; padding-right: 4px; margin-bottom: 16px; }
      .summary-exercise-card {
        background: rgba(255, 255, 255, 0.02); border-left: 3px solid var(--primary);
        border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; transition: transform 0.2s ease;
      }
      .summary-exercise-card:hover { transform: translateX(4px); background: rgba(255, 255, 255, 0.04); }
      .summary-superset-card {
        background: rgba(255, 255, 255, 0.015); border: 1px solid var(--border-dark);
        border-left: 4px solid var(--primary); border-radius: 10px; padding: 10px; margin-bottom: 12px;
      }
      .summary-superset-title {
        display: inline-flex; align-items: center; max-width: 100%; padding: 2px 8px; border-radius: 5px;
        font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
      }
      .summary-superset-exercise { padding: 8px 0; border-top: 1px solid rgba(255, 255, 255, 0.05); }
      .summary-superset-exercise:first-of-type { border-top: none; padding-top: 0; }
      .summary-exercise-name { font-size: 14px; font-weight: 700; color: var(--text-main-dark); margin-bottom: 6px; }
      .summary-set-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; color: var(--text-secondary-dark); }
      .summary-set-badge {
        font-size: 10px; font-weight: 800; background: rgba(255, 255, 255, 0.08); color: var(--text-main-dark);
        padding: 2px 6px; border-radius: 4px; min-width: 20px; text-align: center;
      }
      .summary-set-completed { color: var(--accent); font-weight: 600; }
      .summary-comment-box {
        background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.2);
        border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; font-size: 13px; color: #f59e0b;
        display: flex; gap: 8px; align-items: flex-start;
      }
      .calendar-detail-dismiss { display: none; }
      @media (max-width: 900px) {
        .calendar-dashboard { flex-direction: column; }
        .calendar-left-pane { flex: 0 0 auto; width: 100%; }
        /* The whole week has to fit on screen: a horizontally scrolling month
           shows three days at a time, which reads as a broken week. Columns
           shrink and exercise chips collapse to category dots; the full detail
           is one tap away in the summary sheet. */
        .calendar-scroll { height: calc(100vh - 150px); overflow-x: hidden; --week-col: 54px; }
        .calendar-month-section { min-width: 0; }
        .calendar-month-header { padding: 8px 10px 5px; }
        .calendar-month-title { font-size: 13px; }
        .calendar-month-total { font-size: 10px; }
        .calendar-week-labels > div { font-size: 8px; padding: 5px 1px; letter-spacing: 0.04em; }
        .calendar-week-summary { padding: 4px 4px; gap: 1px; }
        .calendar-week-range { font-size: 8px; }
        .calendar-week-primary { font-size: 10px; }
        .calendar-week-meta, .calendar-week-rest { font-size: 8px; }
        .calendar-cell { min-height: 60px; padding: 3px; gap: 3px; }
        .calendar-cell-number { min-width: 18px; height: 18px; font-size: 10px; }
        /* No room for the routine name at this column width; the bookmark
           alone still says "this day ran a routine", and the sheet names it. */
        .calendar-routine-chips { padding-left: 2px; }
        .calendar-routine-chip { width: auto; padding: 0; border: none; background: none; }
        .calendar-routine-chip-name { display: none; }
        .calendar-workout-chips { flex-direction: row; flex-wrap: wrap; gap: 3px; padding-left: 2px; }
        .calendar-workout-chip { width: auto; padding: 0; border: none; background: none; }
        .calendar-workout-chip:nth-child(n+3) { display: flex; }
        .calendar-workout-chip:nth-child(n+7) { display: none; }
        .calendar-workout-chip-name, .calendar-workout-chip-stat { display: none; }
        .calendar-workout-chip-dot { width: 7px; height: 7px; flex-basis: 7px; }
        .calendar-workout-more { display: none; }
        .calendar-right-pane { display: none; }
        .calendar-right-pane.detail-open {
          display: flex; position: fixed; z-index: 1000; left: 8px; right: 8px; bottom: 8px; top: auto;
          width: auto; flex-basis: auto; max-height: min(72vh, 620px); padding: 16px;
          border-radius: 18px 18px 12px 12px; box-shadow: 0 -18px 60px rgba(0,0,0,0.5);
        }
        .calendar-detail-dismiss { display: inline-flex; }
        .workout-summary-scroll { min-height: 0; overscroll-behavior: contain; }
      }
    `}</style>
  );

  const workoutChipsByDate = useMemo(() => {
    const byDate = new Map<string, DayChip[]>();
    const grouped = new Map<string, Map<string, number>>();
    for (const log of allLogs) {
      if (log.is_deleted || (matchingDates !== null && !matchingDates.has(log.date))) continue;
      const day = grouped.get(log.date) ?? new Map<string, number>();
      day.set(log.exercise_id, (day.get(log.exercise_id) ?? 0) + 1);
      grouped.set(log.date, day);
    }
    for (const [date, day] of grouped) {
      const chips = [...day.entries()].map(([exerciseId, sets]) => {
        const exercise = exercises.find(candidate => candidate.id === exerciseId);
        const category = exercise ? categories.find(candidate => candidate.id === exercise.category_id) : undefined;
        return {
          exerciseId,
          name: exercise?.name ?? 'Unknown exercise',
          sets,
          color: category ? intColorToHex(category.colour) : 'var(--primary)',
        };
      });
      byDate.set(date, chips.sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name)));
    }
    return byDate;
  }, [allLogs, categories, exercises, matchingDates]);

  // Routines completed on each day. The day split is the useful label when a
  // routine has one ("Spine Day") - the parent routine name is the same on
  // every one of its days and tells you nothing about which session this was.
  const routineChipsByDate = useMemo(() => {
    const byDate = new Map<string, Array<{ id: string; label: string; title: string }>>();
    for (const wr of workoutRoutines) {
      if (wr.is_deleted) continue;
      if (matchingDates !== null && !matchingDates.has(wr.date)) continue;
      const routine = routines.find(r => r.id === wr.routine_id && !r.is_deleted);
      if (!routine) continue;
      const section = wr.routine_section_id
        ? routineSections.find(s => s.id === wr.routine_section_id && !s.is_deleted)
        : null;
      const list = byDate.get(wr.date) ?? [];
      list.push({
        id: wr.id,
        label: section?.name || routine.name,
        title: `${routine.name}${section ? ` - ${section.name}` : ''}`,
      });
      byDate.set(wr.date, list);
    }
    return byDate;
  }, [workoutRoutines, routines, routineSections, matchingDates]);

  const selectCalendarDate = (date: string) => {
    setSelectedDate(date);
    setDetailOpen(true);
  };

  const weekStart = settings.first_day_of_week === 1 ? 0 : settings.first_day_of_week === 7 ? 6 : 1;
  const allLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayLabels = Array.from({ length: 7 }, (_, i) => allLabels[(weekStart + i) % 7]);

  // Week-aligned rows padded with the neighbouring months' days, so a weekly
  // overview always totals a real seven-day week.
  const buildWeeks = (year: number, month: number): Date[][] => {
    const first = new Date(year, month, 1);
    const lead = (first.getDay() - weekStart + 7) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = lead + daysInMonth;
    const tail = (7 - (total % 7)) % 7;
    const weeks: Date[][] = [];
    for (let offset = -lead; offset < daysInMonth + tail; offset += 7) {
      weeks.push(Array.from({ length: 7 }, (_, i) => new Date(year, month, 1 + offset + i)));
    }
    return weeks;
  };

  const formattedSelectedDate = useMemo(() => {
    try {
      return parseLocalDate(selectedDate).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const logsForSelectedDate = useMemo(
    () => allLogs.filter(l => l.date === selectedDate && !l.is_deleted),
    [allLogs, selectedDate],
  );

  const linkedRoutineSummaries = useMemo(() => (
    workoutRoutines
      .filter(wr => wr.date === selectedDate && !wr.is_deleted)
      .map(wr => {
        const routine = routines.find(r => r.id === wr.routine_id && !r.is_deleted);
        if (!routine) return null;
        const section = wr.routine_section_id ? routineSections.find(s => s.id === wr.routine_section_id && !s.is_deleted) : null;
        return { id: wr.id, label: `${routine.name}${section ? ` - ${section.name}` : ''}` };
      })
      .filter((item): item is { id: string; label: string } => item !== null)
  ), [workoutRoutines, selectedDate, routines, routineSections]);

  const summaryItems = useMemo(() => {
    const activeGroups = workoutGroups.filter(wg => wg.date === selectedDate && !wg.is_deleted);
    const groupExerciseIds = new Set<string>();
    const groupMap: Record<string, typeof activeGroups[number]> = {};

    for (const wg of activeGroups) {
      const linked = groupExercises.filter(ge => ge.workout_group_id === wg.id && ge.date === selectedDate && !ge.is_deleted);
      for (const ge of linked) {
        groupExerciseIds.add(ge.exercise_id);
        groupMap[ge.exercise_id] = wg;
      }
    }

    const loggedExerciseIds = Array.from(new Set(logsForSelectedDate.map(l => l.exercise_id)));
    const addedGroupIds = new Set<string>();
    const items: Array<
      | { type: 'superset'; group: typeof activeGroups[number]; exerciseIds: string[]; sortIndex: number }
      | { type: 'exercise'; exerciseId: string; sortIndex: number }
    > = [];

    for (const exId of loggedExerciseIds) {
      const parentGroup = groupMap[exId];
      if (parentGroup) {
        if (addedGroupIds.has(parentGroup.id)) continue;
        addedGroupIds.add(parentGroup.id);
        const linked = groupExercises
          .filter(ge => ge.workout_group_id === parentGroup.id && ge.date === selectedDate && !ge.is_deleted)
          .map(ge => ge.exercise_id);
        const firstIndexes = linked.map(id => logsForSelectedDate.findIndex(l => l.exercise_id === id)).filter(i => i !== -1);
        items.push({ type: 'superset', group: parentGroup, exerciseIds: linked, sortIndex: Math.min(...firstIndexes, 999999) });
      } else if (!groupExerciseIds.has(exId)) {
        const firstSetIndex = logsForSelectedDate.findIndex(l => l.exercise_id === exId);
        items.push({ type: 'exercise', exerciseId: exId, sortIndex: firstSetIndex !== -1 ? firstSetIndex : 999999 });
      }
    }

    return items.sort((a, b) => a.sortIndex - b.sortIndex);
  }, [logsForSelectedDate, selectedDate, workoutGroups, groupExercises]);

  const exerciseSummary = (exId: string) => {
    const ex = exercises.find(e => e.id === exId);
    const cat = ex ? categories.find(c => c.id === ex.category_id) : undefined;
    return {
      id: exId,
      name: ex ? ex.name : 'Unknown Exercise',
      typeId: ex ? ex.exercise_type_id : 1,
      color: cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)',
      sets: logsForSelectedDate.filter(l => l.exercise_id === exId),
    };
  };

  const renderSetRows = (ex: ReturnType<typeof exerciseSummary>) => (
    <div>
      {ex.sets.map((set, i) => (
        <div
          key={set.id}
          className="summary-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            handleSelectLogForEdit(set);
            setActiveTab('log');
          }}
          title="Click to edit in Workout Log"
        >
          <span className="summary-set-badge">{i + 1}</span>
          <span>{formatLogValue(set, ex.typeId)}</span>
          {!!set.is_complete && <span className="summary-set-completed">✓</span>}
        </div>
      ))}
    </div>
  );

  const renderWeekSummary = (week: Date[]) => {
    let sets = 0;
    let volume = 0;
    let daysTrained = 0;
    const exerciseIds = new Set<string>();

    for (const day of week) {
      const stats = dayStats.get(getLocalDateString(day));
      if (!stats) continue;
      daysTrained += 1;
      sets += stats.sets;
      volume += stats.volume;
    }
    for (const day of week) {
      const chips = workoutChipsByDate.get(getLocalDateString(day)) ?? [];
      for (const chip of chips) exerciseIds.add(chip.exerciseId);
    }

    const rangeLabel = week[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return (
      <div className="calendar-week-summary">
        <span className="calendar-week-range">{rangeLabel}</span>
        {daysTrained === 0 ? (
          <span className="calendar-week-rest">Rest week</span>
        ) : (
          <>
            <span className="calendar-week-primary">{daysTrained} {daysTrained === 1 ? 'day' : 'days'}</span>
            <span className="calendar-week-meta">{sets} {sets === 1 ? 'set' : 'sets'}</span>
            <span className="calendar-week-meta">{exerciseIds.size} exercises</span>
            {volume > 0 && <span className="calendar-week-meta">{formatVolume(volume, userUnit)}</span>}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="calendar-dashboard">
      {styleTag}

      <div className="calendar-left-pane">
        <div className="calendar-toolbar">
          <button className="hamburger-btn calendar-menu-btn" onClick={() => setSidebarOpen(true)} title="Open navigation menu" aria-label="Open navigation menu">
            <Menu size={20} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => {
              setSelectedDate(todayStr);
              scrollMonthIntoView(currentOrdinal, 'smooth');
            }}
          >
            <CalendarDays size={14} /> Today
          </button>
          <FilterCombobox
            className="calendar-filter-combobox"
            value={filter}
            onChange={setFilter}
            placeholder="All workouts"
            groups={[
              { label: 'Routines', options: routines.map(r => ({ value: `rt:${r.id}`, label: r.name })) },
              {
                label: 'Routine Days',
                options: routineSections
                  .map(sec => {
                    const parent = routines.find(r => r.id === sec.routine_id);
                    return parent ? { value: `rts:${sec.id}`, label: `${parent.name} - ${sec.name}` } : null;
                  })
                  .filter((o): o is { value: string; label: string } => o !== null),
              },
              { label: 'Categories', options: categories.map(c => ({ value: `cat:${c.id}`, label: c.name })) },
              { label: 'Exercises', options: exercises.map(ex => ({ value: `ex:${ex.id}`, label: ex.name })) },
            ]}
          />
        </div>

        <div className="calendar-scroll" ref={scrollRef} onScroll={handleScroll}>
          <div className="calendar-sentinel" ref={topSentinelRef}>
            {range.start > earliestOrdinal ? 'Loading earlier months' : ''}
          </div>
          {range.start <= earliestOrdinal && (
            <div className="calendar-edge-note">Beginning of your training history</div>
          )}

          {months.map(ordinal => {
            const { year, month } = fromOrdinal(ordinal);
            const weeks = buildWeeks(year, month);
            const monthLabel = new Date(year, month, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });

            let monthSets = 0;
            let monthDays = 0;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
              const stats = dayStats.get(getLocalDateString(new Date(year, month, d)));
              if (!stats) continue;
              monthDays += 1;
              monthSets += stats.sets;
            }

            return (
              <section key={ordinal} className="calendar-month-section" data-month={ordinal}>
                <div className="calendar-month-sticky">
                  <div className="calendar-month-header">
                    <span className="calendar-month-title">{monthLabel}</span>
                    <span className="calendar-month-total">
                      {monthDays > 0 ? `${monthDays} ${monthDays === 1 ? 'day' : 'days'} · ${monthSets} sets` : 'No workouts'}
                    </span>
                  </div>
                  <div className="calendar-week-labels">
                    <div>Week</div>
                    {dayLabels.map(label => <div key={label}>{label}</div>)}
                  </div>
                </div>

                {weeks.map(week => (
                  <div className="calendar-week-row" key={week[0].getTime()}>
                    {renderWeekSummary(week)}
                    {week.map(day => {
                      const dateStr = getLocalDateString(day);
                      const inMonth = day.getMonth() === month;
                      if (!inMonth) return <div key={dateStr} className="calendar-cell outside" />;

                      const chips = workoutChipsByDate.get(dateStr) ?? [];
                      const routineChips = routineChipsByDate.get(dateStr) ?? [];
                      return (
                        <div
                          key={dateStr}
                          className={`calendar-cell ${selectedDate === dateStr ? 'active' : ''} ${dateStr === todayStr ? 'today' : ''}`}
                          onClick={() => selectCalendarDate(dateStr)}
                        >
                          <button
                            className="calendar-cell-number"
                            onClick={event => { event.stopPropagation(); selectCalendarDate(dateStr); }}
                            aria-label={`Open workout summary for ${dateStr}`}
                          >
                            {day.getDate()}
                          </button>
                          {routineChips.length > 0 && (
                            <div className="calendar-routine-chips">
                              {routineChips.map(routine => (
                                <button
                                  key={routine.id}
                                  className="calendar-routine-chip"
                                  title={routine.title}
                                  onClick={event => { event.stopPropagation(); selectCalendarDate(dateStr); }}
                                >
                                  <Bookmark size={9} className="calendar-routine-chip-icon" />
                                  <span className="calendar-routine-chip-name">{routine.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="calendar-workout-chips">
                            {chips.map(chip => (
                              <button
                                key={chip.exerciseId}
                                className="calendar-workout-chip"
                                style={{ '--chip-color': chip.color } as CSSProperties}
                                title={`${chip.name} · ${chip.sets} set${chip.sets === 1 ? '' : 's'}`}
                                onClick={event => { event.stopPropagation(); selectCalendarDate(dateStr); }}
                              >
                                <span className="calendar-workout-chip-dot" />
                                <span className="calendar-workout-chip-name">{chip.name}</span>
                                <span className="calendar-workout-chip-stat">{chip.sets}</span>
                              </button>
                            ))}
                            {chips.length > 2 && <span className="calendar-workout-more">+{chips.length - 2} more</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            );
          })}

          <div className="calendar-sentinel" ref={bottomSentinelRef}>
            {range.end < latestOrdinal ? 'Loading later months' : ''}
          </div>
        </div>
      </div>

      <div className={`calendar-right-pane ${detailOpen ? 'detail-open' : ''}`}>
        <div className="workout-summary-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div className="workout-summary-title">
                <Dumbbell size={18} color="var(--primary)" /> Workout Summary
              </div>
              <div className="workout-summary-date">{formattedSelectedDate}</div>
            </div>
            <button
              className="btn btn-secondary icon-btn calendar-detail-dismiss"
              onClick={() => setDetailOpen(false)}
              aria-label="Close workout summary"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {linkedRoutineSummaries.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {linkedRoutineSummaries.map(routine => (
              <span
                key={routine.id}
                title="Routine linked to this workout"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', fontWeight: 700,
                  color: 'var(--primary)', backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '999px', padding: '4px 12px',
                }}
              >
                <Bookmark size={12} />
                {routine.label}
              </span>
            ))}
          </div>
        )}

        <div className="workout-summary-scroll">
          {summaryItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-secondary-dark)', fontSize: '13px' }}>
              <CalendarDays size={32} style={{ opacity: 0.2, marginBottom: '8px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
              No workout logged for this day.
            </div>
          ) : (
            summaryItems.map(item => {
              if (item.type === 'superset') {
                const color = intColorToHex(item.group.colour);
                const sortedExIds = [...item.exerciseIds].sort((a, b) => {
                  const aIndex = logsForSelectedDate.findIndex(l => l.exercise_id === a);
                  const bIndex = logsForSelectedDate.findIndex(l => l.exercise_id === b);
                  return (aIndex !== -1 ? aIndex : 9999) - (bIndex !== -1 ? bIndex : 9999);
                });
                return (
                  <div key={item.group.id} className="summary-superset-card" style={{ borderLeftColor: color }}>
                    <div className="summary-superset-title" style={{ color, backgroundColor: color + '20' }}>
                      {item.group.name || 'Superset Group'}
                    </div>
                    {sortedExIds.map(exId => {
                      const ex = exerciseSummary(exId);
                      return (
                        <div key={ex.id} className="summary-superset-exercise">
                          <div className="summary-exercise-name">{ex.name}</div>
                          {renderSetRows(ex)}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const ex = exerciseSummary(item.exerciseId);
              return (
                <div key={ex.id} className="summary-exercise-card" style={{ borderLeftColor: ex.color }}>
                  <div className="summary-exercise-name">{ex.name}</div>
                  {renderSetRows(ex)}
                </div>
              );
            })
          )}

          {logsForSelectedDate.length > 0 && (() => {
            const dayExerciseIds = new Set(logsForSelectedDate.map(l => l.exercise_id));
            const targets = aggregateMuscleTargets(exercises.filter(e => dayExerciseIds.has(e.id)));
            return (
              <MuscleDiagramDetails
                primary={targets.primary}
                secondary={targets.secondary}
                height={180}
                showLegend
              />
            );
          })()}
        </div>

        {workoutComment && (
          <div className="summary-comment-box">
            <FileText size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Workout Notes</div>
              <div>{workoutComment}</div>
            </div>
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px', marginTop: 'auto' }}
          onClick={() => setActiveTab('log')}
        >
          Go to Workout Log <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
