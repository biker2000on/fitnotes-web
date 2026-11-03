// DateStepper.tsx - The app's own date control: previous / next day either
// side of the date in the user's locale; the date itself opens the picker.
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, getLocalDateString } from '../lib/date';

const describe = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const today = getLocalDateString();
  const label = day.toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
    year: y === new Date().getFullYear() ? undefined : 'numeric',
  });
  if (date === today) return `Today · ${label}`;
  if (date === addDays(today, -1)) return `Yesterday · ${label}`;
  return label;
};

export function DateStepper({ value, onChange, label }: { value: string; onChange: (date: string) => void; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    try { input.showPicker(); } catch { input.focus(); }
  };
  return (
    <div className="date-stepper" role="group" aria-label={label}>
      <button type="button" className="icon-btn" onClick={() => onChange(addDays(value, -1))} aria-label="Previous day">
        <ChevronLeft size={20} aria-hidden />
      </button>
      <button type="button" className="date-stepper-value" onClick={openPicker} aria-label={`${label}: ${describe(value)}. Change date`}>
        {describe(value)}
      </button>
      <button type="button" className="icon-btn" onClick={() => onChange(addDays(value, 1))} aria-label="Next day">
        <ChevronRight size={20} aria-hidden />
      </button>
      <input
        ref={inputRef}
        type="date"
        className="pager-input"
        value={value}
        onChange={e => e.target.value && onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
