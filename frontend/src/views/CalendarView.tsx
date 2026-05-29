// CalendarView.tsx - Month grid + history list of workout days.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { intColorToHex } from '../lib/colors';

export function CalendarView() {
  const {
    calendarYear, calendarMonth, handlePrevMonth, handleNextMonth,
    allLogs, selectedDate, handleCalendarDayClick, settings, exercises, categories,
  } = useFitNotesStore();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [filter, setFilter] = useState(''); // '' | 'cat:<id>' | 'ex:<id>'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLogs, filter]);

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`btn ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 14px' }} onClick={() => setView('month')}>Month</button>
        <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '6px 14px' }} onClick={() => setView('list')}>History</button>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '6px', marginLeft: 'auto', maxWidth: '200px' }}>
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
            <div key={d.date} onClick={() => handleCalendarDayClick(d.date)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border-dark)', borderRadius: '10px', cursor: 'pointer', background: d.date === selectedDate ? 'var(--primary-glow)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {dotColoursFor(d.date).map((c, i) => <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />)}
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
            for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
              const yyyy = calendarYear;
              const mm = String(calendarMonth + 1).padStart(2, '0');
              const dd = String(dayNum).padStart(2, '0');
              const dateStr = `${yyyy}-${mm}-${dd}`;

              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const dots = dotColoursFor(dateStr);

              cells.push(
                <div
                  key={`day-${dayNum}`}
                  className={`calendar-day ${selectedDate === dateStr ? 'active' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => handleCalendarDayClick(dateStr)}
                  style={{ cursor: 'pointer' }}
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
  );
}
