import React from 'react';
import { Check } from 'lucide-react';

interface ToastNotificationProps {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ show, message, type }) => {
  if (!show) return null;
  return (
    <div className="toast-notification" style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--primary)',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '12px',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontWeight: 600,
      fontSize: '14px',
      animation: 'slideInRight var(--transition-normal)'
    }}>
      {type === 'success' && <Check size={16} />}
      <span>{message}</span>
    </div>
  );
};
