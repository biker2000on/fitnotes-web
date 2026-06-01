// CalendarView.tsx - Responsive Split Calendar Dashboard (Interactive Month/History on Left, Inline Workout Summary on Right)
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ArrowRight, FileText, Dumbbell, List } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { intColorToHex } from '../lib/colors';
import { getLocalDateString } from '../lib/date';

export function CalendarView() {
  const {
    calendarYear, calendarMonth, handlePrevMonth, handleNextMonth,
    allLogs, selectedDate, setSelectedDate, settings, exercises, categories,
    workoutComment, setActiveTab, formatLogValue, handleSelectLogForEdit
  } = useFitNotesStore();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [filter, setFilter] = useState(''); // '' | 'cat:<id>' | 'ex:<id>'

  // Scoped inline CSS for premium glassmorphism side-by-side styling
  const styleTag = (
    <style>{`
      .calendar-dashboard {
        display: flex;
        gap: 24px;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 4px;
      }
      .calendar-left-pane {
        flex: 1.3;
        min-width: 0;
      }
      .calendar-right-pane {
        flex: 0.7;
        min-width: 320px;
        background: rgba(30, 41, 59, 0.4);
        backdrop-filter: blur(16px);
        border: 1px solid var(--border-dark);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        height: auto;
        align-self: stretch;
        min-height: 520px;
        position: sticky;
        top: 24px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        transition: all 0.3s ease;
      }
      .calendar-right-pane:hover {
        border-color: rgba(255, 255, 255, 0.1);
        box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5);
      }
      .workout-summary-header {
        border-bottom: 1px solid var(--border-dark);
        padding-bottom: 12px;
        margin-bottom: 16px;
      }
      .workout-summary-title {
        font-size: 18px;
        fontWeight: 800;
        color: var(--text-main-dark);
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .workout-summary-date {
        font-size: 13px;
        color: var(--text-secondary-dark);
        font-weight: 500;
      }
      .workout-summary-scroll {
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
        margin-bottom: 16px;
      }
      .workout-summary-scroll::-webkit-scrollbar {
        width: 6px;
      }
      .workout-summary-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      .workout-summary-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .summary-exercise-card {
        background: rgba(255, 255, 255, 0.02);
        border-left: 3px solid var(--primary);
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 12px;
        transition: transform 0.2s ease;
      }
      .summary-exercise-card:hover {
        transform: translateX(4px);
        background: rgba(255, 255, 255, 0.04);
      }
      .summary-exercise-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-main-dark);
        margin-bottom: 6px;
      }
      .summary-set-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: 13px;
        color: var(--text-secondary-dark);
      }
      .summary-set-badge {
        font-size: 10px;
        font-weight: 800;
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-main-dark);
        padding: 2px 6px;
        border-radius: 4px;
        min-width: 20px;
        text-align: center;
      }
      .summary-set-completed {
        color: var(--accent);
        font-weight: 600;
      }
      .summary-comment-box {
        background: rgba(245, 158, 11, 0.05);
        border: 1px dashed rgba(245, 158, 11, 0.2);
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 16px;
        font-size: 13px;
        color: #f59e0b;
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      @media (max-width: 768px) {
        .calendar-dashboard {
          flex-direction: column;
        }
        .calendar-right-pane {
          position: static;
          width: 100%;
        }
      }
    `}</style>
  );

  // Whether a log matches the active calendar filter.
  const matchesFilter = (l: { exercise_id: string }): boolean => {
    if (!filter) return true;
    const [kind, id] = filter.split(':');
    if (kind === 'ex') return l.exercise_id === id;
    if (kind === 'cat') return exercises.find(e => e.id === l.exercise_id)?.category_id === id;
    return true;
  };

  // Distinct category colours trained on a given date (for the per-category dots).
  const dotColoursFor = (dateStr: string): string[] => {
    if (!settings.calendar_category_dots_visible) {
      return allLogs.some(l => l.date === dateStr && !l.is_deleted && matchesFilter(l)) ? ['var(--primary)'] : [];
    }
    const colours = new Set<string>();
    for (const l of allLogs) {
      if (l.date !== dateStr || l.is_deleted || !matchesFilter(l)) continue;
      const ex = exercises.find(e => e.id === l.exercise_id);
      const cat = ex ? categories.find(c => c.id === ex.category_id) : undefined;
      colours.add(cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)');
    }
    return Array.from(colours).slice(0, 5);
  };

  // first_day_of_week: 1 Sun, 2 Mon, 7 Sat -> JS weekday index the week starts on.
  const weekStart = settings.first_day_of_week === 1 ? 0 : settings.first_day_of_week === 7 ? 6 : 1;
  const allLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayLabels = Array.from({ length: 7 }, (_, i) => allLabels[(weekStart + i) % 7]);

  // History list: past workout days (newest first) with set/exercise counts.
  const historyDays = useMemo(() => {
    const byDate: Record<string, { sets: number; exercises: Set<string> }> = {};
    for (const l of allLogs) {
      if (l.is_deleted || !matchesFilter(l)) continue;
      const e = byDate[l.date] || (byDate[l.date] = { sets: 0, exercises: new Set() });
      e.sets += 1; e.exercises.add(l.exercise_id);
    }
    return Object.entries(byDate)
      .map(([date, v]) => ({ date, sets: v.sets, exercises: v.exercises.size }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allLogs, filter, exercises]);

  // Format clicked date to a nice human string
  const formattedSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return selectedDate;
    }
  }, [selectedDate]);

  // Group workout logs for right-side inline viewer
  const summaryExercises = useMemo(() => {
    const logsForDate = allLogs.filter(l => l.date === selectedDate && !l.is_deleted);
    const grouped: Record<string, typeof logsForDate> = {};
    
    // Maintain chronological insertion order based on first performed set index
    const minSetIndex: Record<string, number> = {};
    logsForDate.forEach((log, index) => {
      if (!grouped[log.exercise_id]) {
        grouped[log.exercise_id] = [];
        minSetIndex[log.exercise_id] = index;
      }
      grouped[log.exercise_id].push(log);
    });

    return Object.entries(grouped)
      .map(([exId, sets]) => {
        const ex = exercises.find(e => e.id === exId);
        const cat = ex ? categories.find(c => c.id === ex.category_id) : undefined;
        return {
          id: exId,
          name: ex ? ex.name : 'Unknown Exercise',
          typeId: ex ? ex.exercise_type_id : 1,
          color: cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)',
          sets,
          sortIndex: minSetIndex[exId]
        };
      })
      .sort((a, b) => a.sortIndex - b.sortIndex);
  }, [allLogs, selectedDate, exercises, categories]);

  return (
    <div className="calendar-dashboard">
      {styleTag}
      
      {/* Left Column: Month Grid or History List */}
      <div className="calendar-left-pane card">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className={`btn ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }} 
            onClick={() => setView('month')}
          >
            <Calendar size={14} /> Month
          </button>
          <button 
            className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }} 
            onClick={() => setView('list')}
          >
            <List size={14} /> History
          </button>
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)} 
            style={{ padding: '6px', marginLeft: 'auto', maxWidth: '200px', borderRadius: '8px', border: '1px solid var(--border-dark)' }}
          >
            <option value="">All exercises</option>
            <optgroup label="Categories">
              {categories.map(c => <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>)}
            </optgroup>
            <optgroup label="Exercises">
              {exercises.map(ex => <option key={ex.id} value={`ex:${ex.id}`}>{ex.name}</option>)}
            </optgroup>
          </select>
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
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 16px', 
                  border: '1px solid var(--border-dark)', 
                  borderRadius: '10px', 
                  cursor: 'pointer', 
                  background: d.date === selectedDate ? 'var(--primary-glow)' : 'transparent',
                  borderColor: d.date === selectedDate ? 'var(--primary)' : 'var(--border-dark)',
                  transition: 'all 0.2s ease'
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
                <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>{d.exercises} exercises · {d.sets} sets</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="calendar-container">
            <div className="calendar-header">
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={handlePrevMonth}>
                  <ChevronLeft size={16} />
                </button>
                <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={handleNextMonth}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="calendar-grid">
              {dayLabels.map(day => (
                <div key={day} className="calendar-day-label">{day}</div>
              ))}

              {(() => {
                // Offset of the 1st within the configured week-start.
                const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                const startDayIndex = (firstDay - weekStart + 7) % 7;

                // Get total days in the month
                const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

                const cells = [];

                // Empty offset cells
                for (let i = 0; i < startDayIndex; i++) {
                  cells.push(
                    <div
                      key={`empty-${i}`}
                      className="calendar-day empty"
                      style={{ border: 'none', background: 'transparent', cursor: 'default' }}
                    />
                  );
                }

                // Month day cells
                const todayStr = getLocalDateString();
                for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
                  const yyyy = calendarYear;
                  const mm = String(calendarMonth + 1).padStart(2, '0');
                  const dd = String(dayNum).padStart(2, '0');
                  const dateStr = `${yyyy}-${mm}-${dd}`;

                  const isToday = dateStr === todayStr;
                  const dots = dotColoursFor(dateStr);

                  cells.push(
                    <div
                      key={`day-${dayNum}`}
                      className={`calendar-day ${selectedDate === dateStr ? 'active' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => setSelectedDate(dateStr)}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      {dayNum}
                      {dots.length > 0 && (
                        <div className="calendar-dot-container" style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          {dots.map((c, i) => <div key={i} className="calendar-dot" style={{ backgroundColor: c }}></div>)}
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

      {/* Right Column: Interactive Workout Summary Panel */}
      <div className="calendar-right-pane">
        <div className="workout-summary-header">
          <div className="workout-summary-title">
            <Dumbbell size={18} color="var(--primary)" /> Workout Summary
          </div>
          <div className="workout-summary-date">{formattedSelectedDate}</div>
        </div>

        <div className="workout-summary-scroll">
          {summaryExercises.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-secondary-dark)', fontSize: '13px' }}>
              <Calendar size={32} style={{ opacity: 0.2, marginBottom: '8px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
              No workout logged for this day.
            </div>
          ) : (
            summaryExercises.map(ex => (
              <div key={ex.id} className="summary-exercise-card" style={{ borderLeftColor: ex.color }}>
                <div className="summary-exercise-name">{ex.name}</div>
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
              </div>
            ))
          )}
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
