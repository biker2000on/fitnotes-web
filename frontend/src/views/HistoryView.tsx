// HistoryView.tsx - Standalone workout history: every logged session in
// reverse-chronological order with its exercises, totals, and linked routines.
// Split out of the calendar so browsing past sessions is its own destination.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Bookmark, Dumbbell, History as HistoryIcon, ArrowRight } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { db } from '../storage/db';
import { intColorToHex } from '../lib/colors';
import { parseLocalDate } from '../lib/date';
import { FilterCombobox } from '../components/FilterCombobox';
import { buildDayStats, buildMatchingDates, formatVolume } from '../lib/workoutHistory';
import type { RoutineSection } from '../types';

const PAGE_SIZE = 25;

export function HistoryView() {
  const {
    allLogs, exercises, categories, routines, workoutRoutines,
    setSelectedDate, setActiveTab, userUnit, handleSelectLogForEdit,
  } = useFitNotesStore();
  const [filter, setFilter] = useState('');
  const [routineSections, setRoutineSections] = useState<RoutineSection[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    db.query<RoutineSection>('SELECT * FROM routine_sections')
      .then(secs => setRoutineSections(secs.filter(s => !s.is_deleted)))
      .catch(e => console.warn('Failed to load routine sections for filter:', e));
  }, [routines]);

  const matchingDates = useMemo(
    () => buildMatchingDates(filter, allLogs, exercises, workoutRoutines),
    [filter, allLogs, exercises, workoutRoutines],
  );

  const sessions = useMemo(() => {
    const stats = buildDayStats(allLogs, matchingDates);
    return [...stats.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [allLogs, matchingDates]);

  // Reset paging whenever the filter changes the result set.
  useEffect(() => { setVisible(PAGE_SIZE); }, [filter]);

  // Scroll-driven paging, listening on whichever ancestor actually scrolls.
  // The app scrolls inside .main-content, not the window, and scroll events do
  // not bubble - a window-only listener never fires here, which left the list
  // stuck on its first page behind a label that never resolved. Binding to the
  // scrolling element itself is the form that depends on the least: no
  // bubbling, no capture-phase delivery, no observer callbacks.
  useEffect(() => {
    const check = () => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      if (sentinel.getBoundingClientRect().top - window.innerHeight < 300) {
        setVisible(v => (v >= sessions.length ? v : v + PAGE_SIZE));
      }
    };

    let scroller: HTMLElement | null = sentinelRef.current?.parentElement ?? null;
    while (scroller) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') break;
      scroller = scroller.parentElement;
    }

    check();
    scroller?.addEventListener('scroll', check, { passive: true });
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      scroller?.removeEventListener('scroll', check);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [sessions.length, visible]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, typeof allLogs>();
    for (const log of allLogs) {
      if (log.is_deleted) continue;
      const list = map.get(log.date) ?? [];
      list.push(log);
      map.set(log.date, list);
    }
    return map;
  }, [allLogs]);

  const routineLabelsFor = (date: string) => (
    workoutRoutines
      .filter(wr => wr.date === date && !wr.is_deleted)
      .map(wr => {
        const routine = routines.find(r => r.id === wr.routine_id && !r.is_deleted);
        if (!routine) return null;
        const section = wr.routine_section_id
          ? routineSections.find(s => s.id === wr.routine_section_id && !s.is_deleted)
          : null;
        return { id: wr.id, label: `${routine.name}${section ? ` - ${section.name}` : ''}` };
      })
      .filter((item): item is { id: string; label: string } => item !== null)
  );

  const exerciseBreakdown = (date: string) => {
    const counts = new Map<string, number>();
    for (const log of logsByDate.get(date) ?? []) {
      counts.set(log.exercise_id, (counts.get(log.exercise_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([exerciseId, sets]) => {
        const exercise = exercises.find(e => e.id === exerciseId);
        const category = exercise ? categories.find(c => c.id === exercise.category_id) : undefined;
        return {
          exerciseId,
          sets,
          name: exercise?.name ?? 'Unknown exercise',
          color: category ? intColorToHex(category.colour) : 'var(--primary)',
        };
      })
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
  };

  const openInLog = (date: string) => {
    setSelectedDate(date);
    const first = (logsByDate.get(date) ?? [])[0];
    if (first) handleSelectLogForEdit(first);
    setActiveTab('log');
  };

  const openInCalendar = (date: string) => {
    setSelectedDate(date);
    setActiveTab('calendar');
  };

  return (
    <div className="history-view">
      <style>{`
        .history-view { display: flex; flex-direction: column; gap: 16px; width: 100%; }
        .history-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .history-session-card {
          border: 1px solid var(--border-dark); border-radius: 12px; padding: 14px 16px;
          background: rgba(255, 255, 255, 0.015); display: flex; flex-direction: column; gap: 10px;
        }
        .history-session-head {
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;
        }
        .history-session-date { font-size: 15px; font-weight: 800; color: var(--text-main-dark); }
        .history-session-stats { font-size: 12px; color: var(--text-secondary-dark); }
        .history-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .history-exercise-chip {
          display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--chip-color) 38%, var(--border-dark));
          background: color-mix(in srgb, var(--chip-color) 10%, transparent);
          font-size: 12px; color: var(--text-main-dark); cursor: pointer;
        }
        .history-exercise-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--chip-color); }
        .history-exercise-sets { color: var(--text-secondary-dark); font-size: 11px; }
        .history-routine-chip {
          display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700;
          color: var(--primary); background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 999px; padding: 3px 10px;
        }
        .history-session-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      `}</style>

      {/* No menu button here: unlike the calendar, this view keeps the app
          header, which already carries one. */}
      <div className="history-toolbar">
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
        <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', marginLeft: 'auto' }}>
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary-dark)' }}>
          <HistoryIcon size={36} style={{ opacity: 0.25, marginBottom: '10px' }} />
          <div style={{ fontSize: '14px' }}>
            {filter ? 'No sessions match this filter.' : 'No workouts logged yet.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessions.slice(0, visible).map(session => {
            const breakdown = exerciseBreakdown(session.date);
            const routineChips = routineLabelsFor(session.date);
            return (
              <div key={session.date} className="history-session-card">
                <div className="history-session-head">
                  <span className="history-session-date">
                    {parseLocalDate(session.date).toLocaleDateString(undefined, {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                  <span className="history-session-stats">
                    {session.exercises} {session.exercises === 1 ? 'exercise' : 'exercises'} · {session.sets} {session.sets === 1 ? 'set' : 'sets'}
                    {session.volume > 0 ? ` · ${formatVolume(session.volume, userUnit)}` : ''}
                  </span>
                </div>

                {routineChips.length > 0 && (
                  <div className="history-chip-row">
                    {routineChips.map(chip => (
                      <span key={chip.id} className="history-routine-chip">
                        <Bookmark size={11} /> {chip.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="history-chip-row">
                  {breakdown.map(item => (
                    <button
                      key={item.exerciseId}
                      className="history-exercise-chip"
                      style={{ '--chip-color': item.color } as React.CSSProperties}
                      onClick={() => openInLog(session.date)}
                      title={`Open ${item.name} on ${session.date} in the workout log`}
                    >
                      <span className="history-exercise-dot" />
                      {item.name}
                      <span className="history-exercise-sets">{item.sets}</span>
                    </button>
                  ))}
                </div>

                <div className="history-session-actions">
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                    onClick={() => openInCalendar(session.date)}
                  >
                    <CalendarDays size={14} /> View in calendar
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                    onClick={() => openInLog(session.date)}
                  >
                    <Dumbbell size={14} /> Open in log <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
          <div ref={sentinelRef} />
          {visible < sessions.length && (
            // Also a button, not just a spinner: if auto-paging ever fails to
            // fire there is still a way forward instead of a stuck label.
            <button
              className="btn btn-secondary"
              style={{ alignSelf: 'center', padding: '8px 18px', fontSize: '12px' }}
              onClick={() => setVisible(v => v + PAGE_SIZE)}
            >
              Load more ({sessions.length - visible} older {sessions.length - visible === 1 ? 'session' : 'sessions'})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
