// LogMasthead.tsx - The Log's date pager. The date is the biggest control on
// the page, as in the original app: previous / next day either side, the date
// itself opens a picker, and "Today" appears only when you are elsewhere.
import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Bookmark, MessageSquare, Plus } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { addDays, getLocalDateString } from '../lib/date';

const parseLocal = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const relativeLabel = (date: string, today: string): string | null => {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return null;
};

export function LogMasthead() {
  const { selectedDate, setSelectedDate, setShowRoutineImportModal, setShowCommandPalette } = useFitNotesStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const today = getLocalDateString();
  const day = parseLocal(selectedDate);
  const weekday = day.toLocaleDateString(undefined, { weekday: 'long' });
  const dayMonth = day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const year = day.getFullYear() !== new Date().getFullYear() ? String(day.getFullYear()) : null;
  const relative = relativeLabel(selectedDate, today);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); return; } catch { /* fall through to focus */ }
    }
    input.focus();
    input.click();
  };

  return (
    <header className="log-masthead">
      <div className="pager">
        <button type="button" className="pager-step" onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label="Previous day">
          <ChevronLeft size={28} aria-hidden />
        </button>
        <button type="button" className="pager-date" onClick={openPicker} aria-label={`Change date, ${weekday} ${dayMonth}`}>
          <span className="pager-kicker">{relative ?? weekday}{year ? ` · ${year}` : ''}</span>
          <span className="pager-day">{relative ? `${weekday.slice(0, 3)} ${dayMonth}` : dayMonth}</span>
        </button>
        <button type="button" className="pager-step" onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label="Next day">
          <ChevronRight size={28} aria-hidden />
        </button>
        <input
          ref={inputRef}
          type="date"
          className="pager-input"
          value={selectedDate}
          onChange={e => e.target.value && setSelectedDate(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      <div className="log-toolbar">
        {selectedDate !== today && (
          <button type="button" className="btn btn-ghost" onClick={() => setSelectedDate(today)}>Jump to today</button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => setShowRoutineImportModal(true)}>
          <Bookmark size={16} aria-hidden /> Load routine
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => window.dispatchEvent(new CustomEvent('fitnotes:open-workout-comments'))}>
          <MessageSquare size={16} aria-hidden /> Notes
        </button>
        <button type="button" className="btn btn-primary log-add-exercise" onClick={() => setShowCommandPalette(true)}>
          <Plus size={18} aria-hidden /> Add exercise <kbd className="kbd desktop-only">Ctrl K</kbd>
        </button>
      </div>
    </header>
  );
}
