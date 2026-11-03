import React, { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';
import { formatTargetDate } from '../store/slices/useRoutinesSlice';
import { getLocalDateString } from '../lib/date';
import { DateStepper } from './DateStepper';

type FillMethod = 'template' | 'last_workout' | 'one_rep_max';

interface RoutinesPopulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  routineName: string;
  targetDate: string;
  onConfirmStart: (type: FillMethod, percentage: number, date: string) => void;
}

const METHODS: { id: FillMethod; label: string; hint: string }[] = [
  { id: 'template', label: 'Planned sets', hint: 'Each exercise as set up in the routine' },
  { id: 'last_workout', label: 'Last time', hint: 'Repeat what you logged last session' },
  { id: 'one_rep_max', label: '% of 1RM', hint: 'Weights from your best estimated max' },
];

// Starting a day is one confirm: the date it lands on and how sets are filled
// are both visible and preselected, so the common case is a single tap.
export const RoutinesPopulatorModal: React.FC<RoutinesPopulatorModalProps> = ({
  isOpen,
  onClose,
  routineName,
  targetDate,
  onConfirmStart,
}) => {
  const [percentage, setPercentage] = useState(75);
  const [method, setMethod] = useState<FillMethod>('template');
  const [date, setDate] = useState(targetDate);
  useEffect(() => { setDate(targetDate); }, [targetDate, isOpen]);

  if (!isOpen) return null;

  const isToday = date === getLocalDateString();

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={onClose}>
      <div
        className="modal-content mobile-modal-content sheet start-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-header">
          <h2 id="start-sheet-title" className="sheet-title">{routineName}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="field">
          <span className="field-label">Log it on</span>
          <DateStepper value={date} onChange={setDate} label="Log it on" />
        </div>

        <fieldset className="segmented" aria-label="Fill sets with">
          <legend className="field-label">Fill sets with</legend>
          {METHODS.map(option => (
            <label key={option.id} className={`segmented-option${method === option.id ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="fill-method"
                value={option.id}
                checked={method === option.id}
                onChange={() => setMethod(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <p className="field-hint">{METHODS.find(option => option.id === method)?.hint}</p>

        {method === 'one_rep_max' && (
          <label className="range-field">
            <span className="range-field-row">
              <span className="field-label">Intensity</span>
              <strong className="num">{percentage}%</strong>
            </span>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={percentage}
              onChange={(e) => setPercentage(parseInt(e.target.value, 10))}
            />
          </label>
        )}

        <button
          type="button"
          className="btn btn-primary btn-block btn-lg"
          onClick={() => onConfirmStart(method, percentage, date)}
          autoFocus
        >
          <Play size={18} aria-hidden /> Start {isToday ? 'today' : formatTargetDate(date)}
        </button>
      </div>
    </div>
  );
};
