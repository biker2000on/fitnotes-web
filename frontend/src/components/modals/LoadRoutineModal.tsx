// LoadRoutineModal.tsx - Load a routine day into the day being viewed in the
// Log. Routines and their days are listed together so one tap picks the day.
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useFitNotesStore } from '../../store/FitNotesStore';
import { db } from '../../storage/db';
import { nextDayId } from '../../lib/routinePlan';
import { formatTargetDate } from '../../store/slices/useRoutinesSlice';
import { Sheet } from '../Sheet';
import type { RoutineSection } from '../../types';

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

export function LoadRoutineModal() {
  const {
    showRoutineImportModal, setShowRoutineImportModal, routines, workoutRoutines,
    selectedDate, setPopulateTargetDate, setActiveSectionForPopulate, setActiveTab,
  } = useFitNotesStore();
  const [sections, setSections] = useState<RoutineSection[]>([]);

  useEffect(() => {
    if (!showRoutineImportModal) return;
    db.query<RoutineSection>('SELECT * FROM routine_sections')
      .then(rows => setSections(rows.filter(row => !row.is_deleted)))
      .catch(err => console.error('Failed to load routine days:', err));
  }, [showRoutineImportModal]);

  const lastBySection = useMemo(() => {
    const map: Record<string, string> = {};
    const lastByRoutine: Record<string, string> = {};
    for (const link of workoutRoutines) {
      if (link.is_deleted) continue;
      if (link.date > (lastByRoutine[link.routine_id] ?? '')) lastByRoutine[link.routine_id] = link.date;
      if (link.routine_section_id && link.date > (map[link.routine_section_id] ?? '')) map[link.routine_section_id] = link.date;
    }
    return { map, lastByRoutine };
  }, [workoutRoutines]);

  const list = useMemo(() => routines
    .filter(r => !r.is_archived)
    .map(r => ({ routine: r, days: sections.filter(s => s.routine_id === r.id).sort(bySortOrder) }))
    .filter(entry => entry.days.length > 0)
    .sort((a, b) => (lastBySection.lastByRoutine[b.routine.id] ?? '').localeCompare(lastBySection.lastByRoutine[a.routine.id] ?? '')
      || a.routine.name.localeCompare(b.routine.name)),
  [routines, sections, lastBySection]);

  const close = () => setShowRoutineImportModal(false);

  return (
    <Sheet
      open={showRoutineImportModal}
      onClose={close}
      title="Load a routine day"
      subtitle={`Loads into ${formatTargetDate(selectedDate)}`}
      labelledBy="load-routine-title"
    >
      {list.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No routine days yet</p>
          <p>Create a routine and give it at least one day, then load it here.</p>
          <button type="button" className="btn btn-primary" onClick={() => { close(); setActiveTab('routines'); }}>Go to Routines</button>
        </div>
      ) : (
        <div className="load-routine-list">
          {list.map(({ routine, days }) => {
            const next = nextDayId(days, lastBySection.map);
            return (
              <section key={routine.id} className="load-routine-group" aria-label={routine.name}>
                <h3 className="section-title">{routine.name}</h3>
                <div className="more-list">
                  {days.map((day, index) => (
                    <button
                      key={day.id}
                      type="button"
                      className="more-row load-routine-day"
                      onClick={() => {
                        close();
                        setPopulateTargetDate(selectedDate);
                        setActiveSectionForPopulate(day);
                      }}
                    >
                      <span className="day-num">{index + 1}</span>
                      <span className="more-row-text">
                        <span>{day.name}</span>
                        <small>
                          {day.id === next ? 'Up next' : ''}
                          {day.id === next && lastBySection.map[day.id] ? ' · ' : ''}
                          {lastBySection.map[day.id] ? `last ${formatTargetDate(lastBySection.map[day.id])}` : day.id === next ? '' : 'not done yet'}
                        </small>
                      </span>
                      <ChevronRight size={18} aria-hidden className="more-row-chevron" />
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
