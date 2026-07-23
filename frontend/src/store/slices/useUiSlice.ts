// UI chrome slice: toast notifications, the shared confirmation modal, and
// global overlay visibility (command palette, shortcuts help).
// Code moved verbatim from FitNotesStore.tsx.
import { useState } from 'react';

export function useUiSlice() {
  // Toast notifications states
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);
  const [toastTimerId, setToastTimerId] = useState<any>(null);

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerId) clearTimeout(toastTimerId);
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    const timer = setTimeout(() => {
      setShowToast(false);
    }, 3000);
    setToastTimerId(timer);
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
    toastTimerId, setToastTimerId, triggerToast,
    confirmOpen, setConfirmOpen, confirmTitle, setConfirmTitle, confirmMessage, setConfirmMessage,
    confirmOnApprove, setConfirmOnApprove, confirmApproveLabel, setConfirmApproveLabel, confirmTone, setConfirmTone,
    triggerConfirm,
    showCommandPalette, setShowCommandPalette, showShortcutsHelp, setShowShortcutsHelp,
  };
}
