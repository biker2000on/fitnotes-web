import React from 'react';
import { Check } from 'lucide-react';
import type { ToastAction } from '../store/slices/types';

interface ToastNotificationProps {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: ToastAction | null;
  onDismiss?: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ show, message, type, action, onDismiss }) => {
  if (!show) return null;
  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      {type === 'success' && !action && <Check size={16} aria-hidden="true" />}
      <span className="toast-message">{message}</span>
      {action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            action.onAction();
            onDismiss?.();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
