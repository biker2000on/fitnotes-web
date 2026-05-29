import React from 'react';
import { Copy, Calendar } from 'lucide-react';

interface TrainingLog {
  id: string;
  exercise_id: string;
  date: string;
  metric_weight: number | null;
  reps: number | null;
  unit: number | null;
  is_deleted?: boolean;
}

interface Exercise {
  id: string;
  name: string;
  category_id: string | null;
  exercise_type_id: number;
}

interface CopyWorkoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allLogs: TrainingLog[];
  exercises: Exercise[];
  onConfirmCopy: (sourceDate: string) => void;
}

export const CopyWorkoutDrawer: React.FC<CopyWorkoutDrawerProps> = ({
  isOpen,
  onClose,
  allLogs,
  exercises,
  onConfirmCopy
}) => {
  if (!isOpen) return null;

  // Filter unique dates that have active logged sets, sorted descending
  const activeLogs = allLogs.filter(l => !l.is_deleted);
  const uniqueDates = Array.from(new Set(activeLogs.map(l => l.date)))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5); // Retrieve last 5 workouts

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '500px',
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-dark)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Copy size={20} color="var(--primary)" /> Copy Previous Workout</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Select a past workout to duplicate into today's log</span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={onClose}>Close</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {uniqueDates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary-dark)' }}>
              No previous workout logs found.
            </div>
          ) : (
            uniqueDates.map(dateStr => {
              const dayLogs = activeLogs.filter(l => l.date === dateStr);
              const dayExIds = Array.from(new Set(dayLogs.map(l => l.exercise_id)));
              
              return (
                <div 
                  key={dateStr}
                  onClick={() => onConfirmCopy(dateStr)}
                  style={{
                    padding: '14px',
                    border: '1px solid var(--border-dark)',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.borderColor = 'var(--border-dark)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                    <Calendar size={14} color="var(--primary)" />
                    <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary-dark)' }}>{dateStr}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary-dark)', marginLeft: 'auto' }}>
                      {dayLogs.length} sets completed
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {dayExIds.map(exId => {
                      const ex = exercises.find(x => x.id === exId);
                      if (!ex) return null;
                      return (
                        <span 
                          key={exId} 
                          style={{ 
                            fontSize: '10px', 
                            padding: '2px 8px', 
                            borderRadius: '6px', 
                            backgroundColor: 'rgba(255,255,255,0.05)', 
                            color: 'var(--text-secondary-dark)',
                            border: '1px solid rgba(255,255,255,0.04)'
                          }}
                        >
                          {ex.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
