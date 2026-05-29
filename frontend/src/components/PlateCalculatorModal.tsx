import React from 'react';
import { Calculator } from 'lucide-react';

interface Plate {
  weight: number;
  count: number;
  color: string;
}

interface PlateCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userUnit: 'kg' | 'lbs';
  plateCalcTarget: number;
  setPlateCalcTarget: (target: number) => void;
  calculatedPlates: Plate[];
}

export const PlateCalculatorModal: React.FC<PlateCalculatorModalProps> = ({
  isOpen,
  onClose,
  userUnit,
  plateCalcTarget,
  setPlateCalcTarget,
  calculatedPlates
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Calculator size={20} color="var(--primary)" /> Plate Load Calculator</h2>
          <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={onClose}>Close</button>
        </div>
        
        <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>
          Input a target weight (includes {userUnit === 'kg' ? '20kg' : '45lbs'} bar) to get plate distribution:
        </p>
        
        <input 
          type="number" 
          value={plateCalcTarget} 
          onChange={(e) => setPlateCalcTarget(parseFloat(e.target.value) || 0)} 
          placeholder={`Target Weight (${userUnit})`}
          style={{ fontSize: '18px', fontWeight: 700 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          {calculatedPlates.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary-dark)', fontSize: '13px' }}>
              Only standard {userUnit === 'kg' ? '20kg' : '45lbs'} bar required.
            </p>
          ) : (
            calculatedPlates.map(p => (
              <div key={p.weight} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dark)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: p.color }}></div>
                  <span style={{ fontWeight: 700 }}>{p.weight} {userUnit} plate</span>
                </div>
                <span style={{ fontWeight: 800 }}>x{p.count * 2} total <span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', fontWeight: 400 }}>({p.count} per side)</span></span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
