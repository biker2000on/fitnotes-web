import React, { useState } from 'react';
import { Play, Clipboard, History, Percent } from 'lucide-react';

interface RoutinesPopulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  routineName: string;
  onConfirmStart: (type: 'template' | 'last_workout' | 'one_rep_max', percentage?: number) => void;
}

export const RoutinesPopulatorModal: React.FC<RoutinesPopulatorModalProps> = ({
  isOpen,
  onClose,
  routineName,
  onConfirmStart
}) => {
  const [percentage, setPercentage] = useState(75);
  const [selectedType, setSelectedType] = useState<'template' | 'last_workout' | 'one_rep_max'>('template');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
      <div 
        className="modal-content mobile-modal-content" 
        style={{ 
          maxWidth: '460px',
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-dark)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-modal-header" style={{ borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Play size={20} color="var(--primary)" /> Start Routine
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>
              Choose how to populate sets for {routineName}
            </span>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={onClose}>Close</button>
        </div>

        <div className="mobile-modal-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Option A: Template Defaults */}
          <div 
            onClick={() => setSelectedType('template')}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: selectedType === 'template' ? 'var(--primary)' : 'var(--border-dark)',
              backgroundColor: selectedType === 'template' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.01)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
          >
            <Clipboard size={20} color={selectedType === 'template' ? 'var(--primary)' : 'var(--text-secondary-dark)'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary-dark)' }}>Routine Set Types</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>Follow each exercise's setting: predefined sets, copy previous, or log on-the-fly</span>
            </div>
          </div>

          {/* Option B: Last Session History */}
          <div 
            onClick={() => setSelectedType('last_workout')}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: selectedType === 'last_workout' ? 'var(--primary)' : 'var(--border-dark)',
              backgroundColor: selectedType === 'last_workout' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.01)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
          >
            <History size={20} color={selectedType === 'last_workout' ? 'var(--primary)' : 'var(--text-secondary-dark)'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary-dark)' }}>Last Session Values</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>Auto-copy weights and reps logged during last workout</span>
            </div>
          </div>

          {/* Option C: 1RM Percentage Weight */}
          <div 
            onClick={() => setSelectedType('one_rep_max')}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: selectedType === 'one_rep_max' ? 'var(--primary)' : 'var(--border-dark)',
              backgroundColor: selectedType === 'one_rep_max' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.01)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
          >
            <Percent size={20} color={selectedType === 'one_rep_max' ? 'var(--primary)' : 'var(--text-secondary-dark)'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary-dark)' }}>Percentage of 1-Rep Max</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>Calculate weights dynamically based on your current 1RM</span>
            </div>
          </div>

          {/* Target Percentage slider for 1RM option */}
          {selectedType === 'one_rep_max' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-dark)',
              backgroundColor: 'rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
                <span style={{ color: 'var(--text-secondary-dark)' }}>Lifting Intensity</span>
                <span style={{ color: 'var(--primary)' }}>{percentage}% of 1RM</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="100" 
                step="5"
                value={percentage} 
                onChange={(e) => setPercentage(parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-dark)', paddingTop: '16px', flexShrink: 0 }}>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }}
            onClick={() => onConfirmStart(selectedType, percentage)}
          >
            Start Workout
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
