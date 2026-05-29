import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onApprove: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onClose,
  onApprove
}) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }} onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '400px', gap: '20px' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚠️ {title}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary-dark)', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-danger" 
            style={{ flex: 1 }} 
            onClick={() => {
              onApprove();
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
