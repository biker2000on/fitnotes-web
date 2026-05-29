import React from 'react';
import { Trash2, Calendar, Layers, Plus } from 'lucide-react';

interface BulkActionsDockProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkMove: () => void;
  onBulkSuperset: () => void;
  onBulkIncrementWeight: () => void;
  onBulkIncrementReps: () => void;
}

export const BulkActionsDock: React.FC<BulkActionsDockProps> = ({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkMove,
  onBulkSuperset,
  onBulkIncrementWeight,
  onBulkIncrementReps
}) => {
  if (selectedCount === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      backdropFilter: 'blur(16px)',
      border: '1px solid var(--primary)',
      borderRadius: '16px',
      padding: '16px 24px',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      zIndex: 99999,
      animation: 'slideInUp var(--transition-normal)'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary-dark)' }}>
          {selectedCount} sets selected
        </span>
        <span 
          onClick={onClearSelection}
          style={{ fontSize: '11px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
        >
          Deselect all
        </span>
      </div>

      <div style={{ width: '1px', height: '36px', backgroundColor: 'var(--border-dark)' }}></div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Bulk Superset Grouping */}
        <button 
          className="btn btn-primary" 
          style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={onBulkSuperset}
        >
          <Layers size={14} /> Link Superset
        </button>

        {/* Bulk Weight increment */}
        <button 
          className="btn btn-secondary" 
          style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={onBulkIncrementWeight}
          title="Increase weight by +5 lbs/kg"
        >
          <Plus size={12} /> Weight
        </button>

        {/* Bulk Reps increment */}
        <button 
          className="btn btn-secondary" 
          style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={onBulkIncrementReps}
          title="Increase reps by +2"
        >
          <Plus size={12} /> Reps
        </button>

        {/* Bulk Date Move */}
        <button 
          className="btn btn-secondary" 
          style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={onBulkMove}
        >
          <Calendar size={14} /> Move Date
        </button>

        {/* Bulk Delete */}
        <button 
          className="btn" 
          style={{ 
            padding: '8px 12px', 
            fontSize: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            backgroundColor: 'transparent',
            border: '1px solid var(--danger)',
            color: 'var(--danger)'
          }}
          onClick={onBulkDelete}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
};
