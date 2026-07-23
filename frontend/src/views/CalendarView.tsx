// CalendarView.tsx - Responsive calendar dashboard with workout history and
// a selected-day summary that preserves supersets.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ArrowRight, FileText, Dumbbell, List, Menu, Bookmark } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { db } from '../storage/db';
import { intColorToHex } from '../lib/colors';
import { getLocalDateString } from '../lib/date';
import { FilterCombobox } from '../components/FilterCombobox';
import { aggregateMuscleTargets } from '../lib/muscles';
import { MuscleDiagramDetails } from '../components/MuscleDiagram';
import type { RoutineSection } from '../types';

export function CalendarView() {
  const {
    calendarYear, calendarMonth, handlePrevMonth, handleNextMonth,
    allLogs, selectedDate, setSelectedDate, settings, exercises, categories,
    workoutComment, setActiveTab, formatLogValue, handleSelectLogForEdit,
    workoutGroups, groupExercises, routines, workoutRoutines, setSidebarOpen,
  } = useFitNotesStore();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [filter, setFilter] = useState('');
  const [routineSections, setRoutineSections] = useState<RoutineSection[]>([]);
  const swipeRef = useRef({ startX: 0, startY: 0, tracking: false, swiped: false });

  // Routine day-splits for the filter dropdown (not kept in global store state).
  useEffect(() => {
    db.query<RoutineSection>('SELECT * FROM routine_sections')
      .then(secs => setRoutineSections(secs.filter(s => !s.is_deleted)))
      .catch(e => console.warn('Failed to load routine sections for filter:', e));
  }, [routines]);

  const styleTag = (
    <style>{`
      .calendar-dashboard { display: flex; align-items: flex-start; gap: 24px; width: 100%; max-width: 1200px; margin: 0 auto; padding: 4px; }
      .calendar-left-pane { flex: 1.3; min-width: 0; align-self: flex-start; }
      .calendar-right-pane {
        flex: 0.7; min-width: 320px; background: rgba(30, 41, 59, 0.4);
        backdrop-filter: blur(16px); border: 1px solid var(--border-dark); border-radius: 16px;
        padding: 20px; display: flex; flex-direction: column; height: auto; align-self: stretch;
        min-height: 520px; position: sticky; top: 24px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
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
      @media (max-width: 768px) {
        .calendar-dashboard { flex-direction: column; }
        .calendar-left-pane { flex: 0 0 auto; width: 100%; align-self: stretch; }
        .calendar-right-pane { flex: 0 0 auto; position: static; width: 100%; }
      }
    `}</style>
  );

  // Day-level filtering: a day matches when it contains the chosen exercise /
  // category, or when the chosen routine (or day split) was completed on it.
  // Matching days still render their ENTIRE log; null = no filter active.
  const matchingDates = useMemo<Set<string> | null>(() => {
    if (!filter) return null;
    const [kind, id] = filter.split(':');
    const dates = new Set<string>();
    if (kind === 'ex' || kind === 'cat') {
      for (const l of allLogs) {
        if (l.is_deleted) continue;
        if (kind === 'ex' && l.exercise_id !== id) continue;
        if (kind === 'cat' && exercises.find(e => e.id === l.exercise_id)?.category_id !== id) continue;
        dates.add(l.date);
      }
    } else if (kind === 'rt' || kind === 'rts') {
      for (const wr of workoutRoutines) {
        if (wr.is_deleted) continue;
        if (kind === 'rt' && wr.routine_id !== id) continue;
        if (kind === 'rts' && wr.routine_section_id !== id) continue;
        dates.add(wr.date);
      }
    }
    return dates;
  }, [filter, allLogs, exercises, workoutRoutines]);

  const dayMatches = (dateStr: string): boolean => matchingDates === null || matchingDates.has(dateStr);

  const dotColoursFor = (dateStr: string): string[] => {
    if (!dayMatches(dateStr)) return [];
    if (!settings.calendar_category_dots_visible) {
      return allLogs.some(l => l.date === dateStr && !l.is_deleted) ? ['var(--primary)'] : [];
    }
    const colours = new Set<string>();
    for (const l of allLogs) {
      if (l.date !== dateStr || l.is_deleted) continue;
      const ex = exercises.find(e => e.id === l.exercise_id);
      const cat = ex ? categories.find(c => c.id === ex.category_id) : undefined;
      colours.add(cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)');
    }
    return Array.from(colours).slice(0, 5);
  };

  const weekStart = settings.first_day_of_week === 1 ? 0 : settings.first_day_of_week === 7 ? 6 : 1;
  const allLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayLabels = Array.from({ length: 7 }, (_, i) => allLabels[(weekStart + i) % 7]);

  const handleCalendarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    swipeRef.current = { startX: e.clientX, startY: e.clientY, tracking: true, swiped: false };
  };

  const handleCalendarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe.tracking) return;

    swipe.tracking = false;
    const deltaX = e.clientX - swipe.startX;
    const deltaY = e.clientY - swipe.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX >= 56 && absX > absY * 1.4) {
      swipe.swiped = true;
      if (deltaX > 0) {
        handlePrevMonth();
      } else {
        handleNextMonth();
      }
      window.setTimeout(() => {
        swipeRef.current.swiped = false;
      }, 180);
    }
  };

  const handleCalendarPointerCancel = () => {
    swipeRef.current.tracking = false;
  };

  const historyDays = useMemo(() => {
    const byDate: Record<string, { sets: number; exercises: Set<string> }> = {};
    for (const l of allLogs) {
      if (l.is_deleted || (matchingDates !== null && !matchingDates.has(l.date))) continue;
      const e = byDate[l.date] || (byDate[l.date] = { sets: 0, exercises: new Set() });
      e.sets += 1;
      e.exercises.add(l.exercise_id);
    }
    return Object.entries(byDate)
      .map(([date, v]) => ({ date, sets: v.sets, exercises: v.exercises.size }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allLogs, matchingDates]);

  const formattedSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch (e) {
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
        return {
          id: wr.id,
          label: `${routine.name}${section ? ` - ${section.name}` : ''}`,
        };
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
          {set.is_complete && <span className="summary-set-completed">✓</span>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="calendar-dashboard">
      {styleTag}

      <div className="calendar-left-pane card">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="hamburger-btn calendar-menu-btn" onClick={() => setSidebarOpen(true)} title="Open navigation menu" aria-label="Open navigation menu">
            <Menu size={20} />
          </button>
          <button className={`btn ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setView('month')}>
            <Calendar size={14} /> Month
          </button>
          <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setView('list')}>
            <List size={14} /> History
          </button>
          <FilterCombobox
            className="calendar-filter-combobox"
            value={filter}
            onChange={setFilter}
            placeholder="All workouts"
            groups={[
              {
                label: 'Routines',
                options: routines.map(r => ({ value: `rt:${r.id}`, label: r.name })),
              },
              {
                label: 'Routine Days',
                options: routineSections
                  .map(sec => {
                    const parent = routines.find(r => r.id === sec.routine_id);
                    return parent ? { value: `rts:${sec.id}`, label: `${parent.name} - ${sec.name}` } : null;
                  })
                  .filter((o): o is { value: string; label: string } => o !== null),
              },
              {
                label: 'Categories',
                options: categories.map(c => ({ value: `cat:${c.id}`, label: c.name })),
              },
              {
                label: 'Exercises',
                options: exercises.map(ex => ({ value: `ex:${ex.id}`, label: ex.name })),
              },
            ]}
          />
        </div>

        {view === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
            {historyDays.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', padding: '32px' }}>No workouts logged yet.</p>
            ) : historyDays.map(d => (
              <div
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px',
                  border: '1px solid var(--border-dark)', borderRadius: '10px', cursor: 'pointer',
                  background: d.date === selectedDate ? 'var(--primary-glow)' : 'transparent',
                  borderColor: d.date === selectedDate ? 'var(--primary)' : 'var(--border-dark)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {dotColoursFor(d.date).map((c, i) => <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />)}
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>
                    {(() => {
                      const [y, m, day] = d.date.split('-').map(Number);
                      return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    })()}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>{d.exercises} exercises - {d.sets} sets</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="calendar-container calendar-container-swipable"
            onPointerDown={handleCalendarPointerDown}
            onPointerUp={handleCalendarPointerUp}
            onPointerCancel={handleCalendarPointerCancel}
          >
            <div className="calendar-header">
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={handlePrevMonth}><ChevronLeft size={16} /></button>
                <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={handleNextMonth}><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="calendar-grid">
              {dayLabels.map(day => <div key={day} className="calendar-day-label">{day}</div>)}
              {(() => {
                const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                const startDayIndex = (firstDay - weekStart + 7) % 7;
                const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                const cells = [];

                for (let i = 0; i < startDayIndex; i++) {
                  cells.push(<div key={`empty-${i}`} className="calendar-day empty" style={{ border: 'none', background: 'transparent', cursor: 'default' }} />);
                }

                const todayStr = getLocalDateString();
                for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
                  const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isToday = dateStr === todayStr;
                  const dots = dotColoursFor(dateStr);
                  cells.push(
                    <div
                      key={`day-${dayNum}`}
                      className={`calendar-day ${selectedDate === dateStr ? 'active' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => {
                        if (swipeRef.current.swiped) return;
                        setSelectedDate(dateStr);
                      }}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      {dayNum}
                      {dots.length > 0 && (
                        <div className="calendar-dot-container" style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          {dots.map((c, i) => <div key={i} className="calendar-dot" style={{ backgroundColor: c }} />)}
                        </div>
                      )}
                    </div>
                  );
                }

                return cells;
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="calendar-right-pane">
        <div className="workout-summary-header">
          <div className="workout-summary-title">
            <Dumbbell size={18} color="var(--primary)" /> Workout Summary
          </div>
          <div className="workout-summary-date">{formattedSelectedDate}</div>
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
              <Calendar size={32} style={{ opacity: 0.2, marginBottom: '8px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
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
