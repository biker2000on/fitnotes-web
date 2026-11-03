// UI chrome slice: toast notifications, the shared confirmation modal, and
// global overlay visibility (command palette, shortcuts help).
// Code moved verbatim from FitNotesStore.tsx.
import { useState } from 'react';
import type { ToastAction } from './types';

export function useUiSlice() {
  // Toast notifications states
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);
  const [toastTimerId, setToastTimerId] = useState<any>(null);
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);

  // A toast carrying an action (Undo) stays up longer so a lifter mid-set has
  // time to reach it.
  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success', action?: ToastAction) => {
    if (toastTimerId) clearTimeout(toastTimerId);
    setToastMessage(msg);
    setToastType(type);
    setToastAction(action ?? null);
    setShowToast(true);
    const timer = setTimeout(() => {
      setShowToast(false);
      setToastAction(null);
    }, action ? 6000 : 3000);
    setToastTimerId(timer);
  };

  const dismissToast = () => {
    if (toastTimerId) clearTimeout(toastTimerId);
    setShowToast(false);
    setToastAction(null);
  };

  // Custom confirmation modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmOnApprove, setConfirmOnApprove] = useState<(() => void) | null>(null);
  const [confirmApproveLabel, setConfirmApproveLabel] = useState('Confirm');
  const [confirmTone, setConfirmTone] = useState<'default' | 'danger'>('default');

  const triggerConfirm = (
    title: string,
    msg: string,
    onApprove: () => void,
    options: { approveLabel?: string; tone?: 'default' | 'danger' } = {},
  ) => {
    setConfirmTitle(title);
    setConfirmMessage(msg);
    setConfirmOnApprove(() => onApprove);
    setConfirmApproveLabel(options.approveLabel || 'Confirm');
    setConfirmTone(options.tone || 'default');
    setConfirmOpen(true);
  };

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  return {
    toastMessage, setToastMessage, toastType, setToastType, showToast, setShowToast,
    toastTimerId, setToastTimerId, triggerToast, toastAction, dismissToast,
    confirmOpen, setConfirmOpen, confirmTitle, setConfirmTitle, confirmMessage, setConfirmMessage,
    confirmOnApprove, setConfirmOnApprove, confirmApproveLabel, setConfirmApproveLabel, confirmTone, setConfirmTone,
    triggerConfirm,
    showCommandPalette, setShowCommandPalette, showShortcutsHelp, setShowShortcutsHelp,
  };
}
