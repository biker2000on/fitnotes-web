import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

interface TrainingLog {
  id: string;
  exercise_id: string;
  date: string;
  metric_weight: number | null;
  reps: number | null;
  unit: number | null;
  is_personal_record: boolean;
  is_complete: boolean;
  distance: number | null;
  duration_seconds: number | null;
  is_deleted?: boolean;
}

interface Exercise {
  id: string;
  name: string;
  category_id: string | null;
  exercise_type_id: number;
}

interface Category {
  id: string;
  name: string;
  colour: number;
}

interface CalendarPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  logs: TrainingLog[];
  comment: string;
  exercises: Exercise[];
  categories: Category[];
  intColorToHex: (num: number) => string;
  displayWeight: (weight: number | null, unit: number | null) => string;
  onGoToLog: () => void;
}

export const CalendarPreviewModal: React.FC<CalendarPreviewModalProps> = ({
  isOpen,
  onClose,
  date,
  logs,
  comment,
  exercises,
  categories,
  intColorToHex,
  displayWeight,
  onGoToLog
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}><CalendarIcon size={20} color="var(--primary)" /> Workout Summary</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Recorded logs for {date}</span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={onClose}>Close</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>💤</span>
              <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-secondary-dark)' }}>Rest Day!</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>No workouts or training logs recorded on this day.</span>
            </div>
          ) : (
            (() => {
              const uniqueExIds = Array.from(new Set(logs.map(l => l.exercise_id)));
              return uniqueExIds.map(exId => {
                const ex = exercises.find(x => x.id === exId);
                if (!ex) return null;
                const exLogs = logs.filter(l => l.exercise_id === ex.id);
                const cat = categories.find(c => c.id === ex.category_id);
                const catColor = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
                
                return (
                  <div key={ex.id} style={{ padding: '16px', border: '1px solid var(--border-dark)', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary-dark)' }}>{ex.name}</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: catColor + '15', color: catColor, fontWeight: 700 }}>
                        {cat?.name || 'Misc'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {exLogs.map((log, index) => (
                        <div key={log.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-dark)', color: 'var(--text-primary-dark)' }}>
                          <span style={{ fontWeight: 800, opacity: 0.6 }}>#{index + 1}</span>
                          <span>
                            {(() => {
                              const typeId = ex.exercise_type_id;
                              switch (typeId) {
                                case 1: return `${displayWeight(log.metric_weight, log.unit)} x ${log.reps}`;
                                case 2: return `${log.reps} reps`;
                                case 3: return `${log.distance} km / ${log.duration_seconds ? Math.round(log.duration_seconds / 60) : 0} m`;
                                case 4: return `${log.distance} km`;
                                case 5: return `${log.duration_seconds ? Math.round(log.duration_seconds / 60) : 0} m`;
                                case 6: return `${displayWeight(log.metric_weight, log.unit)} / ${log.distance} km`;
                                case 7: return `${displayWeight(log.metric_weight, log.unit)} / ${log.duration_seconds ? Math.round(log.duration_seconds / 60) : 0} m`;
                                default: return `${displayWeight(log.metric_weight, log.unit)} x ${log.reps}`;
                              }
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>

        {comment && (
          <div style={{ padding: '10px 14px', borderLeft: '3px solid var(--primary)', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: '0 8px 8px 0', fontSize: '13px', color: 'var(--text-secondary-dark)', fontStyle: 'italic' }}>
            <span style={{ fontWeight: 700, fontSize: '11px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', fontStyle: 'normal', marginBottom: '4px' }}>Day Notes</span>
            "{comment}"
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }} 
            onClick={onGoToLog}
          >
            Go to Workout Log
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ flex: 1 }} 
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
